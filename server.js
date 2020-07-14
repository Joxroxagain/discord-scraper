const { Server } = require('ws');
const express = require('express');

class SocketServer {
    constructor() {
        this.port = 8080;
        this.server = express()
            .use((req, res) => res.send(`<p>WebSocket port ${this.port}</p>`))
            .listen(this.port, () => console.log(`wss listening on ${this.port}`));
        this.wss = new Server({ server: this.server })
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