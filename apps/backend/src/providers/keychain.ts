/**
 * apps/backend/src/providers/keychain.ts
 *
 * Stores and retrieves API keys encrypted in MongoDB using AES-256-GCM.
 * Keys are encrypted with APP_SECRET before storage.
 *
 * This is serverless-compatible (no native OS keychain dependencies).
 *
 * Fallback: If user hasn't set their own key, falls back to
 * KEYTAR_FALLBACK_*_KEY env vars for shared/default keys.
 */

import crypto from "crypto";
import { env } from "../config.js";
import { User } from "../models/User.js";

// ── Encryption utilities ──────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits

/**
 * Derives a 32-byte encryption key from APP_SECRET
 */
function getEncryptionKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(env.APP_SECRET)
    .digest();
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 * Returns: iv:authTag:ciphertext (all hex-encoded, colon-separated)
 */
function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted API key.
 * @param encrypted Format: iv:authTag:ciphertext (hex-encoded)
 */
function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const iv = Buffer.from(parts[0]!, "hex");
  const authTag = Buffer.from(parts[1]!, "hex");
  const ciphertext = parts[2]!;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Saves an API key encrypted in MongoDB.
 * @param userId  GitHub user ID (from JWT)
 * @param provider  "openai" | "anthropic"
 * @param key  The raw API key string
 */
export async function saveApiKey(
  userId: string,
  provider: string,
  key: string
): Promise<void> {
  const encrypted = encrypt(key);
  const fieldPath = `encryptedKeys.${provider}`;

  await User.updateOne(
    { githubId: userId },
    { $set: { [fieldPath]: encrypted } }
  );
}

/**
 * Retrieves and decrypts an API key from MongoDB, with env-var fallback.
 * Returns null if not found anywhere.
 */
export async function getApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  // Query with explicit select to include encryptedKeys field
  const user = await User.findOne(
    { githubId: userId },
    { encryptedKeys: 1 }
  ).lean();

  if (user?.encryptedKeys?.[provider as "openai" | "anthropic"]) {
    try {
      return decrypt(user.encryptedKeys[provider as "openai" | "anthropic"]!);
    } catch (err) {
      console.error(`Failed to decrypt ${provider} key for user ${userId}:`, err);
      return null;
    }
  }

  return null;
}

/**
 * Deletes an API key from MongoDB.
 * Returns true if deleted, false if not found.
 */
export async function deleteApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const fieldPath = `encryptedKeys.${provider}`;
  const result = await User.updateOne(
    { githubId: userId },
    { $unset: { [fieldPath]: "" } }
  );

  return result.modifiedCount > 0;
}

/**
 * Checks whether a key exists for this user+provider.
 * Used to populate the `keyStored` field in providerConfig.
 */
export async function hasApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const user = await User.findOne(
    { githubId: userId },
    { encryptedKeys: 1 }
  ).lean();

  if (user?.encryptedKeys?.[provider as "openai" | "anthropic"]) {
    return true;
  }

  return false;
}
