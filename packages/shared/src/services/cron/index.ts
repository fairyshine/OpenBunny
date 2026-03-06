import { Cron } from 'croner';

export interface CronJob {
  id: string;
  expression: string;
  description: string;
  createdAt: number;
  nextRun: number | null;
  lastRun: number | null;
  runCount: number;
}

/** Serializable subset persisted to storage */
interface PersistedJob {
  id: string;
  expression: string;
  description: string;
  createdAt: number;
  lastRun: number | null;
  runCount: number;
}

const STORAGE_KEY = 'cyberbunny-cron-jobs';

type CronListener = (jobs: CronJob[]) => void;

class CronManager {
  private jobs = new Map<string, { cron: Cron; meta: CronJob }>();
  private listeners = new Set<CronListener>();
  private onTrigger: ((job: CronJob) => void) | null = null;
  private initialized = false;

  setTriggerHandler(handler: (job: CronJob) => void) {
    this.onTrigger = handler;
  }

  /** Restore persisted jobs and start their cron timers */
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const persisted: PersistedJob[] = JSON.parse(raw);
      for (const p of persisted) {
        this.startJob(p.id, p.expression, p.description, p.createdAt, p.lastRun, p.runCount);
      }
    } catch { /* ignore corrupt data */ }
  }

  add(expression: string, description: string): CronJob {
    this.initialize();
    const id = crypto.randomUUID();
    const meta = this.startJob(id, expression, description, Date.now(), null, 0);
    this.persist();
    this.notify();
    return meta;
  }

  remove(id: string): boolean {
    this.initialize();
    const entry = this.jobs.get(id);
    if (!entry) return false;
    entry.cron.stop();
    this.jobs.delete(id);
    this.persist();
    this.notify();
    return true;
  }

  list(): CronJob[] {
    this.initialize();
    return Array.from(this.jobs.values()).map(({ cron, meta }) => ({
      ...meta,
      nextRun: cron.nextRun()?.getTime() ?? null,
    }));
  }

  clear() {
    this.initialize();
    for (const { cron } of this.jobs.values()) {
      cron.stop();
    }
    this.jobs.clear();
    this.persist();
    this.notify();
  }

  subscribe(listener: CronListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startJob(
    id: string,
    expression: string,
    description: string,
    createdAt: number,
    lastRun: number | null,
    runCount: number,
  ): CronJob {
    const cron = new Cron(expression, () => {
      const entry = this.jobs.get(id);
      if (!entry) return;
      entry.meta.lastRun = Date.now();
      entry.meta.runCount++;
      entry.meta.nextRun = cron.nextRun()?.getTime() ?? null;
      this.persist();
      this.notify();
      this.onTrigger?.(entry.meta);
    });

    const meta: CronJob = {
      id,
      expression,
      description,
      createdAt,
      nextRun: cron.nextRun()?.getTime() ?? null,
      lastRun,
      runCount,
    };

    this.jobs.set(id, { cron, meta });
    return meta;
  }

  private persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      const data: PersistedJob[] = Array.from(this.jobs.values()).map(({ meta }) => ({
        id: meta.id,
        expression: meta.expression,
        description: meta.description,
        createdAt: meta.createdAt,
        lastRun: meta.lastRun,
        runCount: meta.runCount,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  }

  private notify() {
    const jobs = this.list();
    this.listeners.forEach((fn) => fn(jobs));
  }
}

export const cronManager = new CronManager();
