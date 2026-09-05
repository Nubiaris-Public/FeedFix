import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
  rmdir,
  lstat,
  realpath,
} from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseWorkbook } from "../engine/workbook";
import {
  CONTRIBUTION_CONSENT_VERSION,
  CONTRIBUTION_CONSENT_TEXT,
  CONTRIBUTION_TTL_MS,
  type ContributionReceipt,
} from "../shared/contribution-consent";
export { CONTRIBUTION_CONSENT_VERSION } from "../shared/contribution-consent";
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
const identifier = /^[a-f0-9]{32}$/;
const metadataSchema = z.object({
  id: z.string().regex(identifier),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  origin: z.literal("UNKNOWN"),
  reviewStatus: z.literal("PENDING"),
  schemaVersion: z.null(),
  createdAt: z.number(),
  expiresAt: z.number(),
  deleteTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  consent: z.object({
    version: z.literal(CONTRIBUTION_CONSENT_VERSION),
    text: z.literal(CONTRIBUTION_CONSENT_TEXT),
    acceptedAt: z.number(),
  }),
});
export function contributionDirectory() {
  return process.env.CORPUS_STORE_DIR || ".feedfix-study";
}
function overlaps(a: string, b: string) {
  const p = relative(a, b);
  return p === "" || (!p.startsWith("..") && !isAbsolute(p));
}
/** Calls share the application's single-instance exclusive mutation queue. */
export class ContributionStore {
  constructor(readonly directory = contributionDirectory()) {}
  private async root() {
    const root = resolve(this.directory),
      temporary = resolve(process.env.TEMP_STORE_DIR || ".feedfix"),
      publicDir = resolve("public");
    if (
      root.split("/").filter(Boolean).length < 2 ||
      overlaps(root, temporary) ||
      overlaps(temporary, root) ||
      overlaps(publicDir, root) ||
      overlaps(root, publicDir)
    )
      throw new Error(
        "Study storage must be private and separate from temporary files",
      );
    await mkdir(root, { recursive: true, mode: 0o700 });
    if ((await realpath(root)) !== root)
      throw new Error("Study storage cannot use symlinked paths");
    return root;
  }
  private async remove(root: string, id: string) {
    if (!identifier.test(id) && !/^\.pending-[a-f0-9]{32}$/.test(id))
      throw new Error("Invalid study identifier");
    const dir = join(root, id);
    const info = await lstat(dir).catch((e) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    });
    if (!info) return;
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Invalid study storage entry");
    for (const name of ["original.xlsx", "metadata.json"])
      await unlink(join(dir, name)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    await rmdir(dir);
  }
  async cleanup(now = Date.now()) {
    const root = await this.root();
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (/^\.pending-[a-f0-9]{32}$/.test(entry.name)) {
        if (
          (await lstat(join(root, entry.name))).mtimeMs + CONTRIBUTION_TTL_MS <=
          now
        )
          await this.remove(root, entry.name);
      } else if (identifier.test(entry.name)) {
        const created = (await lstat(join(root, entry.name))).mtimeMs;
        let expiresAt = created + CONTRIBUTION_TTL_MS;
        try {
          const metadata = metadataSchema.parse(
            JSON.parse(
              await readFile(join(root, entry.name, "metadata.json"), "utf8"),
            ),
          );
          expiresAt = Math.min(
            expiresAt,
            metadata.expiresAt,
            metadata.createdAt + CONTRIBUTION_TTL_MS,
          );
        } catch {
          // A damaged receipt must not prevent expiry of this or other copies.
        }
        if (expiresAt <= now) await this.remove(root, entry.name);
      }
    }
  }
  async save(
    original: Buffer,
    consentVersion?: string,
  ): Promise<ContributionReceipt> {
    if (consentVersion !== CONTRIBUTION_CONSENT_VERSION)
      return { status: "not_requested" };
    // Safe package parsing deliberately precedes template matching: unknown layouts
    // can be studied, while macros, unsafe ZIP/XML and external links are refused.
    parseWorkbook(original);
    const root = await this.root();
    await this.cleanup();
    const maxFiles = z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .parse(process.env.CORPUS_MAX_FILES || "50");
    const maxBytes =
      z.coerce
        .number()
        .int()
        .min(1)
        .max(1024)
        .parse(process.env.CORPUS_MAX_MB || "256") *
      1024 *
      1024;
    let total = 0,
      count = 0;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && identifier.test(entry.name)) {
        count++;
        total += (await lstat(join(root, entry.name, "original.xlsx"))).size;
      }
    }
    if (count >= maxFiles || total + original.length > maxBytes)
      throw new Error("Study collection capacity reached");
    const id = randomBytes(16).toString("hex"),
      deleteToken = randomBytes(32).toString("hex");
    const createdAt = Date.now(),
      expiresAt = createdAt + CONTRIBUTION_TTL_MS;
    const metadata = metadataSchema.parse({
      id,
      sourceSha256: hash(original),
      bytes: original.length,
      origin: "UNKNOWN",
      reviewStatus: "PENDING",
      schemaVersion: null,
      createdAt,
      expiresAt,
      deleteTokenHash: hash(deleteToken),
      consent: {
        version: CONTRIBUTION_CONSENT_VERSION,
        text: CONTRIBUTION_CONSENT_TEXT,
        acceptedAt: createdAt,
      },
    });
    const pending = ".pending-" + id;
    await mkdir(join(root, pending), { mode: 0o700 });
    try {
      await writeFile(join(root, pending, "original.xlsx"), original, {
        mode: 0o600,
        flag: "wx",
      });
      await writeFile(
        join(root, pending, "metadata.json"),
        JSON.stringify(metadata, null, 2) + "\n",
        { mode: 0o600, flag: "wx" },
      );
      await rename(join(root, pending), join(root, id));
    } catch (error) {
      await this.remove(root, pending);
      throw error;
    }
    return {
      status: "saved",
      id,
      deleteToken,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }
  async delete(id: string, token: string) {
    if (!identifier.test(id) || !/^[a-f0-9]{64}$/.test(token))
      throw new Error("This study deletion link is invalid.");
    const root = await this.root();
    await this.cleanup();
    const path = join(root, id);
    const info = await lstat(path).catch((e) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    });
    if (!info) return; // Already expired/deleted; do not reveal its former existence.
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("This study deletion link is invalid.");
    const metadata = metadataSchema.parse(
      JSON.parse(await readFile(join(path, "metadata.json"), "utf8")),
    );
    if (
      !timingSafeEqual(
        Buffer.from(hash(token), "hex"),
        Buffer.from(metadata.deleteTokenHash, "hex"),
      )
    )
      throw new Error("This study deletion link is invalid.");
    await this.remove(root, id);
  }
  async list() {
    const root = await this.root();
    await this.cleanup();
    const results = [];
    for (const name of await readdir(root))
      if (identifier.test(name)) {
        const info = await lstat(join(root, name));
        if (!info.isDirectory() || info.isSymbolicLink()) continue;
        const m = metadataSchema.parse(
          JSON.parse(await readFile(join(root, name, "metadata.json"), "utf8")),
        );
        results.push({
          id: m.id,
          sourceSha256: m.sourceSha256,
          bytes: m.bytes,
          origin: m.origin,
          createdAt: new Date(m.createdAt).toISOString(),
          expiresAt: new Date(m.expiresAt).toISOString(),
        });
      }
    return results;
  }
  async inspect(id: string) {
    if (!identifier.test(id)) throw new Error("Invalid study identifier");
    const root = await this.root();
    await this.cleanup();
    const info = await lstat(join(root, id));
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Invalid study entry");
    const bytes = await readFile(join(root, id, "original.xlsx"));
    const metadata = metadataSchema.parse(
      JSON.parse(await readFile(join(root, id, "metadata.json"), "utf8")),
    );
    if (hash(bytes) !== metadata.sourceSha256)
      throw new Error("Study copy checksum mismatch");
    const workbook = parseWorkbook(bytes);
    return {
      id,
      origin: metadata.origin,
      expiresAt: new Date(metadata.expiresAt).toISOString(),
      sheets: workbook.sheets.map((s) => ({
        name: s.name,
        cells: s.cells.size,
        formulas: [...s.cells.values()].filter((c) => c.formula).length,
      })),
    };
  }
}
