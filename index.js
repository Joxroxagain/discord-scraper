const fs = require("fs");
const moment = require('moment');
const Gateway = require('./discord');
const Server = require('./server');
const parseMessage = require('./parse')
const channels = require('./channels.json').channels

const TOKEN = process.env.NODE_ENV === undefined || process.env.NODE_ENV === null ?
    (fs.existsSync("./dev.config.json") ?
        require("./dev.config.json").TOKEN :
        require("./config.json").TOKEN) :
    process.env.TOKEN;

let n = 0;
var spclCnt = (TOKEN.match(/\.|-/g) || []).length;
console.log("Discord token: " +
    TOKEN.replace(/[a-z0-9]/gi, match => n++ < TOKEN.length - 15 - spclCnt ? "_" : match));

const socket = Gateway(TOKEN);
const server = Server();
socket.connect();

socket.on('MESSAGE_CREATE', (data) => {
    if (channels.includes(data.channel_id)) {
        console.log(`${getTimeStamp()} New message: ${parseMessage(data)}`);
        server.send(parseMessage(data));
    }
});
socket.on('DEBUG', (message) => {
    console.log(`${getTimeStamp()} ${message}`);
});

function getTimeStamp() {
    return `[ ${moment().format('MMMM Do, h:mm:ss a')} ]`;
}