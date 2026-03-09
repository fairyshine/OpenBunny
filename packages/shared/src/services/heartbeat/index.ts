export interface HeartbeatItem {
  id: string;
  text: string;
  createdAt: number;
}

export type HeartbeatInterval = 30 | 60 | 120; // minutes

interface PersistedState {
  items: HeartbeatItem[];
  interval: HeartbeatInterval;
}

const STORAGE_KEY = 'openbunny-heartbeat';

type HeartbeatListener = () => void;

class HeartbeatManager {
  private items: HeartbeatItem[] = [];
  private interval: HeartbeatInterval = 60;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<HeartbeatListener>();
  private onTick: ((items: HeartbeatItem[]) => void) | null = null;
  private initialized = false;
  private lastTick: number | null = null;

  setTickHandler(handler: (items: HeartbeatItem[]) => void) {
    this.onTick = handler;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: PersistedState = JSON.parse(raw);
      this.items = state.items || [];
      this.interval = state.interval || 60;
    } catch { /* ignore */ }
    this.restartTimer();
  }

  add(text: string): HeartbeatItem {
    this.initialize();
    const item: HeartbeatItem = {
      id: crypto.randomUUID(),
      text,
      createdAt: Date.now(),
    };
    this.items.push(item);
    this.persist();
    this.notify();
    return item;
  }

  remove(id: string): boolean {
    this.initialize();
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.persist();
    this.notify();
    return true;
  }

  list(): HeartbeatItem[] {
    this.initialize();
    return [...this.items];
  }

  clear() {
    this.initialize();
    this.items = [];
    this.persist();
    this.notify();
  }

  getInterval(): HeartbeatInterval {
    this.initialize();
    return this.interval;
  }

  setInterval(minutes: HeartbeatInterval) {
    this.initialize();
    this.interval = minutes;
    this.persist();
    this.notify();
    this.restartTimer();
  }

  getLastTick(): number | null {
    return this.lastTick;
  }

  getNextTick(): number | null {
    if (!this.lastTick) return null;
    return this.lastTick + this.interval * 60 * 1000;
  }

  subscribe(listener: HeartbeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private restartTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.items.length === 0) return;
      this.lastTick = Date.now();
      this.notify();
      this.onTick?.(this.list());
    }, this.interval * 60 * 1000);
  }

  private persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      const state: PersistedState = { items: this.items, interval: this.interval };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

export const heartbeatManager = new HeartbeatManager();
