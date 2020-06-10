const WebSocket = require('ws');
const moment = require('moment');
const fs = require("fs");

// Token for logging into discord, must be set in "config.json"
const TOKEN = process.env.NODE_ENV === undefined || process.env.NODE_ENV === null ?
	(fs.existsSync("./dev.config.json") ?
		require("./dev.config.json").TOKEN :
		require("./config.json").TOKEN) :
	process.env.TOKEN;

// Errors
var connectionError = false;
// Websocket
var ws;
const SOCKET_URL = 'wss://gateway.discord.gg/?v=7&encoding=json';
// Heartbeat
var hbRate;
var hbInterval;
var firstHB;
var lastSequence;
var sessionID;
var heartbeat_ack_received;
var sessionResumeable;

// Error codes
let errCodes = {
	1000: "Normal closure",
	1001: "Going away",
	1002: "Protocol error",
	1003: "Unsupported data",
	1004: "Unknown (reserved)",
	1005: "No status received",
	1006: "Abnormal closure",
	1007: "Invalid frame payload data",
	1008: "Policy violation",
	1009: "Message too big",
	1010: "Missing extension",
	1012: "Service restart",
	1013: "Try again later",
	1014: "Bad gateway",
	1015: "TLS handshake failed",
	4000: "Unknown error",
	4001: "Unknown opcode",
	4002: "Decode error",
	4003: "Not authenticated",
	4004: "Authentication failed",
	4005: "Already authenticated",
	4007: "Invalid sequence",
	4008: "Rate limited",
	4009: "Session timed out",
	4010: "Invalid shard",
	4011: "Sharding required",
	4012: "Invalid API version",
	4013: "Invalid intent(s)",
	4014: "Disallowed intent(s)",
}


const start = () => {

	ws = new WebSocket(SOCKET_URL);

	ws.once('error', (err) => {
		connectionError = true;
		console.error(`${getTime()} Gateway close event error code: ${err}`);
		shutdown();
		setTimeout(() => {
			console.info(`${getTime()} Restarting...`);
			start();
		}, 6000);
	});

	ws.once('open', () => {
		connectionError = false;
		console.log(`Monitor started @ ${moment().format('MMMM Do, h:mm:ss a')}`)

		ws.once('close', (err) => {
			shutdown();
			console.error(`${getTime()} Gateway closed: ${err} - ${errCodes[err]}`);
			if (!connectionError)
				setTimeout(() => {
					console.info(`${getTime()} Restarting...`);
					start();
				}, 6000);
		});
		ws.on('message', async data => {
			dataHandler(data);
		});
	});

};

function dataHandler(data) {
	const { op, d, t, s } = JSON.parse(data);

	switch (op) {
		// Events
		case 0: handleEvents(d, t, s); break;
		// Invalid Session
		case 9: setTimeout(handleInvalidSession, Math.floor(Math.random() * 5000) + 3000); break;
		// Hello
		case 10: handleHello(d); break;
		// Heartbeat ACK
		case 11: handleHeartbeatResponse(); break;

		// Catch all errors
		default:
			if (4000 <= op && op <= 4014) {
				console.error(`${getTime()} Unplanned error: ${op} - ${errCodes[op]}`)
			}
			break;
	}

}

function handleEvents(d, t, s) {
	lastSequence = s;
	if (t == 'READY') sessionID = d.session_id;
	if (['MESSAGE_CREATE', 'MESSAGE_UPDATE'].includes(t) && d.content) {
		console.log(
			`${getTime()} New message:` +
			`\n\tType: ${d.guild_id ? `Server - ID: ${d.guild_id}` : "DM"}` +
			`\n\tFrom: ${d.author.username}` +
			`\n\tContent: ${d.content}`
		)
	}
}

function handleHello(d) {
	hbRate = d.heartbeat_interval;
	console.log(`${getTime()} Heart beat interval set to ${hbRate}`)

	// Send first heartbeat
	firstHB = setTimeout(() => {
		ws.send(JSON.stringify({
			op: 1,
			d: lastSequence
		}));
		// console.log(`${getTime()} Sent first heartbeat`)
		heartbeat_ack_received = false;
	}, hbRate);

	// Start heartbeat interval
	hbInterval = setTimeout(() => setInterval(heartbeat, hbRate), hbRate);

	if (typeof sessionID == 'undefined') {
		// Send Opcode 2 Identify to the Gateway
		ws.send(JSON.stringify({
			op: 2,
			d: {
				token: TOKEN,
				properties: {
					$os: process.platform,
					$browser: 'NodeJS',
					$device: 'NodeJS',
				},
			}
		}));
		console.log(`${getTime()} Sent identify handshake`);
	} else {
		//Send Opcode 6 Resume to the Gateway
		ws.send(JSON.stringify({
			op: 6,
			d: {
				token: TOKEN,
				session_id: sessionID,
				seq: lastSequence
			}
		}));
		console.log(`${getTime()} Sent resume handshake`);
	}

}

function heartbeat() {
	// no Heartbeat ACK recived, disconnect
	if (!heartbeat_ack_received) {
		ws.close(1002);
		console.log(`${getTime()} Closed socket because there was no ACK response from server`);
	} else {
		ws.send(JSON.stringify({
			op: 1,
			d: lastSequence
		}));
		heartbeat_ack_received = false;
		// console.log(`${getTime()} Sent heartbeat from interval`)
	}
}

function handleHeartbeatResponse() {
	heartbeat_ack_received = true;
	// console.log(`${getTime()} Got heartbeat acknowledgement from server`)
}

function handleInvalidSession() {

	if (sessionResumeable && typeof sessionID != 'undefined') {
		ws.send(JSON.stringify({
			op: 6,
			d: {
				token: TOKEN,
				session_id: sessionID,
				seq: lastSequence
			}
		}));
		console.log(`${getTime()} Sent resume handshake`);
	} else {
		ws.send(JSON.stringify({
			op: 2,
			d: {
				token: TOKEN,
				properties: {
					$os: process.platform,
					$browser: 'NodeJS',
					$device: 'NodeJS',
				},
			}
		}));
		console.log(`${getTime()} Sent identify handshake`);
	}

}

function shutdown() {
	clearInterval(hbInterval);
	clearTimeout(firstHB);
}

function getTime() {
	return `[ ${moment().format('MMMM Do, h:mm:ss a')} ]`;
}


// Program logic
if (TOKEN == '') {
	console.log("You must enter a valid discord auth token to run!")
	return;
} else {
	// Output the last characters in the token to verify
	var spclCnt = (TOKEN.match(/\.|-/g) || []).length;
	var n = 0;
	console.log("Discord token: " + 
		TOKEN.replace(/[a-z0-9]/gi, match => n++ < TOKEN.length - 15 - spclCnt ? "_" : match));
	start();
}
