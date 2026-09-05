import { supportedNumber } from "./numeric";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { CompiledGraph, type GraphValue } from "./compiled-graph";
import type { MarketplaceSchema, FieldDefinition } from "./model";
const productsPointer =
  "#/properties/MPItem/items/properties/Visible/properties";
const visiblePointer = "#/properties/MPItem/items/properties/Visible";
const escaped = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
export interface RuntimeSchema {
  graph: CompiledGraph;
  validate: ValidateFunction;
  field: (pointer: string) => Record<string, unknown>;
}
const cache = new Map<string, RuntimeSchema>();
export function officialRuntime(schema: MarketplaceSchema): RuntimeSchema {
  if (!schema.compiled) throw new Error("No compiled schema binding");
  const config = schema.compiled;
  const key = JSON.stringify([
    config.directory,
    config.sourceSha256,
    config.productType,
    schema.version,
  ]);
  const previous = cache.get(key);
  if (previous) return previous;
  const graph = new CompiledGraph(config.directory);
  if (
    graph.manifest.sourceSha256 !== config.sourceSha256 ||
    graph.manifest.schemaVersion !== schema.version
  )
    throw new Error(
      "This workbook mapping does not match the compiled schema provenance",
    );
  const products = graph.productTypes();
  if (!Object.hasOwn(products, config.productType))
    throw new Error("This product type is not in the compiled schema");
  let expanded = 0;
  function expand(value: GraphValue, path: string): unknown {
    if (++expanded > 100000)
      throw new Error(
        "This selected schema exceeds the runtime expansion budget",
      );
    if (value === null || typeof value !== "object") return value;
    const node = graph.node(value);
    if (node.kind === "array")
      return node.items.map((v, i) => expand(v, path + "/" + i));
    let entries = node.entries;
    if (path === productsPointer)
      entries = entries.filter(([k]) => k === config.productType);
    // A row adapter constructs exactly one Visible category. Every branch of the
    // source oneOf must be a simple required-category selector before narrowing.
    if (path === visiblePointer) {
      const selector = entries.find(([k]) => k === "oneOf");
      if (selector) {
        const branches = graph.materialize(selector[1]) as Record<
          string,
          unknown
        >[];
        if (
          !Array.isArray(branches) ||
          branches.length !== Object.keys(products).length ||
          branches.some(
            (b) =>
              Object.keys(b).some(
                (k) => !["$schema", "type", "required"].includes(k),
              ) ||
              (b.type !== undefined && b.type !== "object") ||
              !Array.isArray(b.required) ||
              b.required.length !== 1 ||
              typeof b.required[0] !== "string",
          ) ||
          new Set(branches.map((b) => (b.required as string[])[0])).size !==
            branches.length ||
          branches.some(
            (b) => !Object.hasOwn(products, (b.required as string[])[0]),
          )
        )
          throw new Error(
            "This category selector cannot be safely specialized",
          );
        entries = entries.filter(([k]) => k !== "oneOf");
        return {
          ...Object.fromEntries(
            entries.map(([k, v]) => [k, expand(v, path + "/" + escaped(k))]),
          ),
          oneOf: [{ required: [config.productType] }],
        };
      }
    }
    return Object.fromEntries(
      entries.map(([k, v]) => [k, expand(v, path + "/" + escaped(k))]),
    );
  }
  const json = expand(graph.manifest.root, "#") as Record<string, unknown>;
  // Nested $id can change reference scope. Refuse until a scope-aware adapter exists.
  const check = (v: unknown, root = false): void => {
    if (!v || typeof v !== "object") return;
    if (!root && Object.hasOwn(v, "$id"))
      throw new Error("Unsupported nested schema reference scope");
    if (Object.hasOwn(v, "$ref")) {
      const ref = (v as Record<string, unknown>).$ref;
      if (
        typeof ref !== "string" ||
        ref === "#" ||
        ref.startsWith("#/properties/MPItem")
      )
        throw new Error("Unsupported reference into specialized feed context");
    }
    for (const x of Object.values(v)) check(x);
  };
  check(json, true);
  const ajv = new Ajv({
    allErrors: true,
    strictSchema: true,
    strictTypes: false,
    strictRequired: false,
    allowUnionTypes: true,
    validateFormats: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    inlineRefs: false,
  });
  addFormats(ajv);
  // Walmart comments are retained verbatim as annotation metadata, not executable rules.
  ajv.addKeyword({ keyword: "comments", valid: true });
  const validate = ajv.compile(json);
  const runtime = {
    graph,
    validate,
    field: (pointer: string) =>
      graph.materialize(graph.at(pointer)) as Record<string, unknown>,
  };
  if (cache.size >= 2) cache.delete(cache.keys().next().value!);
  cache.set(key, runtime);
  return runtime;
}
export function hydrateOfficialFields(
  schema: MarketplaceSchema,
): MarketplaceSchema {
  const runtime = officialRuntime(schema);
  const seen = new Set<string>();
  schema.fields = schema.fields.map((mapping) => {
    if (
      !mapping.canonicalPath ||
      !mapping.schemaPath ||
      !mapping.encoding ||
      seen.has(mapping.canonicalPath)
    )
      throw new Error(
        "This column mapping is missing an explicit path/encoding or is ambiguous",
      );
    seen.add(mapping.canonicalPath);
    const expected =
      "#/properties/MPItem/items" +
      mapping.canonicalPath
        .split("/")
        .slice(1)
        .map((part) => "/properties/" + part)
        .join("");
    if (mapping.schemaPath !== expected)
      throw new Error(
        "This field schema pointer does not match its canonical path; array coordinates require a reviewed adapter",
      );
    const parts = mapping.canonicalPath
      .split("/")
      .slice(1)
      .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (parts[0] === "Visible" && parts[1] !== schema.compiled!.productType)
      throw new Error("This column maps another product type");
    const definition = runtime.field(mapping.schemaPath);
    const parentPointer = mapping.schemaPath.slice(
      0,
      mapping.schemaPath.lastIndexOf("/properties/"),
    );
    const parentDefinition = runtime.field(parentPointer);
    const fieldName = parts.at(-1)!;
    const required =
      Array.isArray(parentDefinition.required) &&
      parentDefinition.required.includes(fieldName);
    const type = definition.type;
    if (
      (mapping.encoding === "number" &&
        !["number", "integer"].includes(String(type))) ||
      (mapping.encoding === "boolean" && type !== "boolean") ||
      (mapping.encoding === "json" &&
        !["array", "object"].includes(String(type)))
    )
      throw new Error(
        "This column encoding is incompatible with the official field type",
      );
    return {
      ...mapping,
      type: undefined,
      required,
      enumValues: undefined,
      normalizeWhitespace: false,
      constraints: undefined,
      maxLength: undefined,
      validation: definition,
      displayName:
        typeof definition.title === "string" ? definition.title : parts.at(-1),
    };
  });
  return schema;
}
export function setCanonical(
  target: Record<string, unknown>,
  pointer: string,
  value: unknown,
) {
  const keys = pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  let at = target;
  keys.forEach((key, index) => {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("This canonical path is unsafe");
    if (index === keys.length - 1) {
      if (Object.hasOwn(at, key))
        throw new Error("This column mapping overlaps another field");
      at[key] = value;
    } else {
      if (!Object.hasOwn(at, key)) at[key] = {};
      if (!at[key] || typeof at[key] !== "object" || Array.isArray(at[key]))
        throw new Error("This column mapping overlaps another field");
      at = at[key] as Record<string, unknown>;
    }
  });
}
export function decodeCell(value: string, field: FieldDefinition): unknown {
  if (field.encoding === "json") {
    if (value.length > 100000) throw new Error("JSON cell exceeds limit");
    const numbers =
      value
        .replace(/"(?:[^"\\]|\\.)*"/g, "")
        .match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
    for (const number of numbers) supportedNumber(number);
    return JSON.parse(value);
  }
  if (field.encoding === "number") {
    if (
      !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) ||
      !Number.isFinite(Number(value))
    )
      throw new Error("Numeric value is ambiguous");
    supportedNumber(value);
    return Number(value);
  }
  if (field.encoding === "boolean") {
    if (value !== "true" && value !== "false")
      throw new Error("Boolean value is ambiguous");
    return value === "true";
  }
  return value;
}
export function errorsFor(
  runtime: RuntimeSchema,
  schema: MarketplaceSchema,
  item: Record<string, unknown> | Record<string, unknown>[],
): ErrorObject[] {
  runtime.validate({
    MPItemFeedHeader: schema.compiled!.feedHeader,
    MPItem: Array.isArray(item) ? item : [item],
  });
  return structuredClone(runtime.validate.errors ?? []);
}
