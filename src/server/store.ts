import { LocalTemplateNotifications } from "./template-notifications";
import { ContributionStore } from "./contributions";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type {
  FeedIssue,
  FixOperation,
  MarketplaceSchema,
  EvidenceOrigin,
} from "../engine/model";
import { UsageLog, type Outcome } from "./usage";
import { config } from "./config";
export interface Analysis {
  id: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  original: string;
  issues: FeedIssue[];
  plan: FixOperation[];
  itemCount: number;
  sheetCount: number;
  synthetic: boolean;
  origin?: EvidenceOrigin;
  paidSupportEligible?: boolean;
  schemaSha256?: string;
  mappingSha256?: string;
  schemaSnapshot?: MarketplaceSchema;
  remainingIssues?: FeedIssue[];
  status: "ANALYZED" | "PAID";
  amount: number;
  sessionId?: string;
  checkoutUrl?: string;
  generated?: boolean;
  feedback?: Outcome;
}
export interface TemporaryFileStore {
  get(id: string): Promise<Analysis | undefined>;
  put(record: Analysis): Promise<void>;
  delete(id: string): Promise<void>;
  cleanup(): Promise<void>;
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const opaque = () => randomBytes(32).toString("hex");
const valid = /^[a-f0-9]{64}$/;
export class LocalTemporaryFileStore implements TemporaryFileStore {
  constructor(readonly directory = config().storeDir) {}
  private path(id: string) {
    if (!valid.test(id))
      throw new Error("Analysis link is invalid. Upload your file again.");
    return join(this.directory, id + ".json");
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }
  async get(id: string) {
    await this.init();
    try {
      const record = JSON.parse(
        await readFile(this.path(id), "utf8"),
      ) as Analysis;
      if (record.expiresAt <= Date.now()) {
        await this.delete(id);
        return undefined;
      }
      return record;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw e;
    }
  }
  async put(record: Analysis) {
    await this.init();
    const temp = this.path(record.id) + "." + opaque() + ".tmp";
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
    await rename(temp, this.path(record.id));
  }
  async delete(id: string) {
    await unlink(this.path(id)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  async cleanup() {
    await this.init();
    for (const name of await readdir(this.directory)) {
      if (/^[a-f0-9]{64}\.json$/.test(name)) {
        await this.get(name.slice(0, 64));
      } else if (/^[a-f0-9]{64}\.[a-f0-9]{64}\.tmp$/.test(name)) {
        const p = join(this.directory, name);
        if (Date.now() - (await stat(p)).mtimeMs > 60000)
          await unlink(p).catch(() => {});
      }
    }
  }
  async capacity(incoming: number) {
    await this.cleanup();
    let bytes = 0,
      count = 0;
    for (const name of await readdir(this.directory))
      if (name.endsWith(".json")) {
        count++;
        bytes += (await stat(join(this.directory, name))).size;
      }
    if (count >= 50 || bytes + incoming > 256 * 1024 * 1024)
      throw new Error(
        "FeedFix is processing its current capacity. Please retry in a few minutes.",
      );
  }
}
export const store = new LocalTemporaryFileStore();
let queue: Promise<unknown> = Promise.resolve();
export function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation);
  queue = task.catch(() => {});
  return task;
}
export async function authorize(id: string, token: string) {
  const record = await store.get(id);
  if (!record)
    throw new Error("This analysis expired. Upload the original file again.");
  const supplied = Buffer.from(tokenHash(token)),
    expected = Buffer.from(record.tokenHash);
  if (
    !token ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new Error("This download link is invalid. Return to your analysis.");
  return record;
}
let started = false;
export function startCleanup() {
  if (started) return;
  started = true;
  const sweep = async () => {
    const results = await Promise.allSettled([
      store.cleanup(),
      new UsageLog().cleanup(),
      new ContributionStore().cleanup(),
      new LocalTemplateNotifications().cleanup(),
    ]);
    if (results[3].status === "rejected")
      console.warn(JSON.stringify({ event: "notification_cleanup_failed" }));
    if (results[2].status === "rejected")
      console.warn(JSON.stringify({ event: "study_cleanup_failed" }));
  };
  void exclusive(sweep).catch(() => {});
  setInterval(() => void exclusive(sweep).catch(() => {}), 30000).unref();
}
