/**
 * Created with JetBrains WebStorm.
 * User: MAG
 * Date: 2/18/14
 * Time: 6:19 PM
 */

var eb=vertx.eventBus;

var logger=(function(){
    var logs = [];
    /* {
     timestamp
     source : SERVER/client_name+ID
     message
     }
     */

    var addLogEntry = function(timestamp, source, message){
        logs.push({timestamp:timestamp,source:source,message:message});

        var hours = timestamp.getHours()>=10?timestamp.getHours():"0"+timestamp.getHours();
        var minutes = timestamp.getMinutes()>=10?timestamp.getMinutes():"0"+timestamp.getMinutes();
        var seconds = timestamp.getSeconds()>=10?timestamp.getSeconds():"0"+timestamp.getSeconds();

        console.log("["+hours+":"+minutes+":"+seconds+"] From "+source+" : "+message);
        eb.publish("LogSubscription", {log:{timestamp:timestamp,source:source,message:message}});
    };

    var getMasterLog = function(){
        return logs;
    };

    var getRecentLogs = function(count){
        if(count < logs.length){
            return logs.slice(logs.length-count, logs.length);
        }
        else
            return logs;

    };

    return {
        addLogEntry:addLogEntry,
        getMasterLog:getMasterLog,
        getRecentLogs:getRecentLogs
    };

})();
