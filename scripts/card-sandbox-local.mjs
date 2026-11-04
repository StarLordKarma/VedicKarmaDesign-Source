#!/usr/bin/env node
// Local-only runner. Never loads .env or production credentials.
import { config } from "dotenv";
import { spawn } from "node:child_process";
config({ path: ".env.card-sandbox", override: true, quiet: true });
const { assertCardSandbox } = await import(
  "../server/payments/card-sandbox-config.ts"
);
assertCardSandbox();
if (process.argv[2] === "storage") {
  const { S3Client, CreateBucketCommand } = await import("@aws-sdk/client-s3");
  const endpoint = new URL(process.env.S3_ENDPOINT || "");
  if (
    !["localhost", "127.0.0.1"].includes(endpoint.hostname) ||
    process.env.S3_BUCKET !== "vedic-card-sandbox"
  )
    throw Error(
      "Storage initialization requires the local card sandbox bucket"
    );
  const client = new S3Client({
    region: "us-east-1",
    endpoint: endpoint.href,
    forcePathStyle: true,
  });
  try {
    await client.send(
      new CreateBucketCommand({ Bucket: process.env.S3_BUCKET })
    );
  } catch (error) {
    if (
      !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)
    )
      throw error;
  }
  console.log("Private sandbox storage ready");
  process.exit(0);
}
const commands = {
  migrate: [process.execPath, ["--import", "tsx", "server/migrate.ts"]],
  seed: [process.execPath, ["--import", "tsx", "scripts/seed-sandbox.ts"]],
  start: [process.execPath, ["dist/index.js"]],
  visual: [
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "e2e/card-sandbox.spec.ts",
      "--grep",
      "payment selector|actual order form",
      "--workers=1",
    ],
  ],
  test: [
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "e2e/card-sandbox.spec.ts",
      "--workers=1",
    ],
  ],
};
const command = commands[process.argv[2]];
if (!command) throw Error("Use migrate, seed, start, visual, or test");
const args = ["test", "visual"].includes(process.argv[2])
  ? [...command[1], ...process.argv.slice(3)]
  : command[1];
const child = spawn(command[0], args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DOTENV_CONFIG_PATH: ".env.card-sandbox",
    SANDBOX_SEED_CONFIRM: "true",
    SANDBOX_BASE_URL: process.env.PUBLIC_BASE_URL,
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
