import assert from "node:assert/strict";
import test from "node:test";
import { WebsiteResolver } from "../src/infrastructure/website-resolver.js";

test("pins a public IPv4 destination from DNS answers", async () => {
  const resolver = new WebsiteResolver({
    lookup: async () => ["8.8.8.8", "1.1.1.1", "8.8.8.8"],
  });
  assert.deepEqual(await resolver.resolve({ hostname: "example.com" }), {
    address: "1.1.1.1",
    family: 4,
  });
});

test("rejects an answer set containing a non-public address", async () => {
  const resolver = new WebsiteResolver({
    lookup: async () => ["8.8.8.8", "127.0.0.1"],
  });
  await assert.rejects(() => resolver.resolve({ hostname: "example.com" }), {
    code: "destination_not_allowed",
  });
});

test("classifies DNS failures without exposing resolver details", async () => {
  const resolver = new WebsiteResolver({
    lookup: async () => {
      throw new Error("resolver detail");
    },
  });
  await assert.rejects(() => resolver.resolve({ hostname: "example.com" }), {
    code: "destination_unavailable",
    message: "The website address could not be resolved",
  });
});
