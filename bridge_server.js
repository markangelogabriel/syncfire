load('vertx.js');

isServer = true;
eb = vertx.eventBus;

/* ====================== Initializes the HTTP Server
 */
var server = vertx.createHttpServer();

// Serve the static resources
server.requestHandler(function(req) {
    if (req.uri == "/") req.response.sendFile("index.html");
    else{
        req.response.sendFile(req.uri.substring(1,req.uri.length));
    }
});

// Create a SockJS bridge which lets everything through (be careful!)
vertx.createSockJSServer(server).bridge({prefix: "/commbus"}, [{}], [{}]);

server.listen(7001);

/* ====================== END HTTP Server initialization
 */

load('server/logger.js');

/* ====================== Core syncfire-server files
 */
load('server/connection.js');
load('server/disconnection_handler.js');

/* ====================== Load all custom handlers/js files here
 */
 //load(file);

//***************************************** Time Synchronization ***********************//

/* Usage :
 *  1) Client sends msg to synchronizeTime
 *  2) Server replies its time when it receives the message
 *  3) Client receives server's reply and gets :
 *      Latency = (client_time_received-client_time_sent)/2
 *      Server-Client Time Offset
 *  Repeat to get more data
 */
eb.registerHandler("synchronizeTime", function(msg, replyTo){
    var now= Date.now();
    replyTo({client_time_sent:msg.client_time_sent, server_time_received:now});
});
//************************************* END Time Synchronization ***********************//
