import {
  mkdir,
  realpath,
  lstat,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { contributionDirectory } from "./contributions";
import {
  NOTIFICATION_CONSENT_VERSION,
  NOTIFICATION_RETENTION_DAYS,
} from "../shared/upload-result";
export const notificationInput = z
  .object({
    email: z.string().trim().max(254).email(),
    consentVersion: z.literal(NOTIFICATION_CONSENT_VERSION),
    studyId: z.string().regex(/^[a-f0-9]{32}$/),
    deleteToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
// Reserve a minute for the existing 30-second cleanup sweep.
const ttl = NOTIFICATION_RETENTION_DAYS * 86400000 - 60000;
const recordSchema = z
  .object({
    email: z.string().email().max(254),
    templateKey: z.string().regex(/^[a-f0-9]{64}$/),
    declaredVersion: z.string().regex(/^5\.0\.\d{8}-\d{2}_\d{2}_\d{2}$/),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.number(),
    expiresAt: z.number(),
    consentVersion: z.literal(NOTIFICATION_CONSENT_VERSION),
  })
  .strict();
export interface TemplateNotificationRequests {
  request(
    input: z.infer<typeof notificationInput>,
    template: { templateKey: string; declaredVersion: string },
  ): Promise<{ status: "SAVED"; expiresAt: string }>;
}
/** Private callback queue, not a mailing list. No mail transport is invoked. */
export class LocalTemplateNotifications implements TemplateNotificationRequests {
  constructor(
    readonly directory = process.env.NOTIFICATION_STORE_DIR ||
      ".feedfix-notifications",
  ) {}
  private async root() {
    const root = resolve(this.directory);
    const overlaps = (a: string, b: string) => {
      const p = relative(a, b);
      return !p || (!p.startsWith("..") && !isAbsolute(p));
    };
    if (
      root.split("/").filter(Boolean).length < 2 ||
      [
        resolve("public"),
        resolve(process.env.TEMP_STORE_DIR || ".feedfix"),
        resolve(contributionDirectory()),
      ].some((p) => overlaps(p, root) || overlaps(root, p))
    )
      throw Error("Notification storage must be private and separate");
    await mkdir(root, { recursive: true, mode: 0o700 });
    if ((await realpath(root)) !== root)
      throw Error("Invalid notification storage");
    return root;
  }
  private async read(path: string) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048)
      throw Error("Invalid notification storage");
    return recordSchema.parse(JSON.parse(await readFile(path, "utf8")));
  }
  async cleanup(now = Date.now()) {
    const root = await this.root();
    for (const name of await readdir(root)) {
      if (!/^[a-f0-9]{32}\.json(?:\.tmp)?$/.test(name)) continue;
      const path = join(root, name);
      const stat = await lstat(path);
      let expires = stat.mtimeMs + ttl;
      if (name.endsWith(".tmp")) expires = stat.mtimeMs + 60000;
      else
        try {
          const r = await this.read(path);
          expires = Math.min(expires, r.createdAt + ttl, r.expiresAt);
        } catch {
          /* Malformed entries still expire. */
        }
      if (expires <= now) await unlink(path);
    }
  }
  async request(
    input: z.infer<typeof notificationInput>,
    template: { templateKey: string; declaredVersion: string },
  ) {
    const validated = notificationInput.parse(input);
    const root = await this.root();
    await this.cleanup();
    const path = join(root, validated.studyId + ".json");
    let existing;
    try {
      existing = await this.read(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (existing) {
      if (
        existing.tokenHash !== digest(validated.deleteToken) ||
        existing.email !== validated.email ||
        existing.templateKey !== template.templateKey
      )
        throw Error(
          "This template already has a notification request. Delete it before changing the address.",
        );
      return {
        status: "SAVED" as const,
        expiresAt: new Date(existing.expiresAt).toISOString(),
      };
    }
    const records = (await readdir(root)).filter((n) =>
      /^[a-f0-9]{32}\.json$/.test(n),
    );
    if (records.length >= 1000)
      throw Error(
        "Notification requests are temporarily full. Please try again later.",
      );
    const now = Date.now();
    const record = recordSchema.parse({
      email: validated.email,
      ...template,
      tokenHash: digest(validated.deleteToken),
      createdAt: now,
      expiresAt: now + ttl,
      consentVersion: NOTIFICATION_CONSENT_VERSION,
    });
    // Shared HTTP mutation queue serializes writes; no permanent content-derived IDs in analytics.
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
  async delete(id: string, token: string) {
    if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{64}$/.test(token))
      throw Error("This deletion link is invalid.");
    const root = await this.root();
    await this.cleanup();
    const path = join(root, id + ".json");
    let record;
    try {
      record = await this.read(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    if (
      !timingSafeEqual(
        Buffer.from(record.tokenHash, "hex"),
        Buffer.from(digest(token), "hex"),
      )
    )
      throw Error("This deletion link is invalid.");
    await unlink(path);
  }
}
