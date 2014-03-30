/**
 * Created with JetBrains WebStorm.
 * User: MAG
 * Date: 11/8/13
 * Time: 6:13 PM
 */

var eb = vertx.eventBus;

eb.registerHandler("connectionChecker", function(msg, replyTo){
    if(connected_clients[msg.client_id]){

        //from SOFT DISCONNECT -> RECONNECT
        if(connected_clients[msg.client_id].conn=="reconnecting"){
            logger.addLogEntry(new Date(), "SERVER", connected_clients[msg.client_id].client_details.name+
                "(ID:"+client_id+") - Reconnected");

            connected_clients[msg.client_id].conn=true;
            eb.publish("OnUserReconnect", {});
            replyTo({reconnected:true});
        }
        //normal connection update
        else{
            connected_clients[msg.client_id].conn=true;
            replyTo({reconnected:false});
        }
    }
});