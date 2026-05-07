import assert from "node:assert/strict";
import test from "node:test";
import { rateLimitInMemory } from "./rate-limit";

test("rateLimitInMemory allows up to max within window", () => {
  const key = `test-allow-${Math.random().toString(16).slice(2)}`;
  const max = 3;
  const windowMs = 1000;

  for (let i = 0; i < max; i++) {
    const result = rateLimitInMemory({ key, max, windowMs });
    assert.equal(result.allowed, true, `attempt ${i + 1} should be allowed`);
    assert.equal(result.remaining, max - i - 1);
  }

  const blocked = rateLimitInMemory({ key, max, windowMs });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);
});

test("rateLimitInMemory uses separate buckets per key", () => {
  const max = 1;
  const windowMs = 1000;
  const a = `test-key-a-${Math.random().toString(16).slice(2)}`;
  const b = `test-key-b-${Math.random().toString(16).slice(2)}`;

  assert.equal(rateLimitInMemory({ key: a, max, windowMs }).allowed, true);
  assert.equal(rateLimitInMemory({ key: a, max, windowMs }).allowed, false);
  // Different key has its own counter
  assert.equal(rateLimitInMemory({ key: b, max, windowMs }).allowed, true);
});

test("rateLimitInMemory expires entries after window", async () => {
  const key = `test-expire-${Math.random().toString(16).slice(2)}`;
  const max = 1;
  const windowMs = 50;

  assert.equal(rateLimitInMemory({ key, max, windowMs }).allowed, true);
  assert.equal(rateLimitInMemory({ key, max, windowMs }).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, windowMs + 30));

  assert.equal(
    rateLimitInMemory({ key, max, windowMs }).allowed,
    true,
    "entry should expire after window",
  );
});
