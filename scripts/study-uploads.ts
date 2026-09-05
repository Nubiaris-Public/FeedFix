import nextEnv from "@next/env";
async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const { ContributionStore } = await import("../src/server/contributions");
  const store = new ContributionStore();
  const [command = "list", id] = process.argv.slice(2);
  if (command === "list")
    console.log(JSON.stringify(await store.list(), null, 2));
  else if (command === "inspect" && id)
    console.log(JSON.stringify(await store.inspect(id), null, 2));
  else if (command === "cleanup") {
    await store.cleanup();
    console.log("Expired study copies removed.");
  } else
    throw new Error(
      "Use list, inspect <id>, or cleanup. No public access or permanent export.",
    );
}
void main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
