import { supportedNumber } from "../../src/engine/numeric";
import { createReadStream, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { parser } from "stream-json/parser.js";

export type Scalar = string | number | boolean | null;
export type Context = "schema" | "map" | "schemas" | "plain";
export interface Frame {
  path: string;
  context: Context;
  array: boolean;
  key: string;
  count: number;
  keys: Set<string>;
}
export const escapePointer = (s: string) =>
  s.replace(/~/g, "~0").replace(/\//g, "~1");
export const productPath =
  "#/properties/MPItem/items/properties/Visible/properties";
export const omitted = new Set(["description", "examples"]);
export function omitAt(frame: Frame, key: string) {
  return frame.context === "schema" && omitted.has(key);
}
function context(
  parent: Frame | undefined,
  key: string,
  array: boolean,
): Context {
  if (!parent) return "schema";
  if (parent.context === "map" || parent.context === "schemas")
    return array ? "plain" : "schema";
  if (parent.context !== "schema") return "plain";
  if (
    [
      "properties",
      "patternProperties",
      "definitions",
      "$defs",
      "dependencies",
      "dependentSchemas",
    ].includes(key)
  )
    return "map";
  if (["allOf", "anyOf", "oneOf", "prefixItems"].includes(key))
    return "schemas";
  if (
    [
      "items",
      "additionalItems",
      "additionalProperties",
      "contains",
      "propertyNames",
      "not",
      "if",
      "then",
      "else",
    ].includes(key)
  )
    return array ? "schemas" : "schema";
  return "plain";
}
export interface Visitor {
  open?(frame: Frame, parent?: Frame): void;
  key?(frame: Frame, key: string): void;
  scalar?(path: string, value: Scalar, parent?: Frame): void;
  close?(frame: Frame, parent?: Frame): void;
}
export async function scan(input: string, visitor: Visitor) {
  const hash = createHash("sha256");
  const stack: Frame[] = [];
  let roots = 0;
  const source = createReadStream(input, { highWaterMark: 64 * 1024 });
  source.on("data", (chunk) => hash.update(chunk));
  const position = () => {
    const p = stack.at(-1);
    return p ? `${p.path}/${p.array ? p.count : escapePointer(p.key)}` : "#";
  };
  const done = () => {
    const p = stack.at(-1);
    if (p) p.count++;
    else roots++;
  };
  await pipeline(
    source,
    parser.asStream({ streamValues: false }),
    new Writable({
      objectMode: true,
      write(token: { name: string; value?: string }, _, cb) {
        try {
          const parent = stack.at(-1);
          if (token.name === "keyValue") {
            if (!parent || parent.array) throw new Error("Invalid JSON key");
            const key = token.value!;
            if (key.length > 16384 || parent.keys.has(key))
              throw new Error("Duplicate or oversized JSON key");
            parent.keys.add(key);
            parent.key = key;
            visitor.key?.(parent, key);
          } else if (
            token.name === "startObject" ||
            token.name === "startArray"
          ) {
            if (stack.length >= 128)
              throw new Error("Schema nesting exceeds 128");
            const array = token.name === "startArray";
            const frame: Frame = {
              path: position(),
              context: context(parent, parent?.key ?? "", array),
              array,
              key: "",
              count: 0,
              keys: new Set(),
            };
            visitor.open?.(frame, parent);
            stack.push(frame);
          } else if (token.name === "endObject" || token.name === "endArray") {
            const frame = stack.pop()!;
            visitor.close?.(frame, stack.at(-1));
            done();
          } else if (
            [
              "stringValue",
              "numberValue",
              "trueValue",
              "falseValue",
              "nullValue",
            ].includes(token.name)
          ) {
            const value: Scalar =
              token.name === "numberValue"
                ? supportedNumber(token.value!)
                : token.name === "trueValue"
                  ? true
                  : token.name === "falseValue"
                    ? false
                    : token.name === "nullValue"
                      ? null
                      : token.value!;
            if (typeof value === "string" && value.length > 2 * 1024 * 1024)
              throw new Error("Schema scalar exceeds 2 MiB");
            if (
              typeof value === "number" &&
              (!Number.isFinite(value) ||
                (Number.isInteger(value) && !Number.isSafeInteger(value)))
            )
              throw new Error("Unsupported numeric precision");
            visitor.scalar?.(position(), value, parent);
            done();
          }
          cb();
        } catch (error) {
          cb(error as Error);
        }
      },
    }),
  );
  if (roots !== 1 || stack.length)
    throw new Error("Expected exactly one JSON document");
  return {
    sourceSha256: hash.digest("hex"),
    sourceBytes: statSync(input).size,
  };
}
