const WebSocket = require('ws');

class SocketServer {
    constructor() {
        this.wss = new WebSocket.Server({ port: 8080 })
            .on('connection', function connection(w) {
                console.log(`New connection`);
                w.on('message', function (msg) {
                    console.log('message from client: ' + msg);
                });
                w.on('close', function () {
                    console.log('closing connection');
                });
                w.on('error', (e) => { console.log(e) });
            });
    }
    send(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }
}


function startServer() {
    return new SocketServer();
}

module.exports = startServer;