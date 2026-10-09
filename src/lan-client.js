const STORAGE_KEY = 'chess-studio.room';
export class LanClient {
  constructor() {
    this.socket = null; this.connection = null; this.room = null; this.state = null; this.color = null; this.autoReconnect = false;
    this.onState = () => {}; this.onError = () => {}; this.onConnection = () => {}; this.onLeave = () => {};
    this.reconnectDelay = 1000;
  }
  savedRoom() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
  saveRoom(value) { try { if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); else sessionStorage.removeItem(STORAGE_KEY); } catch {} }
  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connection) return this.connection;
    this.onConnection('connecting');
    this.connection = new Promise((resolve, reject) => {
      const url = new URL('ws', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = new URL('./ws', location.href).pathname;
      const socket = this.socket = new WebSocket(url);
      const timeout = setTimeout(() => { socket.close(); reject(new Error('Não foi possível conectar ao servidor de salas.')); }, 8000);
      socket.onopen = () => { clearTimeout(timeout); this.connection = null; this.reconnectDelay = 1000; this.onConnection('connected'); resolve(); };
      socket.onerror = () => { clearTimeout(timeout); this.connection = null; reject(new Error('As salas precisam do servidor chess.io em execução.')); };
      socket.onmessage = event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'joined') { this.room = message; this.color = message.color; this.autoReconnect = true; this.saveRoom(message); }
        else if (message.type === 'state') { this.state = message; this.onState(message); }
        else if (message.type === 'error') { this.onError(message.message); }
        else if (message.type === 'left') { this.room = null; this.state = null; this.color = null; this.saveRoom(null); this.onLeave(); }
      };
      socket.onclose = () => {
        clearTimeout(timeout); this.connection = null; if (this.socket === socket) this.socket = null;
        this.onConnection('disconnected');
        if (this.autoReconnect && this.room) {
          const delay = this.reconnectDelay; this.reconnectDelay = Math.min(10_000, delay * 2);
          this.reconnectTimer = setTimeout(() => this.send({ type: 'resume', code: this.room.code, token: this.room.token }).catch(() => {}), delay);
        }
        reject(new Error('A conexão com a sala foi interrompida.'));
      };
    });
    return this.connection;
  }
  async send(message) { await this.connect(); this.socket.send(JSON.stringify(message)); }
  async restore() {
    const saved = this.savedRoom(); if (!saved) return;
    this.room = saved; this.color = saved.color; this.autoReconnect = true;
    await this.send({ type: 'resume', code: saved.code, token: saved.token });
  }
  async leave() {
    this.autoReconnect = false; clearTimeout(this.reconnectTimer);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'leave' }));
    this.saveRoom(null); this.room = null; this.state = null; this.color = null; this.socket?.close(); this.onLeave();
  }
}
