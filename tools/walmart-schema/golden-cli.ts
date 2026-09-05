import { parseArgs } from "node:util";
import { goldenFiles, runGolden, writeGolden } from "./golden";
const { values } = parseArgs({
  options: {
    fixture: { type: "string" },
    directory: { type: "string" },
    output: { type: "string" },
  },
});
try {
  const files = values.fixture
    ? [values.fixture]
    : goldenFiles(values.directory ?? "tests/fixtures/walmart");
  if (!files.length) throw new Error("No golden fixtures found");
  if (values.output && files.length !== 1)
    throw new Error("--output requires one --fixture");
  const results = files.map((file) => ({ file, ...runGolden(file) }));
  if (values.output) writeGolden(values.output, results[0]);
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
