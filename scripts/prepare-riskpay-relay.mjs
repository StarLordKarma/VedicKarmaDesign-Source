import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir(".validation", { recursive: true });
let privateKey;
try {
  privateKey = await readFile(".validation/riskpay-relay-key.pem", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  privateKey = generateKeyPairSync("ed25519").privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  await writeFile(".validation/riskpay-relay-key.pem", privateKey, {
    mode: 0o600,
    flag: "wx",
  });
}
const publicKey = createPublicKey(privateKey).export({
  type: "spki",
  format: "pem",
});
const expiresAt = Date.now() + 60 * 60 * 1000;
await writeFile(
  "deploy/riskpay-relay/lib/deployment.mjs",
  `// Generated PUBLIC verification key only. Private key never leaves this computer.\nexport const publicKey = ${JSON.stringify(publicKey)};\nexport const expiresAt = ${expiresAt};\n`
);
console.log(
  "Test receiver prepared; expires at " + new Date(expiresAt).toISOString()
);
