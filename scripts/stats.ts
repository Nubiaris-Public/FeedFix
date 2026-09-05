import nextEnv from "@next/env";
import { UsageLog } from "../src/server/usage";
nextEnv.loadEnvConfig(process.cwd());
async function main() {
try {
  console.log(JSON.stringify(await new UsageLog().summary(), null, 2));
} catch {
  console.error(
    "Could not read the correction log. Check USAGE_LOG_PATH and file permissions.",
  );
  process.exitCode = 1;
}

}
void main();
