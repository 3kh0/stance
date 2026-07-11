import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SPORTRADAR_WIDGET_KEY = "357f35d2f90c86f7c3cc9b4771937688";

type LicensePayload = {
  packages?: unknown[];
  fishnetToken?: { token?: string; origin?: string; expirationTs?: number };
};

function evpBytesToKey(password: string, salt: Buffer) {
  let prev = Buffer.alloc(0);
  const blocks: Buffer[] = [];
  let total = 0;
  while (total < 48) {
    prev = createHash("md5")
      .update(Buffer.concat([prev, Buffer.from(password), salt]))
      .digest();
    blocks.push(prev);
    total += prev.length;
  }
  const merged = Buffer.concat(blocks);
  return { key: merged.subarray(0, 32), iv: merged.subarray(32, 48) };
}

function decrypt(ciphertext: string): LicensePayload {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.subarray(0, 8).toString() !== "Salted__") throw new Error("Unexpected Sportradar license format");
  const { key, iv } = evpBytesToKey(SPORTRADAR_WIDGET_KEY, buf.subarray(8, 16));
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString("utf8")) as LicensePayload;
}

function encrypt(payload: LicensePayload): string {
  const salt = randomBytes(8);
  const { key, iv } = evpBytesToKey(SPORTRADAR_WIDGET_KEY, salt);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("Salted__"), salt, encrypted]).toString("base64");
}

export function patchSportradarLicenseForOrigin(ciphertext: string, origin: string) {
  const license = decrypt(ciphertext);
  if (license.fishnetToken) license.fishnetToken.origin = origin;
  return encrypt(license);
}
