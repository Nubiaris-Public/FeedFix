import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
export type Scalar = string | number | boolean | null;
export type GraphValue = Scalar | { ref: string };
export type GraphNode =
  | { kind: "object"; entries: [string, GraphValue][] }
  | { kind: "array"; items: GraphValue[] };
export const digest = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
export const canonical = (value: unknown): string => JSON.stringify(value);
export interface CompiledManifest {
  format: "feedfix-schema-graph-v1";
  source: "WALMART_OFFICIAL_SCHEMA";
  schemaVersion: string;
  sourceSha256: string;
  sourceBytes: number;
  compilerVersion: string;
  root: GraphValue;
  productTypeCount: number;
  fieldCount: number;
  ruleCount: number;
  nodeCount: number;
  sourceStats: Record<string, number>;
  omissions: Record<string, { count: number; reason: string }>;
  shards: Record<string, string>;
  indexes: Record<string, string>;
  productTypesSha256: string;
}
export function readBoundedJson(file: string, max = 4 * 1024 * 1024) {
  if (statSync(file).size > max)
    throw new Error("Compiled artifact exceeds size limit");
  return JSON.parse(readFileSync(file, "utf8"));
}
export class CompiledGraph {
  readonly manifest: CompiledManifest;
  private lookups = new WeakMap<GraphNode, Map<string, GraphValue>>();
  private cache = new Map<string, GraphNode>();
  private indexes = new Map<string, Record<string, [number, number]>>();
  constructor(
    readonly directory: string,
    private readonly cacheLimit = 20000,
  ) {
    this.manifest = readBoundedJson(join(directory, "manifest.json"));
    if (
      this.manifest.format !== "feedfix-schema-graph-v1" ||
      this.manifest.compilerVersion !== "1.0.0" ||
      !/^([a-f0-9]{64})$/.test(this.manifest.sourceSha256)
    )
      throw new Error("Unsupported compiled schema manifest");
  }
  node(value: GraphValue): GraphNode {
    if (
      !value ||
      typeof value !== "object" ||
      !/^([a-f0-9]{64})$/.test(value.ref)
    )
      throw new Error("Invalid compiled node reference");
    const cached = this.cache.get(value.ref);
    if (cached) return cached;
    const prefix = value.ref.slice(0, 2);
    let index = this.indexes.get(prefix);
    const file = join(this.directory, "nodes", prefix + ".json");
    if (!index) {
      const indexFile = join(this.directory, "nodes", prefix + ".index.json");
      if (
        statSync(indexFile).size > 1024 * 1024 ||
        statSync(file).size > 4 * 1024 * 1024
      )
        throw new Error("Compiled shard exceeds limit");
      const bytes = readFileSync(indexFile);
      if (
        digest(bytes) !== this.manifest.indexes[prefix] ||
        digest(readFileSync(file)) !== this.manifest.shards[prefix]
      )
        throw new Error("Compiled shard checksum mismatch");
      index = JSON.parse(bytes.toString()) as Record<string, [number, number]>;
      this.indexes.set(prefix, index);
    }
    const location = index[value.ref];
    if (
      !location ||
      !Number.isSafeInteger(location[0]) ||
      !Number.isSafeInteger(location[1]) ||
      location[0] < 0 ||
      location[1] < 1 ||
      location[1] > 2 * 1024 * 1024
    )
      throw new Error("Invalid compiled node location");
    const data = Buffer.alloc(location[1]);
    const fd = openSync(file, "r");
    try {
      if (readSync(fd, data, 0, data.length, location[0]) !== data.length)
        throw new Error("Truncated compiled node");
    } finally {
      closeSync(fd);
    }
    if (digest(data) !== value.ref)
      throw new Error("Compiled node checksum mismatch");
    const node = JSON.parse(data.toString()) as GraphNode;
    if (this.cache.size >= this.cacheLimit)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(value.ref, node);
    return node;
  }
  child(value: GraphValue, key: string): GraphValue {
    const node = this.node(value);
    let lookup = this.lookups.get(node);
    if (node.kind === "object" && !lookup) {
      lookup = new Map(node.entries);
      this.lookups.set(node, lookup);
    }
    const found =
      node.kind === "array" ? node.items[Number(key)] : lookup!.get(key);
    if (found === undefined) throw new Error("Missing compiled path: " + key);
    return found;
  }
  at(pointer: string): GraphValue {
    if (pointer === "#") return this.manifest.root;
    if (!pointer.startsWith("#/"))
      throw new Error("Only local JSON pointers are supported");
    return pointer
      .slice(2)
      .split("/")
      .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce((v, k) => this.child(v, k), this.manifest.root);
  }
  materialize(value: GraphValue, budget = { nodes: 0 }): unknown {
    if (++budget.nodes > 100000)
      throw new Error("Selected schema exceeds runtime expansion budget");
    if (!value || typeof value !== "object") return value;
    const node = this.node(value);
    return node.kind === "array"
      ? node.items.map((v) => this.materialize(v, budget))
      : Object.fromEntries(
          node.entries.map(([k, v]) => [k, this.materialize(v, budget)]),
        );
  }
  productTypes(): Record<string, string> {
    const file = join(this.directory, "product-types.json");
    if (statSync(file).size > 1024 * 1024)
      throw new Error("Product index exceeds limit");
    const bytes = readFileSync(file);
    if (digest(bytes) !== this.manifest.productTypesSha256)
      throw new Error("Product index checksum mismatch");
    return JSON.parse(bytes.toString());
  }
}
