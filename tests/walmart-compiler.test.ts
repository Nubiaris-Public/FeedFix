import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, inspect, verify } from "../tools/walmart-schema/compiler";

export const sample = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    MPItemFeedHeader: { properties: { version: { enum: ["TEST-27"] } } },
    MPItem: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          Visible: {
            type: "object",
            oneOf: [{ required: ["Test"] }],
            properties: {
              Test: {
                type: "object",
                description: "Display prose",
                required: ["color"],
                properties: {
                  color: {
                    type: "string",
                    enum: ["Red", "Blue", "Green"],
                    minLength: 2,
                    maxLength: 10,
                    pattern: "^[A-Za-z]+$",
                  },
                  weight: { type: "number", minimum: 0, maximum: 10 },
                  tags: {
                    type: "array",
                    minItems: 1,
                    maxItems: 3,
                    uniqueItems: true,
                    items: { type: "string" },
                  },
                  code: { $ref: "#/definitions/code" },
                },
                if: {
                  properties: { color: { const: "Red" } },
                  required: ["color"],
                },
                then: { required: ["weight"] },
              },
            },
          },
        },
      },
    },
  },
  definitions: { code: { type: "string", pattern: "^X" } },
};
it("streams, compiles deterministically and independently rejects tampering", async () => {
  const dir = mkdtempSync(join(tmpdir(), "walmart-compiler-"));
  const input = join(dir, "source.json");
  writeFileSync(input, JSON.stringify(sample));
  const info = await inspect(input);
  expect(info.schemaVersion).toBe("TEST-27");
  await compile(input, join(dir, "a"));
  await compile(input, join(dir, "b"));
  expect(readFileSync(join(dir, "a/manifest.json"))).toEqual(
    readFileSync(join(dir, "b/manifest.json")),
  );
  expect((await verify(input, join(dir, "a"))).status).toBe("PASS");
  const manifest = JSON.parse(
    readFileSync(join(dir, "a/manifest.json"), "utf8"),
  );
  manifest.fieldCount = 0;
  writeFileSync(join(dir, "a/manifest.json"), JSON.stringify(manifest));
  await expect(verify(input, join(dir, "a"))).rejects.toThrow();
});

it("detects semantic mutation even with consistent new graph checksums and unchanged counts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "walmart-mutation-"));
  const input = join(dir, "original.json"),
    changed = join(dir, "changed.json");
  writeFileSync(input, JSON.stringify(sample));
  const bad = structuredClone(sample);
  bad.properties.MPItem.items.properties.Visible.properties.Test.properties.color.enum[0] =
    "Pink";
  writeFileSync(changed, JSON.stringify(bad));
  const original = await compile(input, join(dir, "original"));
  await compile(changed, join(dir, "tampered"));
  const path = join(dir, "tampered/manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.sourceSha256 = original.sourceSha256;
  manifest.sourceBytes = original.sourceBytes;
  writeFileSync(path, JSON.stringify(manifest));
  await expect(verify(input, join(dir, "tampered"))).rejects.toThrow(
    /Value mismatch/,
  );
});
it("preserves description and examples when they are instance data, not annotations", async () => {
  const dir = mkdtempSync(join(tmpdir(), "walmart-literals-"));
  const input = join(dir, "source.json");
  const extra = structuredClone(sample) as unknown as Record<string, unknown>;
  extra.const = { description: "must be preserved", examples: ["literal"] };
  writeFileSync(input, JSON.stringify(extra));
  await compile(input, join(dir, "compiled"));
  expect((await verify(input, join(dir, "compiled"))).status).toBe("PASS");
});
it("rejects duplicate keys and unsafe numeric precision instead of losing data", async () => {
  const dir = mkdtempSync(join(tmpdir(), "walmart-invalid-"));
  const input = join(dir, "source.json");
  writeFileSync(input, '{"type":"object","type":"string"}');
  await expect(inspect(input)).rejects.toThrow(/Duplicate/);
  writeFileSync(input, '{"maximum":9007199254740993}');
  await expect(inspect(input)).rejects.toThrow(/precision/);
});
it("refuses source constraints that underflow rather than silently compiling zero", async () => {
  const input = join(
    mkdtempSync(join(tmpdir(), "walmart-underflow-")),
    "source.json",
  );
  writeFileSync(input, '{"minimum":1e-400}');
  await expect(inspect(input)).rejects.toThrow(/precision/);
});
