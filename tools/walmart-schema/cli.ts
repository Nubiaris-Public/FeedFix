import { parseArgs } from "node:util";
import { inspect, compile, verify } from "./compiler";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    input: { type: "string" },
    output: { type: "string" },
    compiled: { type: "string" },
  },
});
try {
  if (!values.input)
    throw new Error("Required: --input <official-source.json>");
  const command = positionals[0];
  const result =
    command === "inspect"
      ? await inspect(values.input)
      : command === "compile" && values.output
        ? await compile(values.input, values.output)
        : command === "verify" && values.compiled
          ? await verify(values.input, values.compiled)
          : undefined;
  if (!result)
    throw new Error(
      "Use inspect, compile --output <new-directory>, or verify --compiled <directory>",
    );
  console.log(
    JSON.stringify(
      command === "compile"
        ? { ...result, compiledAt: new Date().toISOString() }
        : result,
      null,
      2,
    ),
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
