/**
 * RS256 JWT signature verification using Web Crypto.
 *
 * 외부 의존성 없이 JWT compact 형식 (header.payload.signature)을 파싱하고,
 * JWK로부터 RSASSA-PKCS1-v1_5 / SHA-256 공개키를 import해 서명을 검증한다.
 *
 * 클레임 검증은 호출자가 수행 (verifier는 서명 + 일반적인 시간 기반
 * 검증만 처리). exp/iat/nbf는 자동으로 검사한다.
 */

import type { JsonWebKey } from "@/server/auth/jwks";

export type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

export type JwtPayload = Record<string, unknown> & {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
};

export type DecodedJwt = {
  header: JwtHeader;
  payload: JwtPayload;
  signingInput: string;
  signature: Uint8Array;
};

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLen);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToString(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid jwt: expected 3 segments");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const headerJson = bytesToString(base64UrlToBytes(headerB64));
  const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadB64));

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(headerJson) as JwtHeader;
  } catch {
    throw new Error("invalid jwt: header not parseable");
  }
  try {
    payload = JSON.parse(payloadJson) as JwtPayload;
  } catch {
    throw new Error("invalid jwt: payload not parseable");
  }
  return {
    header,
    payload,
    signingInput: `${headerB64}.${payloadB64}`,
    signature: base64UrlToBytes(signatureB64),
  };
}

export async function importRsaPublicKeyFromJwk(
  jwk: JsonWebKey,
): Promise<CryptoKey> {
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) {
    throw new Error("expected RSA JWK with n and e");
  }
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: jwk.n,
      e: jwk.e,
      alg: "RS256",
      ext: true,
    } as unknown as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function verifyJwtRs256(
  token: string,
  resolveKey: (header: JwtHeader) => Promise<CryptoKey>,
  options: {
    nowSeconds?: number;
    clockSkewSec?: number;
  } = {},
): Promise<JwtPayload> {
  const { header, payload, signingInput, signature } = decodeJwt(token);
  if ((header.alg ?? "").toUpperCase() !== "RS256") {
    throw new Error(`unsupported jwt alg: ${header.alg ?? "(none)"}`);
  }

  const key = await resolveKey(header);
  const enc = new TextEncoder();
  const sigBuf = signature.buffer.slice(
    signature.byteOffset,
    signature.byteOffset + signature.byteLength,
  ) as ArrayBuffer;
  const dataBuf = enc.encode(signingInput);
  const dataAb = dataBuf.buffer.slice(
    dataBuf.byteOffset,
    dataBuf.byteOffset + dataBuf.byteLength,
  ) as ArrayBuffer;
  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    sigBuf,
    dataAb,
  );
  if (!ok) throw new Error("jwt signature verification failed");

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSec ?? 60;
  if (typeof payload.exp === "number" && payload.exp + skew < now) {
    throw new Error("jwt expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf - skew > now) {
    throw new Error("jwt not yet valid");
  }
  if (typeof payload.iat === "number" && payload.iat - skew > now) {
    throw new Error("jwt iat is in the future");
  }

  return payload;
}
