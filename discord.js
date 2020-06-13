const WebSocket = require('ws');
const EventEmitter = require('events');

let p = (func) => {
	return (data) => {
		func(JSON.parse(data));
	}
}
let e = JSON.stringify;
let encoding = 'json';
try {
	const erlpack = require('erlpack');
	p = (func) => {
		return (data) => {
			func(erlpack.unpack(data));
		}
	}
	e = erlpack.pack;
	encoding = 'etf';
} catch (e) {
}

class Connection {
	constructor(main) {
		this.socket = null;
		this.hbinterval = null;
		this.hbfunc = null;
		this.hbtimer = null;
		this.s = -1;
		this.session = -1;
		this.main = main;
	}

	acknowledge() {
		// this.main.emit('DEBUG', 'hb acknowledged');
		this.hbfunc = this.beat;
	}

	beat() {
		// this.main.emit('DEBUG', 'sending hb');
		this.socket.send(e({
			op: 1,
			d: this.s
		}));
		this.hbfunc = this.resume;
	}

	resume() {
		this.main.emit('DEBUG', 'attempting resume');
		this.close().then(() =>
			this.connect()
		).then(() => {
			this.main.emit('DEBUG', 'sent resume packet');
			this.socket.send(e({
				op: 6,
				d: {
					token: this.main.token,
					session_id: this.session,
					seq: this.s
				}
			}));
		});
	}

	close() {
		this.main.emit('DEBUG', 'client attempting to close connection');
		if (this.hbtimer) {
			clearInterval(this.hbtimer);
		}
		return new Promise((resolve, reject) => {
			if (this.socket.readyState !== 3) {
				this.socket.close(1001, 'cya later alligator');
				this.socket.removeAllListeners('close');
				this.socket.once('close', () => {
					this.main.emit('DEBUG', 'client closed connection');
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	connect(cb) {
		this.main.emit('DEBUG', 'starting connection packet');
		return new Promise((resolve, reject) => {
			this.socket = new WebSocket(this.main.url + '?encoding=' + encoding);
			this.socket.once('open', () => {
				this.main.emit('DEBUG', 'opened connection');
				this.socket.once('message', p((payload) => {
					this.main.emit('DEBUG', 'recieved heartbeat info ' + JSON.stringify(payload.d));
					this.hbinterval = payload.d.heartbeat_interval;
					this.hbfunc = this.beat;
					if (this.hbtimer) {
						clearInterval(this.hbtimer);
					}
					this.hbtimer = setInterval(() => this.hbfunc(), this.hbinterval);
					if (!cb) {
						setTimeout(() => resolve(this.identify()), 5000 - Date.now() + this.main.lastReady);
					} else {
						resolve(cb());
					}
				}));
			});
			this.socket.once('close', (code, reason) => {
				this.main.emit('DEBUG', 'server closed connection. code: ' + code + ', reason: ' + reason + ' reconnecting in 10');
				setTimeout(() => this.close().then(() => this.connect()), 10000);
			});
			this.socket.once('error', () => {
				this.main.emit('DEBUG', 'recieved error ' + e.message + ', reconnecting in 5');
				setTimeout(() => this.close().then(() => this.connect()), 5000);
			});
		});
	}

	send(data) {
		this.socket.send(e(data));
	}

	identify() {
		return new Promise((resolve, reject) => {
			this.main.emit('DEBUG', 'sent identify packet');
			this.socket.send(e({
				op: 2,
				d: {
					token: this.main.token,
					properties: {
						$os: process.platform,
						$browser: 'NodeJS',
						$device: 'NodeJS',
					}
				}
			}));
			this.socket.on('message', p((payload) => {
				this.s = payload.s;
				this.main.emit('PAYLOAD', payload);
				if (payload.op === 11) {
					this.acknowledge();
				} else if (payload.t === 'RESUMED') {
					this.main.emit('DEBUG', 'successfully resumed');
				} else if (payload.op === 0) {
					this.main.emit(payload.t, payload.d);
				}
			}));
			this.socket.once('message', p((payload) => {
				if (payload.t === 'READY') {
					this.session = payload.d.session_id;
					this.main.emit('DEBUG', 'is ready');
					resolve({ timeReady: Date.now(), socket: this });
				} else if (payload.op === 9) {
					this.main.emit('DEBUG', 'invalid session, reconnecting in 5');
					setTimeout(() => this.close().then(() => this.connect()), 5000);
				}
			}));
		});
	}
}

class GatewaySocket extends EventEmitter {
	constructor(token) {
		super();
		this.token = token;
		this.socket;
	}

	getGatewayInfo() {
		return new Promise((resolve, reject) => {
			require('https').get({
				hostname: 'discordapp.com',
				path: '/api/gateway',
				// headers: {
				// 	Authorization: "Bot " + this.token
				// }
			}, (res) => {
				let data = '';
				res.on('data', (d) => {
					data += d;
				});
				res.on('end', () => {
					resolve(JSON.parse(data));
				});
			}).on('error', reject);
		});
	}

	async connect() {
		const { url } = await this.getGatewayInfo();
		this.url = url;

		if (this.socket) await this.socket.close();
		this.socket = new Connection(this);
		this.socket.connect()
	}

	send(data) {
		this.socket.send(data);
	}
}

function connectToGateway(token) {
	return new GatewaySocket(token);
}

module.exports = connectToGateway;
