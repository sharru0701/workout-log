/**
 * OAuth flow state helpers: state token + PKCE code_verifier/code_challenge.
 *
 * 모두 cryptographically random 한 값으로 생성되며, S256 challenge 계산은
 * Web Crypto SHA-256 사용. 결과는 base64url 인코딩.
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

export function createOAuthState(): string {
  return bytesToBase64Url(randomBytes(24));
}

export function createPkceVerifier(): string {
  // RFC 7636: 43-128 chars, base64url(no padding)
  return bytesToBase64Url(randomBytes(48));
}

export async function deriveS256Challenge(verifier: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function isSafeRelativePath(value: string | null | undefined): boolean {
  if (!value) return false;
  if (typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/api/")) return false;
  return true;
}
