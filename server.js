var WebSocket = require("ws");

class SocketServer {
  constructor() {
    this.port = process.env.PORT || 8080;
    this.wss = new WebSocket.Server({ port: this.port })
      .on("listening", () => {
        console.log("wss on port " + this.port);
      })
      .on("connection", function connection(w) {
        w.on("message", function (msg) {
          msg = msg.toString("utf8");
          if (msg === "PING") {
            ws.send("PONG");
          }
          console.log("message from client: " + msg);
        });
        w.on("close", function () {
          console.log("closing connection");
        });
        w.on("error", (e) => {
          console.log(e);
        });
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
