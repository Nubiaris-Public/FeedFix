import {
  mkdir,
  realpath,
  readdir,
  lstat,
  readFile,
  writeFile,
  rename,
  unlink,
  chmod,
} from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { redactMessage, UNKNOWN_CONSENT_VERSION } from "../decoder/input";
export class UnreviewedMessageError extends Error {
  constructor() {
    super("Review the final redacted text before sharing.");
  }
}
export const UNKNOWN_RETENTION_MS = 7 * 86400000 - 60000;
const recordSchema = z
  .object({
    message: z.string().min(1).max(4000),
    consentVersion: z.literal(UNKNOWN_CONSENT_VERSION),
    createdAt: z.number().finite(),
    expiresAt: z.number().finite(),
  })
  .strict();
/** Single-process, private review queue. No original text, request metadata or public reads. */
export class UnknownErrorStore {
  constructor(
    readonly directory = process.env.UNKNOWN_ERROR_STORE_DIR ||
      ".feedfix-errors",
  ) {}
  private async root(create = false) {
    const root = resolve(this.directory);
    const contains = (a: string, b: string) => {
      const p = relative(a, b);
      return !p || (!p.startsWith("..") && !isAbsolute(p));
    };
    const reserved = [
      "public",
      ".next",
      ".next-e2e",
      ".git",
      "src",
      "data",
      process.env.TEMP_STORE_DIR || ".feedfix",
      process.env.CORPUS_STORE_DIR || ".feedfix-study",
      process.env.NOTIFICATION_STORE_DIR || ".feedfix-notifications",
      process.env.USAGE_LOG_PATH || ".feedfix-metrics/usage.json",
    ].map((p) => resolve(p));
    if (
      root.split("/").filter(Boolean).length < 2 ||
      contains(root, resolve(".")) ||
      reserved.some((p) => contains(p, root) || contains(root, p))
    )
      throw new Error("Invalid private error storage");
    if (create) await mkdir(root, { recursive: true, mode: 0o700 });
    try {
      if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory())
        throw new Error("Invalid private error storage");
    } catch (error) {
      if (!create && (error as NodeJS.ErrnoException).code === "ENOENT")
        return null;
      throw error;
    }
    await chmod(root, 0o700);
    return root;
  }
  async cleanup(now = Date.now()) {
    const root = await this.root();
    if (!root) return;
    for (const name of await readdir(root)) {
      if (!/^[a-f0-9]{32}\.json(?:\.tmp)?$/.test(name)) continue;
      const path = join(root, name),
        stat = await lstat(path);
      let expires =
        stat.mtimeMs + (name.endsWith(".tmp") ? 60000 : UNKNOWN_RETENTION_MS);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        await unlink(path);
        continue;
      }
      if (!name.endsWith(".tmp") && stat.size <= 32768) {
        try {
          const record = recordSchema.parse(
            JSON.parse(await readFile(path, "utf8")),
          );
          expires = Math.min(
            expires,
            record.expiresAt,
            record.createdAt + UNKNOWN_RETENTION_MS,
          );
        } catch {
          expires = 0;
        }
      } else if (stat.size > 32768) expires = 0;
      if (expires <= now) await unlink(path);
    }
  }
  // Called under the existing exclusive mutation queue, including periodic cleanup.
  async save(message: string, consentVersion: string) {
    if (consentVersion !== UNKNOWN_CONSENT_VERSION)
      throw new Error("Consent is required");
    const sanitized = redactMessage(message);
    if (sanitized !== message) throw new UnreviewedMessageError();
    await this.cleanup();
    const root = (await this.root(true))!;
    if ((await readdir(root)).length >= 1000)
      throw new Error("Error study storage is full");
    const now = Date.now();
    const record = recordSchema.parse({
      message: sanitized,
      consentVersion,
      createdAt: now,
      expiresAt: now + UNKNOWN_RETENTION_MS,
    });
    const path = join(root, randomBytes(16).toString("hex") + ".json");
    await writeFile(path + ".tmp", JSON.stringify(record), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(path + ".tmp", path);
    return {
      status: "SAVED" as const,
      expiresAt: new Date(record.expiresAt).toISOString(),
    };
  }
}
