// Authentication and authorization utilities

const ALLOWLIST_KEY = "tothread/auth/allowlist";

export function parseAuthorizationHeader(request) {
  const auth = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme !== "Bearer" && scheme !== "bearer") return null;
  return token || null;
}

export function decodeJwtWithoutVerify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const decoded = atob(payload);
  return JSON.parse(decoded);
}

export async function verifyGoogleIdToken(token, env) {
  if (!token) {
    throw new Error("Missing ID token");
  }
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const claims = decodeJwtWithoutVerify(token);

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp < now) {
    throw new Error("ID token has expired");
  }

  const iss = claims.iss;
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
    throw new Error("Unexpected token issuer");
  }

  const aud = claims.aud;
  const expected = env.GOOGLE_CLIENT_ID;
  const audMatch = Array.isArray(aud) ? aud.includes(expected) : aud === expected;
  if (!audMatch) {
    throw new Error("ID token audience does not match GOOGLE_CLIENT_ID");
  }

  const email = claims.email;
  if (!email) {
    throw new Error("ID token does not contain an email claim");
  }

  return { email, claims };
}

export async function getAllowlist(env) {
  const raw = await env.TOTHREAD_KV.get(ALLOWLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function isAllowed(env, email) {
  const allowlist = await getAllowlist(env);
  return allowlist.includes(email);
}

export function isAuthError(message) {
  return (
    message.includes("Missing ID token") ||
    message.includes("ID token") ||
    message.includes("Unexpected token issuer") ||
    message.includes("audience")
  );
}
