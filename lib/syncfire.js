/**
 * Created with JetBrains WebStorm.
 * User: MAG
 * Date: 11/16/13
 * Time: 7:38 PM
 */

function EventQueue(){
    this.maxTick = 1000;

    this.eventQueue = new Array(this.maxTick);

    //expansion rate (multiplier to eventQueue size)
    this.expansion_rate = 1.5;
}

var syncfire = (function(){
    var IP="localhost";
    var PORT="7001";
    var SERVER_OFFSET_THRESHOLD = 20;
    var DELAY = 1; //in ticks
    var DISCONNECT_THRESHOLD = 2000;

    //Communication bus
    var CommBus=null;
    var ConnectionIntervalID=null;

    var Events = [];

    var TICK=0;
    var TICKS_PER_SECOND=10;
    var TICK_DURATION=1000/TICKS_PER_SECOND;

    var eventQueue = new EventQueue();

    var client_details=null;
    var latency=null;
    var server_offset=0;

    var getServerOffset = function(){
        return server_offset;
    };

    var getLatency = function(){
        return latency>=0?latency:0;
    };

    var getIP = function(){
        return IP;
    };

    var getPort = function(){
        return PORT;
    };

    var getCommunicationBus = function(){
        return CommBus;
    };

    var getClientID = function(){
        return client_details._id;
    };

    var getClientDetails = function(){
        return client_details;
    };

    var getTick = function(){
        return TICK;
    };

    /*
     * Override this function via setUpdate to customize your game's
     * update function
     */
    var update=function(){
        var actions = eventQueue.getActionsWithTick(TICK);

        if(actions){
            for(var i= 0,l=actions.length;i<l;i++){
                setTimeout(actions[i].action,0);
            }
        }
    };

    var setUpdate = function(update){
        update=update;
    }

    var startGame = function(){
        update();
        TICK++;
        setTimeout(startGame, TICK_DURATION);
    }

    /**
     *
     * @param eventName = name of event
     * @param eventFunction = what event does when it gets fired
     *
     * registerEvent registers an event (duh)
     * In the case wherein you register with an already existing eventName, the previous event gets overridden
     */
    var registerEvent=function(eventName,eventFunction){

        CommBus.registerHandler(eventName,function(msg){
            eventQueue.addEvent(TICK+DELAY, (function(msg){
                return function(){
                    eventFunction(msg);
                }
            })(msg));
        });
        Events[eventName]=eventFunction;
    };

    /**
     *
     * @param eventName = name of event to unregister
     *
     * unregisterEvent unregisters an event (further event fires will no longer be listened to)
     */
    var unregisterEvent=function(eventName){
        if(Events[eventName]){ //if event exists
            CommBus.unregisterHandler(eventName, Events[eventName]);
            delete Events[eventName];
        }
    };

    /**
     *
     * @param eventName = name of event to fire
     *
     * All clients (and the server as well) who have a registered event named eventName 
	 *	shall run the corresponding eventFunction
     * Take note that you may fire events even if you don't have the event itself registered
     */
    var fireEvent=function(eventName, params){
        if(params)
            CommBus.publish(eventName, params);
        else
            CommBus.publish(eventName,{});
    };

    var openConnection = function(login_details, onOpen){
        //if already initialized
        if(CommBus)
            return false;

        client_details=login_details;

        CommBus = new vertx.EventBus("http://"+IP+":"+PORT+"/commbus");

        CommBus.onopen = function() {
            CommBus.send("openConnection", client_details, function(reply){
                client_details._id = reply.id;

                ConnectionIntervalID = setInterval(
                    function(){
                        try{
                            CommBus.send("connectionChecker", {client_id:client_details._id}, function(reply){
                                if(reply.reconnected){
                                    console.log('reconnected!');

                                    //get recent logs, replay functions
                                }
                                else{
                                    console.log('connection checked');
                                }
                            });
                        }
                        catch(err){
                            clearInterval(ConnectionIntervalID);
                            CommBus = new vertx.EventBus("http://"+IP+":"+PORT+"/commbus");
                        }

                    }, DISCONNECT_THRESHOLD
                );

                if(onOpen)
                    onOpen();
            });
            syncTimeWithServer();
        };

        CommBus.onclose = function() {
            //clearInterval(ConnectionIntervalID);
            //client_details=null;
            //CommBus = null;
        };

        return true;
    };

    var isConnected = function(){
        return CommBus?true:false;
    }
    /**
     *
     * @param address = address of handler to send to (must be unique; normally on server-side)
     * @param message = JSONized data
     * @param onReply = function to call when the receiver has replied to this message
     */
    var send = function(address, message, onReply){
        if(CommBus){
            message.sender = client_details;
            message.timestamp = serverTime()+getLatency();
            CommBus.send(address,message,onReply);
        }

    };

    // Cuts off connection to the server
    var closeConnection= function(){
        if(CommBus){
            send("closeConnection", {client_id:client_details._id}, function(reply){
                //end interval thread ConnectionIntervalID

                //CommBus.close();
            });
        }
    };

    var serverTime= function(){
        var now= Date.now();
        return now - server_offset;
    };

    var syncTimeWithServer= function(){
        //try to delay for some random interval
        var random_delay = Math.ceil(Math.random()*2);
        var server_offsets = [];
        var packetstosend = 5;
        var sync_counter=5;
        var i=0;

        //initial sync to set the server_offset, this should adjust our local copy of server_time to
        //be accurate to the seconds level.
        send('synchronizeTime', {client_time_sent:serverTime()}, function(reply){
            //current client time
            var now=Date.now();
            //network delay
            var delay = (now - reply.client_time_sent)/2;

            //computed server time
            var server_time = reply.server_time_received + delay;
            //difference between server and client's time

            server_offset= (now-server_time);

            //let's now verify if the adjustment is correct by sampling more
            send('synchronizeTime', {client_time_sent:serverTime()}, sampling);
        });

        function sampling(reply){
            var now=serverTime();

            //store the latency of each sampling
            var delay= (now-reply.client_time_sent)/2;

            //store the difference between actual server time and local copy of server time
            server_offsets.push(now - (reply.server_time_received + delay));
            if (server_offsets.length>=packetstosend){ //if enough data is gathered, solve avg offset

                server_offsets.sort();

                var sum=0;

                // 1 to n-1 so as to remove outliers
                for (var j=1;j<packetstosend-1;j++){
                    sum+=server_offsets[j];
                }
                var average = Math.round(sum / (packetstosend-2));

                if (average>SERVER_OFFSET_THRESHOLD) throw "Unstable network";
                server_offset += average; //TODO : i don't get why this is += rather than just = assignment
                server_offsets=[];
                if (i < sync_counter) {
                    var server_time = serverTime();
                    i++;
                    setTimeout(function(){
                        send('synchronizeTime', {client_time_sent:server_time+random_delay}, sampling);
                    }, random_delay);
                    random_delay = Math.ceil(Math.random()*2);
                }
            }
            else { //gather more data
                var server_time = serverTime();

                setTimeout(function(){
                    send('synchronizeTime', {client_time_sent:server_time+random_delay}, sampling);
                }, random_delay);
                random_delay = Math.ceil(Math.random()*2);
            }
        }

        //run the code to update your latency in an interval
        send('synchronizeTime', {client_time_sent:Date.now()}, setLatency);

        function setLatency(reply){
            var now = Date.now();
            var delay = 3000;         //TODO : move this value to config file

            latency = (now - reply.client_time_sent)/2;

            /* do additional commands here, if you want to use the latency value in the same time it is changed*/

            setTimeout(function(){
                if(CommBus)
                    send('synchronizeTime', {client_time_sent:now+delay}, setLatency);
            }, delay);
        }
    };

    return {
        getLatency:getLatency,
        getIP:getIP,
        getPort:getPort,
        getServerOffset:getServerOffset,
        getCommunicationBus:getCommunicationBus,
        getClientID:getClientID,
        getClientDetails:getClientDetails,
        getTick:getTick,
        openConnection:openConnection,
        send:send,
        isConnected:isConnected,
        closeConnection:closeConnection,
        getServerTime:serverTime,
        registerEvent:registerEvent,
        unregisterEvent:unregisterEvent,
        fireEvent:fireEvent,
        setUpdate:setUpdate,
        startGame:startGame
    };
})();

//---------------------- EVENT QUEUE prototype


/**
 *
 * @param tick = tick of actions to get from eventQueue
 * @returns {Array} of actions supposed to be run in the specified tick
 */
EventQueue.prototype.getActionsWithTick = function(tick){
    return this.eventQueue[tick];
};

/**
 *
 * @param tick = tick the event should run
 * @param action = what the event should do
 */
EventQueue.prototype.addEvent = function(tick, action){
    var index = tick;

    //adjust eventQueue size
    while(index >= this.maxTick){

        this.maxTick = Math.floor(this.maxTick * this.expansion_rate);

        this.eventQueue.length = this.maxTick;

        //console.log('expand to '+this.maxTick);
    }

    //if this.eventQueue[tick] is undefined
    if(!this.eventQueue[index]){
        this.eventQueue[index] = [];
    }

    this.eventQueue[index].push({action:action});
};

EventQueue.prototype.renew = function(){
    for(var i= 0,l=this.eventQueue.length;i<l;i++){
        delete this.eventQueue[i];
    }
};