import type { FieldDefinition, Resolution } from "./model";
export interface RuleResult {
  code: string;
  title: string;
  description: string;
  resolution: Resolution;
  proposedValue?: string;
}
export interface Rule {
  id: string;
  evaluate: (value: string, field: FieldDefinition) => RuleResult[];
}
const input = (
  code: string,
  title: string,
  description: string,
): RuleResult => ({ code, title, description, resolution: "NEEDS_USER_INPUT" });
export function checkDigit(body: string): string {
  return String(
    (10 -
      (Array.from(body)
        .reverse()
        .reduce((sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 3 : 1), 0) %
        10)) %
      10,
  );
}
export const rules: Rule[] = [
  {
    id: "required",
    evaluate: (v, f) =>
      f.required && !v.trim()
        ? [
            input(
              "REQUIRED",
              "Missing required value",
              "Enter the value required by this template. We never invent missing data.",
            ),
          ]
        : [],
  },
  {
    id: "empty-whitespace",
    evaluate: (v, f) =>
      v.length > 0 && !v.trim() && !f.required
        ? [
            {
              code: "EMPTY_WHITESPACE",
              title: "Value contains only whitespace",
              description:
                "Check whether this field should be empty or needs a value.",
              resolution: "WARNING",
            },
          ]
        : [],
  },
  {
    id: "controls",
    evaluate: (v) =>
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|_x00(?:0[0-8BbCcEeFf]|1[0-9a-fA-F])_/i.test(
        v,
      )
        ? [
            input(
              "CONTROL",
              "Control characters found",
              "Review and remove unintended control characters; automatic removal could join words.",
            ),
          ]
        : [],
  },
  {
    id: "whitespace",
    evaluate: (v, f) =>
      v !== v.trim() && v.trim()
        ? [
            {
              code: "WHITESPACE",
              title: "Extra whitespace",
              description:
                f.normalizeWhitespace && f.type !== "sku"
                  ? "This schema allows removing surrounding whitespace."
                  : "Review surrounding whitespace. This schema does not authorize changing this value automatically.",
              resolution:
                f.normalizeWhitespace && f.type !== "sku"
                  ? "AUTO_FIX"
                  : "NEEDS_USER_INPUT",
              proposedValue:
                f.normalizeWhitespace && f.type !== "sku"
                  ? v.trim()
                  : undefined,
            },
          ]
        : [],
  },
  {
    id: "length",
    evaluate: (v, f) =>
      f.maxLength && Array.from(v).length > f.maxLength
        ? [
            input(
              "MAX_LENGTH",
              "Value is too long",
              `Maximum length is ${f.maxLength} characters. Shorten the value yourself.`,
            ),
          ]
        : [],
  },
  {
    id: "gtin",
    evaluate: (v, f) => {
      if (f.type !== "gtin" || !v.trim()) return [];
      const t = v.trim();
      if (!/^\d+$/.test(t))
        return [
          input(
            "GTIN_DIGITS",
            "GTIN contains non-numeric characters",
            "Use the identifier assigned to this product. Letters and separators cannot be safely removed.",
          ),
        ];
      if (![8, 12, 13, 14].includes(t.length))
        return [
          input(
            "GTIN_LENGTH",
            "Invalid GTIN length",
            "GTIN must contain 8, 12, 13 or 14 digits. Verify the original identifier, including leading zeros.",
          ),
        ];
      if (checkDigit(t.slice(0, -1)) !== t.slice(-1))
        return [
          input(
            "GTIN_CHECK_DIGIT",
            "Invalid check digit",
            "Verify the identifier against your source. A checksum cannot tell us which digit was entered incorrectly.",
          ),
        ];
      return [];
    },
  },
  {
    id: "enum",
    evaluate: (v, f) => {
      if (!f.enumValues || !v.trim() || f.enumValues.includes(v)) return [];
      const matches = f.enumValues.filter(
        (e) => e.toLowerCase() === v.trim().toLowerCase(),
      );
      return matches.length === 1
        ? [
            {
              code: "ENUM_NORMALIZE",
              title: "Value formatting does not match the allowed values",
              description:
                "Casing and surrounding whitespace map to exactly one declared value.",
              resolution: "AUTO_FIX",
              proposedValue: matches[0],
            },
          ]
        : [
            input(
              "ENUM_INVALID",
              "Value is not allowed",
              `Use one of: ${f.enumValues.join(", ")}.`,
            ),
          ];
    },
  },
  {
    id: "url",
    evaluate: (v, f) => {
      if (f.type !== "url" || !v.trim()) return [];
      const t = v.trim();
      if (!/^https?:\/\//i.test(t))
        return [
          input(
            "URL_PROTOCOL",
            "URL needs an HTTP or HTTPS protocol",
            "Confirm the complete URL, including the correct protocol.",
          ),
        ];
      try {
        const u = new URL(t);
        if (
          /\s|%(?![a-fA-F0-9]{2})|\\/.test(t) ||
          !u.hostname.includes(".") ||
          u.username ||
          u.password
        )
          throw new Error();
        return [];
      } catch {
        return [
          input(
            "URL_INVALID",
            "Invalid URL",
            "Check spaces, hostname and URL formatting. Availability has not been checked.",
          ),
        ];
      }
    },
  },
  {
    id: "number",
    evaluate: (v, f) => {
      if (f.type !== "number" || !v.trim()) return [];
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(v))
        return [
          input(
            "NUMBER_FORMAT",
            "Invalid numeric format",
            "Use a plain number with a decimal point. Separators are ambiguous and are not converted.",
          ),
        ];
      const n = Number(v);
      if (!Number.isFinite(n))
        return [
          input("NUMBER_FORMAT", "Invalid number", "Enter a finite number."),
        ];
      return (f.constraints ?? []).flatMap((c) =>
        (c.kind === "min" && n < c.value!) ||
        (c.kind === "max" && n > c.value!) ||
        (c.kind === "integer" && !Number.isInteger(n))
          ? [
              input(
                "NUMBER_BOUND",
                "Number is outside the allowed range",
                c.kind === "integer"
                  ? "Enter a whole number."
                  : `The schema declares ${c.kind} ${c.value}.`,
              ),
            ]
          : [],
      );
    },
  },
  {
    id: "boolean",
    evaluate: (v, f) =>
      f.type === "boolean" &&
      !f.enumValues &&
      v &&
      !["true", "false"].includes(v)
        ? [
            input(
              "BOOLEAN",
              "Invalid boolean",
              "This schema expects literal true or false.",
            ),
          ]
        : [],
  },
];
