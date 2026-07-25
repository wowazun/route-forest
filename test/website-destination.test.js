import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWebsiteDestination } from "../src/domain/website-destination.js";

test("normalizes hostnames and discards URL paths", () => {
  assert.deepEqual(normalizeWebsiteDestination("Example.COM"), {
    hostname: "example.com",
  });
  assert.deepEqual(
    normalizeWebsiteDestination("https://www.example.com/some/path?q=1"),
    { hostname: "www.example.com" },
  );
  assert.deepEqual(normalizeWebsiteDestination("https://例え.テスト"), {
    hostname: "xn--r8jz45g.xn--zckzah",
  });
});

test("rejects direct IPs, private names, credentials, ports, and schemes", () => {
  for (const value of [
    "127.0.0.1",
    "192.168.1.1",
    "localhost",
    "router.local",
    "service.internal",
    "https://user:password@example.com",
    "https://example.com:8443",
    "ftp://example.com",
  ]) {
    assert.throws(() => normalizeWebsiteDestination(value), undefined, value);
  }
});
