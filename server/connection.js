/**
 * Created with JetBrains WebStorm.
 * User: MAG
 * Date: 11/8/13
 * Time: 6:16 PM
 */

var eb=vertx.eventBus;
connected_clients = {};
client_id=0;

var DISCONNECT_THRESHOLD = 2000;
var RECONNECT_THRESHOLD = 60000; //60 seconds

eb.registerHandler("openConnection", function(msg,replyTo){

    //TODO : insert dynamic onConnect function here, and run it

    //if reconnected         (assumption : client_details.name is unique)
    for(var id in connected_clients){
        if(connected_clients[id].client_details.name==msg.name && connected_clients[id].conn=="reconnecting"){
            connected_clients[id].conn=true;
            logger.addLogEntry(new Date(), "SERVER", connected_clients[id].client_details.name+
                "(ID:"+id+") - Reconnected");
            eb.publish("OnUserReconnect", {});
            replyTo({id:id, reconnect:true});
            return;    //not sure if this is necessary
        }
    }

    connected_clients[client_id]={client_details:msg, conn:true,
        connCheckerID:null};

    connected_clients[client_id].connCheckerID =
        vertx.setPeriodic(DISCONNECT_THRESHOLD*2, //period might need to be > DISCONNECT_THRESHOLD, but by how much?
            (function(client_id){
                //if client has not updated their connection status to true in the said interval(DISCONNECT_THRESHOLD)
                return function(){
                    if(connected_clients[client_id]){
                        if(connected_clients[client_id].conn==false){
                            connected_clients[client_id].conn="reconnecting";
                            logger.addLogEntry(new Date(), "SERVER", connected_clients[client_id].client_details.name+
                                "(ID:"+client_id+") - Soft disconnect");
                            eb.publish("OnUserSoftDisconnect", {});

                            //start timer for reconnection
                            vertx.setTimer(RECONNECT_THRESHOLD, function(){
                                //if user still hasn't reconnected, disconnect them fully
                                if(connected_clients[client_id] && connected_clients[client_id].conn=="reconnecting")
                                    closeConnectionHandler({client_id:client_id, forced_dc:true});
                            });
                        }
                        else if(connected_clients[client_id].conn==true) connected_clients[client_id].conn=false;
                    }
                }
            })(client_id)
        );

    logger.addLogEntry(new Date(), "SERVER", connected_clients[client_id].client_details.name+
        "(ID:"+client_id+") - Connected");

    replyTo({id:client_id});
    client_id++;
});

eb.registerHandler("closeConnection", closeConnectionHandler);

function closeConnectionHandler(msg, replyTo){
    //TODO : insert dynamic onDisconnect function here, and run it

    eb.publish("OnUserDisconnect", {});
    if(connected_clients[msg.client_id])
        if(msg.forced_dc){
            logger.addLogEntry(new Date(), "SERVER", connected_clients[msg.client_id].client_details.name+
                "(ID:"+msg.client_id+") - Connection lost");
        }
        else{
            logger.addLogEntry(new Date(), "SERVER", connected_clients[msg.client_id].client_details.name+
                "(ID:"+msg.client_id+") - Disconnected");
        }


    delete connected_clients[msg.client_id];

    if(!msg.forced_dc)
        replyTo({});
}