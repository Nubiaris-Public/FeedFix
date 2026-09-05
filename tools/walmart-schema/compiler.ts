import {
  mkdirSync,
  writeFileSync,
  existsSync,
  renameSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { scan, omitAt, productPath, type Frame, type Visitor } from "./stream";
import {
  canonical,
  digest,
  CompiledGraph,
  type GraphNode,
  type GraphValue,
  type CompiledManifest,
} from "../../src/engine/compiled-graph";
const compilerVersion = "1.0.0";
const rules = new Set([
  "required",
  "enum",
  "const",
  "type",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "contains",
  "minProperties",
  "maxProperties",
  "additionalProperties",
  "additionalItems",
  "propertyNames",
  "dependencies",
  "dependentRequired",
  "dependentSchemas",
  "if",
  "then",
  "else",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "$ref",
]);
function inventory() {
  const counts: Record<string, number> = { fields: 0, productTypes: 0 };
  const products: Record<string, string> = {};
  const examples: Record<string, string[]> = {};
  const sampleValues: Record<string, unknown[]> = {};
  let schemaVersion = "";
  const topLevelKeys: string[] = [];
  const add = (key: string, path: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
    if ((examples[key] ??= []).length < 3) examples[key].push(path);
  };
  const visitor: Visitor = {
    key(frame, key) {
      if (frame.path === "#") topLevelKeys.push(key);
      if (frame.context === "schema") add(key, frame.path + "/" + key);
      if (frame.context === "map" && frame.path.endsWith("/properties"))
        counts.fields++;
      if (frame.path === productPath) {
        products[key] =
          frame.path + "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
        counts.productTypes++;
      }
    },
    scalar(path, value, parent) {
      const kind = path.endsWith("/enum/0")
        ? "enum"
        : parent?.context === "schema"
          ? parent.key
          : "";
      if (kind && (sampleValues[kind] ??= []).length < 3)
        sampleValues[kind].push({
          path,
          value: typeof value === "string" ? value.slice(0, 160) : value,
        });
      if (path === "#/properties/MPItemFeedHeader/properties/version/enum/0")
        schemaVersion = String(value);
    },
  };
  return {
    visitor,
    counts,
    products,
    examples,
    sampleValues,
    topLevelKeys,
    get schemaVersion() {
      return schemaVersion;
    },
  };
}
export async function inspect(input: string) {
  const info = inventory();
  const file = await scan(input, info.visitor);
  return {
    ...file,
    schemaVersion: info.schemaVersion,
    topLevelKeys: info.topLevelKeys,
    counts: info.counts,
    examples: info.examples,
    sampleValues: info.sampleValues,
    productTypes: Object.keys(info.products),
  };
}
export async function compile(input: string, output: string) {
  if (existsSync(output))
    throw new Error("Output exists; use a new version directory");
  const nodes = new Map<string, string>();
  const frames: {
    frame: Frame;
    entries: [string, GraphValue][];
    items: GraphValue[];
    skip: boolean;
  }[] = [];
  let root: GraphValue = null,
    bytes = 0;
  const info = inventory();
  const omissions: CompiledManifest["omissions"] = {};
  const put = (value: GraphValue, parent?: Frame) => {
    const p = frames.at(-1);
    if (!p || !parent) {
      root = value;
      return;
    }
    if (p.skip) return;
    if (omitAt(parent, parent.key)) return;
    if (parent.array) p.items.push(value);
    else p.entries.push([parent.key, value]);
  };
  const file = await scan(input, {
    key(frame, key) {
      info.visitor.key?.(frame, key);
      if (omitAt(frame, key)) {
        const item = (omissions[key] ??= {
          count: 0,
          reason:
            "Schema annotation only; no machine-readable assertion. Prose is not interpreted as a validation rule.",
        });
        item.count++;
      }
    },
    open(frame, parent) {
      frames.push({
        frame,
        entries: [],
        items: [],
        skip: Boolean(
          frames.at(-1)?.skip || (parent && omitAt(parent, parent.key)),
        ),
      });
    },
    scalar(path, value, parent) {
      info.visitor.scalar?.(path, value, parent);
      put(value, parent);
    },
    close(frame, parent) {
      const current = frames.pop()!;
      if (current.skip) return;
      current.entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const node: GraphNode = frame.array
        ? { kind: "array", items: current.items }
        : { kind: "object", entries: current.entries };
      const json = canonical(node);
      if (json.length > 2 * 1024 * 1024)
        throw new Error("Normalized node exceeds 2 MiB");
      const ref = digest(json);
      if (!nodes.has(ref)) {
        nodes.set(ref, json);
        bytes += Buffer.byteLength(json);
      }
      if (bytes > 128 * 1024 * 1024 || nodes.size > 300000)
        throw new Error(
          "Compiler graph budget exceeded; use a disk-backed index for this source",
        );
      put({ ref }, parent);
    },
  });
  if (!info.schemaVersion || !Object.keys(info.products).length)
    throw new Error(
      "Unrecognized MP_ITEM schema structure; inspect before adapting compiler",
    );
  const staging = output + ".tmp-" + process.pid;
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(join(staging, "nodes"), { recursive: true });
  try {
    const shards: Record<string, string> = {};
    const indexes: Record<string, string> = {};
    for (let i = 0; i < 256; i++) {
      const prefix = i.toString(16).padStart(2, "0");
      const entries = [...nodes]
        .filter(([h]) => h.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : 1));
      if (!entries.length) continue;
      let offset = 1;
      const index: Record<string, [number, number]> = {};
      const content =
        "{" +
        entries
          .map(([key, json], position) => {
            const prefix = (position ? "," : "") + JSON.stringify(key) + ":";
            offset += Buffer.byteLength(prefix);
            index[key] = [offset, Buffer.byteLength(json)];
            offset += Buffer.byteLength(json);
            return prefix + json;
          })
          .join("") +
        "}\n";
      const indexBytes = canonical(index) + "\n";
      writeFileSync(join(staging, "nodes", prefix + ".index.json"), indexBytes);
      indexes[prefix] = digest(indexBytes);
      if (Buffer.byteLength(content) > 4 * 1024 * 1024)
        throw new Error("Shard budget exceeded");
      writeFileSync(join(staging, "nodes", prefix + ".json"), content);
      shards[prefix] = digest(content);
    }
    const productBytes =
      canonical(
        Object.fromEntries(
          Object.entries(info.products).sort(([a], [b]) => (a < b ? -1 : 1)),
        ),
      ) + "\n";
    writeFileSync(join(staging, "product-types.json"), productBytes);
    const manifest: CompiledManifest = {
      format: "feedfix-schema-graph-v1",
      source: "WALMART_OFFICIAL_SCHEMA",
      schemaVersion: info.schemaVersion,
      ...file,
      compilerVersion,
      root,
      productTypeCount: info.counts.productTypes,
      fieldCount: info.counts.fields,
      ruleCount: Object.entries(info.counts)
        .filter(([k]) => rules.has(k))
        .reduce((n, [, v]) => n + v, 0),
      nodeCount: nodes.size,
      sourceStats: info.counts,
      omissions,
      shards,
      indexes,
      productTypesSha256: digest(productBytes),
    };
    writeFileSync(
      join(staging, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    renameSync(staging, output);
    return { ...manifest, compiledBytes: bytes };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
// Independent verifier: follows source tokens against persisted graph values. It never
// calls the compiler or its interning/normalization code. Every retained scalar, key,
// container type and length must match, even when high-level statistics are unchanged.
export async function verify(input: string, directory: string) {
  const graph = new CompiledGraph(directory, 120000);
  const info = inventory();
  const stack: { value: GraphValue; skip: boolean }[] = [];
  const valueAt = (parent?: Frame) =>
    !parent
      ? graph.manifest.root
      : graph.child(
          stack.at(-1)!.value,
          parent.array ? String(parent.count) : parent.key,
        );
  let compared = 0;
  const omittedCounts: Record<string, number> = {};
  const file = await scan(input, {
    key(frame, key) {
      info.visitor.key?.(frame, key);
      if (omitAt(frame, key))
        omittedCounts[key] = (omittedCounts[key] ?? 0) + 1;
    },
    open(frame, parent) {
      const skip = Boolean(
        stack.at(-1)?.skip || (parent && omitAt(parent, parent.key)),
      );
      const value = skip ? null : valueAt(parent);
      stack.push({ value, skip });
      if (
        !skip &&
        graph.node(value).kind !== (frame.array ? "array" : "object")
      )
        throw new Error("Container mismatch at " + frame.path);
    },
    scalar(path, value, parent) {
      info.visitor.scalar?.(path, value, parent);
      if (parent?.context === "schema" && parent.key === "$ref") {
        if (typeof value !== "string" || !value.startsWith("#/"))
          throw new Error(
            "Unsupported external or anchor reference at " + path,
          );
        graph.at(value);
      }
      if (stack.at(-1)?.skip || (parent && omitAt(parent, parent.key))) return;
      if (valueAt(parent) !== value)
        throw new Error("Value mismatch at " + path);
      compared++;
    },
    close(frame) {
      const current = stack.pop()!;
      if (current.skip) return;
      const node = graph.node(current.value);
      const length =
        node.kind === "array" ? node.items.length : node.entries.length;
      const expected = frame.array
        ? frame.count
        : [...frame.keys].filter((k) => !omitAt(frame, k)).length;
      if (length !== expected)
        throw new Error("Lost or added entries at " + frame.path);
    },
  });
  const m = graph.manifest;
  if (
    file.sourceSha256 !== m.sourceSha256 ||
    file.sourceBytes !== m.sourceBytes ||
    info.schemaVersion !== m.schemaVersion ||
    canonical(info.counts) !== canonical(m.sourceStats) ||
    m.fieldCount !== info.counts.fields ||
    m.productTypeCount !== info.counts.productTypes ||
    m.ruleCount !==
      Object.entries(info.counts)
        .filter(([k]) => rules.has(k))
        .reduce((n, [, v]) => n + v, 0)
  )
    throw new Error("Manifest source statistics mismatch");
  if (
    canonical(Object.entries(graph.productTypes()).sort()) !==
    canonical(Object.entries(info.products).sort())
  )
    throw new Error("Product associations mismatch");
  if (
    canonical(Object.entries(omittedCounts).sort()) !==
    canonical(
      Object.entries(m.omissions)
        .map(([k, v]) => [k, v.count])
        .sort(),
    )
  )
    throw new Error("Omission audit mismatch");
  let nodeCount = 0;
  for (const name of readdirSync(join(directory, "nodes")).filter(
    (n) => !n.endsWith(".index.json"),
  )) {
    const prefix = name.replace(/\.json$/, "");
    const data = readFileSync(join(directory, "nodes", name));
    if (digest(data) !== m.shards[prefix])
      throw new Error("Unexpected or changed shard");
    for (const [ref, node] of Object.entries(JSON.parse(data.toString()))) {
      if (digest(canonical(node)) !== ref)
        throw new Error("Node hash mismatch");
      nodeCount++;
    }
  }
  if (nodeCount !== m.nodeCount) throw new Error("Node count mismatch");
  return {
    status: "PASS",
    sourceSha256: file.sourceSha256,
    comparedScalars: compared,
    source: info.counts,
    compiled: info.counts,
    omissions: m.omissions,
  };
}
