// Start isolated order-mail processes without persisting or copying credentials.
import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const fixture = parse(
  readFileSync(process.env.ORDER_MAIL_SANDBOX_ENV || ".env.card-sandbox")
);
const local = value =>
  ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
if (
  fixture.DEPLOYMENT_MODE !== "sandbox" ||
  fixture.AUTH_PROVIDER !== "sandbox" ||
  fixture.RISKPAY_LIVE_ENABLED !== "false" ||
  !local(fixture.DATABASE_URL) ||
  !local(fixture.S3_ENDPOINT) ||
  !local(fixture.RESEND_BASE_URL) ||
  !local(fixture.LLM_BASE_URL)
)
  throw Error(
    "Requires exclusively local synthetic sandbox services; live RiskPay must be disabled"
  );
const db = new URL(fixture.DATABASE_URL);
db.pathname = "/sandbox_order_mail_test";
const env = {
  ...process.env,
  ...fixture,
  DATABASE_URL: db.href,
  PUBLIC_BASE_URL: "http://127.0.0.1:4092",
  PORT: "4092",
  HOST: "127.0.0.1",
  S3_BUCKET: "vedic-order-mail-sandbox",
  RESEND_BASE_URL: "http://127.0.0.1:4012/emails",
  ORDER_SIGNING_SECRET:
    fixture.ORDER_SIGNING_SECRET ||
    "synthetic-order-mail-local-history-key-20261105",
  ORDER_MAIL_LIFECYCLE_ENABLED: "true",
  ORDER_MAIL_WORKER_ENABLED: "true",
  SANDBOX_SEED_CONFIRM: "true",
  SANDBOX_BASE_URL: "http://127.0.0.1:4092",
};
delete env.RISKPAY_CALLBACK_BASE_URL;
if (!process.argv[2])
  throw Error("Pass a Node script and arguments, e.g. dist/index.js");
const child = spawn(process.execPath, process.argv.slice(2), {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
