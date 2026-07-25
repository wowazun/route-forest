import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGlobalUnicastIp,
  extractTrustedCloudflareClientIp,
  isGlobalUnicastIp,
  normalizeIpAddress,
} from "../src/domain/ip-address.js";

test("normalizes IPv4, IPv6, and IPv4-mapped IPv6 addresses", () => {
  assert.deepEqual(normalizeIpAddress("8.8.8.8"), {
    address: "8.8.8.8",
    family: 4,
  });
  assert.deepEqual(normalizeIpAddress("2606:4700:4700:0000:0000:0000:0000:1111"), {
    address: "2606:4700:4700::1111",
    family: 6,
  });
  assert.deepEqual(normalizeIpAddress("::ffff:8.8.4.4"), {
    address: "8.8.4.4",
    family: 4,
  });
});

test("accepts global unicast addresses", () => {
  assert.equal(isGlobalUnicastIp("8.8.8.8"), true);
  assert.equal(isGlobalUnicastIp("2606:4700:4700::1111"), true);
});

test("rejects non-global and documentation addresses", () => {
  const rejected = [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
  ];

  for (const address of rejected) {
    assert.equal(isGlobalUnicastIp(address), false, address);
    assert.throws(() => assertGlobalUnicastIp(address), {
      code: "non_global_ip",
    });
  }
});

test("trusts CF-Connecting-IP only from a loopback peer", () => {
  assert.deepEqual(
    extractTrustedCloudflareClientIp({
      remoteAddress: "127.0.0.1",
      connectingIpHeader: "8.8.8.8",
    }),
    { address: "8.8.8.8", family: 4 },
  );
  assert.deepEqual(
    extractTrustedCloudflareClientIp({
      remoteAddress: "::1",
      connectingIpHeader: "2606:4700:4700::1111",
    }),
    { address: "2606:4700:4700::1111", family: 6 },
  );
});
test("rejects spoofable, ambiguous, and invalid connecting IP headers", () => {
  assert.throws(
    () =>
      extractTrustedCloudflareClientIp({
        remoteAddress: "8.8.8.8",
        connectingIpHeader: "1.1.1.1",
      }),
    { code: "untrusted_proxy" },
  );
  assert.throws(
    () =>
      extractTrustedCloudflareClientIp({
        remoteAddress: "127.0.0.1",
        connectingIpHeader: "8.8.8.8, 1.1.1.1",
      }),
    { code: "invalid_ip" },
  );
  assert.throws(
    () =>
      extractTrustedCloudflareClientIp({
        remoteAddress: "127.0.0.1",
        connectingIpHeader: "127.0.0.1",
      }),
    { code: "non_global_ip" },
  );
});
