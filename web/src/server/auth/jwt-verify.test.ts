import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeJwt,
  verifyJwtRs256,
  importRsaPublicKeyFromJwk,
} from "./jwt-verify";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stringToBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s));
}

async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
}

async function signJwt(
  privateKey: CryptoKey,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const data = new TextEncoder().encode(signingInput);
  const dataAb = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const signatureBuf = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    dataAb,
  );
  const signatureB64 = bytesToBase64Url(new Uint8Array(signatureBuf));
  return `${signingInput}.${signatureB64}`;
}

async function exportPublicJwk(publicKey: CryptoKey) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  // Cast to JsonWebKey from our jwks module, which has matching shape.
  return jwk as { kty: string; n?: string; e?: string };
}

test("decodeJwt parses three segments", () => {
  const token = `${stringToBase64Url('{"alg":"RS256"}')}.${stringToBase64Url('{"sub":"abc"}')}.AAAA`;
  const decoded = decodeJwt(token);
  assert.equal(decoded.header.alg, "RS256");
  assert.equal((decoded.payload as { sub: string }).sub, "abc");
});

test("decodeJwt rejects malformed tokens", () => {
  assert.throws(() => decodeJwt("not.enough"));
  assert.throws(() => decodeJwt("a.b.c.d"));
});

test("verifyJwtRs256 accepts a freshly signed token", async () => {
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    privateKey,
    { alg: "RS256", kid: "test-kid", typ: "JWT" },
    {
      iss: "test-issuer",
      sub: "user-1",
      aud: "client-1",
      iat: now,
      exp: now + 600,
    },
  );
  const jwk = await exportPublicJwk(publicKey);
  const key = await importRsaPublicKeyFromJwk(jwk);

  const payload = await verifyJwtRs256(token, async () => key);
  assert.equal(payload.sub, "user-1");
  assert.equal(payload.iss, "test-issuer");
});

test("verifyJwtRs256 rejects tampered payload", async () => {
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    privateKey,
    { alg: "RS256" },
    { sub: "alice", iat: now, exp: now + 600 },
  );
  const [headerB64, , signatureB64] = token.split(".");
  const tamperedPayload = stringToBase64Url(
    JSON.stringify({ sub: "mallory", exp: now + 600 }),
  );
  const tamperedToken = `${headerB64}.${tamperedPayload}.${signatureB64}`;
  const jwk = await exportPublicJwk(publicKey);
  const key = await importRsaPublicKeyFromJwk(jwk);

  await assert.rejects(verifyJwtRs256(tamperedToken, async () => key));
});

test("verifyJwtRs256 rejects expired token", async () => {
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const past = Math.floor(Date.now() / 1000) - 3600;
  const token = await signJwt(
    privateKey,
    { alg: "RS256" },
    { sub: "u", iat: past - 60, exp: past },
  );
  const jwk = await exportPublicJwk(publicKey);
  const key = await importRsaPublicKeyFromJwk(jwk);
  await assert.rejects(
    verifyJwtRs256(token, async () => key),
    /jwt expired/,
  );
});

test("verifyJwtRs256 rejects non-RS256 algorithms", async () => {
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    privateKey,
    { alg: "HS256" }, // header lies — but verifier must reject anyway
    { sub: "u", iat: now, exp: now + 600 },
  );
  const jwk = await exportPublicJwk(publicKey);
  const key = await importRsaPublicKeyFromJwk(jwk);
  await assert.rejects(
    verifyJwtRs256(token, async () => key),
    /unsupported jwt alg/,
  );
});
