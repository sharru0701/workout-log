import assert from "node:assert/strict";
import test from "node:test";

import { apiGet, apiInvalidateCache } from "./api";

test("network-only GET bypasses an existing SWR response", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ version: requestCount }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    apiInvalidateCache();
  });

  const path = "/api/test/network-only";
  assert.deepEqual(await apiGet(path), { version: 1 });
  assert.deepEqual(await apiGet(path), { version: 1 });
  assert.equal(requestCount, 1);

  assert.deepEqual(
    await apiGet(path, { cachePolicy: "network-only" }),
    { version: 2 },
  );
  assert.equal(requestCount, 2);
});
