/**
 * Pi Agent WebSocket 客户端
 *
 * 与服务端 pi-server（桥接到 `pi --mode rpc`）通信。
 * - request(): 发送命令并等待匹配 id 的 response
 * - on(type): 订阅事件（pi 事件流 + server 事件）
 */

export interface PiRequest {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface PiResponse {
  id?: string;
  type: "response";
  command?: string;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface PiEvent {
  type: string;
  [key: string]: unknown;
}

let seq = 0;
export function nextId(prefix = "pi"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

type EventListener = (event: PiEvent) => void;

class PiClient {
  private ws: WebSocket | null = null;
  private url = "";
  private pending = new Map<string, { resolve: (r: PiResponse) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Map<string, Set<EventListener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private retry = 0;

  connect(url: string) {
    this.url = url;
    this.manualClose = false;
    this.open();
  }

  private open() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.emit("status", { type: "status", status: "connecting" });
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.emit("status", { type: "status", status: "connected" });
    };

    ws.onmessage = (ev) => {
      let msg: PiEvent & { id?: string };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "response" && msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.id);
          p.resolve(msg as unknown as PiResponse);
          return;
        }
      }
      this.emit(msg.type, msg);
    };

    ws.onclose = () => {
      this.emit("status", { type: "status", status: "disconnected" });
      this.rejectAllPending("连接已断开");
      if (!this.manualClose) {
        this.retry += 1;
        const delay = Math.min(500 * 2 ** (this.retry - 1), 8000);
        this.reconnectTimer = setTimeout(() => this.open(), delay);
      }
    };

    ws.onerror = () => {
      this.emit("status", { type: "status", status: "error" });
    };
  }

  private rejectAllPending(error: string) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ type: "response", success: false, error });
    }
    this.pending.clear();
  }

  request(type: string, params: Record<string, unknown> = {}, timeoutMs = 120000): Promise<PiResponse> {
    return new Promise((resolve) => {
      const id = nextId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ type: "response", command: type, success: false, error: `请求超时：${type}` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      const payload: PiRequest = { id, type, ...params };
      try {
        this.sendRaw(payload);
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ type: "response", command: type, success: false, error: "连接不可用" });
      }
    });
  }

  send(type: string, params: Record<string, unknown> = {}) {
    this.sendRaw({ type, ...params });
  }

  private sendRaw(obj: PiRequest | { type: string; [k: string]: unknown }) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket 未连接");
    }
    this.ws.send(JSON.stringify(obj));
  }

  on(type: string, fn: EventListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return () => {
      this.listeners.get(type)?.delete(fn);
    };
  }

  private emit(type: string, event: PiEvent) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        fn(event);
      } catch (err) {
        console.error(`[pi-client] listener error for ${type}`, err);
      }
    }
  }

  close() {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.rejectAllPending("客户端已关闭");
    this.ws?.close();
    this.ws = null;
  }
}

export const piClient = new PiClient();
