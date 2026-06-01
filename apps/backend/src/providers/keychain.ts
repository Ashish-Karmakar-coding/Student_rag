/**
 * apps/backend/src/providers/keychain.ts
 *
 * Stores and retrieves API keys from the OS keychain using keytar:
 *   macOS  → Keychain Access
 *   Windows → Credential Manager
 *   Linux  → Secret Service (libsecret)
 *
 * Keys are NEVER written to disk, MongoDB, or logs.
 *
 * Fallback: If keytar native bindings fail to load (common on Windows without
 * Visual C++ Build Tools), we fall back to KEYTAR_FALLBACK_*_KEY env vars
 * with a one-time console warning.
 */

import { env } from "../config.js";

const SERVICE = "studytutor";

// ── Dynamic keytar import with graceful fallback ──────────────────────────────

let keytarLoaded = false;
let keytar: typeof import("keytar") | null = null;

async function getKeytar(): Promise<typeof import("keytar") | null> {
  if (keytarLoaded) return keytar;
  try {
    keytar = await import("keytar");
    keytarLoaded = true;
    return keytar;
  } catch {
    console.warn(
      "⚠️  keytar native bindings unavailable. " +
      "Falling back to KEYTAR_FALLBACK_* env vars. " +
      "To fix: install Visual C++ Build Tools and run `pnpm rebuild keytar`."
    );
    keytarLoaded = true;
    return null;
  }
}

// ── Env-var fallback map ───────────────────────────────────────────────────────

function getFallbackKey(provider: string): string | null {
  if (provider === "openai") {
    return env.KEYTAR_FALLBACK_OPENAI_KEY ?? null;
  }
  if (provider === "anthropic") {
    return env.KEYTAR_FALLBACK_ANTHROPIC_KEY ?? null;
  }
  return null;
}

// ── Account key ───────────────────────────────────────────────────────────────

/** Namespaces the keychain account per user and provider */
function accountKey(userId: string, provider: string): string {
  return `${userId}_${provider}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Saves an API key to the OS keychain.
 * @param userId  GitHub user ID (from JWT)
 * @param provider  "openai" | "anthropic"
 * @param key  The raw API key string
 */
export async function saveApiKey(
  userId: string,
  provider: string,
  key: string
): Promise<void> {
  const kt = await getKeytar();
  if (kt) {
    await kt.setPassword(SERVICE, accountKey(userId, provider), key);
  }
  // If keytar unavailable, we can't save — caller should warn the user
}

/**
 * Retrieves an API key from the OS keychain, with env-var fallback.
 * Returns null if not found anywhere.
 */
export async function getApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const kt = await getKeytar();
  if (kt) {
    const key = await kt.getPassword(SERVICE, accountKey(userId, provider));
    if (key) return key;
  }
  // Fall back to env var if keytar unavailable or key not found
  return getFallbackKey(provider);
}

/**
 * Deletes an API key from the OS keychain.
 * Returns true if deleted, false if not found.
 */
export async function deleteApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const kt = await getKeytar();
  if (kt) {
    return kt.deletePassword(SERVICE, accountKey(userId, provider));
  }
  return false;
}

/**
 * Checks whether a key exists for this user+provider.
 * Used to populate the `keyStored` field in providerConfig.
 */
export async function hasApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const kt = await getKeytar();
  if (kt) {
    const key = await kt.getPassword(SERVICE, accountKey(userId, provider));
    if (key !== null) return true;
  }
  return getFallbackKey(provider) !== null;
}
