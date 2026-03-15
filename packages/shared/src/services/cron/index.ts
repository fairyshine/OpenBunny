import { Cron } from 'croner';
import { getPlatformContext, type IPlatformStorage } from '../../platform';
import type { ScheduledTaskContext } from '../ai/scheduledTaskContext';
import { snapshotScheduledTaskContext } from '../ai/scheduledTaskContext';

export interface CronJob {
  id: string;
  expression: string;
  description: string;
  createdAt: number;
  nextRun: number | null;
  lastRun: number | null;
  runCount: number;
  taskContext?: ScheduledTaskContext;
}

interface PersistedJob {
  id: string;
  expression: string;
  description: string;
  createdAt: number;
  lastRun: number | null;
  runCount: number;
  taskContext?: ScheduledTaskContext;
}

const STORAGE_KEY = 'openbunny-cron-jobs';

type CronListener = (jobs: CronJob[]) => void;

class CronManager {
  private jobs = new Map<string, { cron: Cron; meta: CronJob }>();
  private listeners = new Set<CronListener>();
  private onTrigger: ((job: CronJob) => void) | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  setTriggerHandler(handler: ((job: CronJob) => void) | null) {
    this.onTrigger = handler;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const storage = this.getStorage();
        if (!storage) return;

        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) return;

        const persisted: PersistedJob[] = JSON.parse(raw);
        for (const job of persisted) {
          if (this.jobs.has(job.id)) continue;
          this.startJob(
            job.id,
            job.expression,
            job.description,
            job.createdAt,
            job.lastRun,
            job.runCount,
            job.taskContext,
          );
        }
      } catch {
        // ignore corrupt data or unavailable storage
      } finally {
        this.initialized = true;
        this.initPromise = null;
        this.notify();
      }
    })();

    return this.initPromise;
  }

  async add(expression: string, description: string, taskContext?: ScheduledTaskContext): Promise<CronJob> {
    await this.initialize();
    const id = crypto.randomUUID();
    const meta = this.startJob(id, expression, description, Date.now(), null, 0, taskContext);
    await this.persist();
    this.notify();
    return meta;
  }

  async remove(id: string): Promise<boolean> {
    await this.initialize();
    const entry = this.jobs.get(id);
    if (!entry) return false;
    entry.cron.stop();
    this.jobs.delete(id);
    await this.persist();
    this.notify();
    return true;
  }

  async list(): Promise<CronJob[]> {
    await this.initialize();
    return this.getCurrentJobs();
  }

  async clear(): Promise<void> {
    await this.initialize();
    for (const { cron } of this.jobs.values()) {
      cron.stop();
    }
    this.jobs.clear();
    await this.persist();
    this.notify();
  }

  subscribe(listener: CronListener): () => void {
    this.listeners.add(listener);
    void this.initialize();
    return () => this.listeners.delete(listener);
  }

  private getStorage(): IPlatformStorage | null {
    try {
      return getPlatformContext().storage;
    } catch {
      return null;
    }
  }

  private getCurrentJobs(): CronJob[] {
    return Array.from(this.jobs.values()).map(({ cron, meta }) => ({
      ...meta,
      nextRun: cron.nextRun()?.getTime() ?? null,
    }));
  }

  private startJob(
    id: string,
    expression: string,
    description: string,
    createdAt: number,
    lastRun: number | null,
    runCount: number,
    taskContext?: ScheduledTaskContext,
  ): CronJob {
    const cron = new Cron(expression, () => {
      const entry = this.jobs.get(id);
      if (!entry) return;
      entry.meta.lastRun = Date.now();
      entry.meta.runCount++;
      entry.meta.nextRun = cron.nextRun()?.getTime() ?? null;
      void this.persist();
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
      taskContext: snapshotScheduledTaskContext(taskContext),
    };

    this.jobs.set(id, { cron, meta });
    return meta;
  }

  private async persist(): Promise<void> {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const data: PersistedJob[] = Array.from(this.jobs.values()).map(({ meta }) => ({
        id: meta.id,
        expression: meta.expression,
        description: meta.description,
        createdAt: meta.createdAt,
        lastRun: meta.lastRun,
        runCount: meta.runCount,
        taskContext: snapshotScheduledTaskContext(meta.taskContext),
      }));
      await storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable
    }
  }

  private notify() {
    const jobs = this.getCurrentJobs();
    this.listeners.forEach((fn) => fn(jobs));
  }
}

export const cronManager = new CronManager();
