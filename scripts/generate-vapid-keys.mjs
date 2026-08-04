import { createECDH } from "node:crypto";

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

const keyPair = createECDH("prime256v1");
const publicKey = keyPair.generateKeys();
const privateKey = keyPair.getPrivateKey();

process.stdout.write(
  [
    "# Add these values to your Homi environment.",
    `VAPID_PUBLIC_KEY=${base64Url(publicKey)}`,
    `VAPID_PRIVATE_KEY=${base64Url(privateKey)}`,
    "VAPID_SUBJECT=mailto:admin@example.com",
    "",
  ].join("\n"),
);
