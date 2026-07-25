import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIpAddress } from "../src/domain/ip-address.js";
import { buildTracerouteArguments } from "../src/infrastructure/traceroute-runner.js";

const options = {
  maxHops: 24,
  hopWaitSeconds: 0.5,
};

test("builds a fixed IPv4 UDP traceroute argument list", () => {
  assert.deepEqual(
    buildTracerouteArguments(normalizeIpAddress("8.8.8.8"), options),
    ["-4", "-n", "-m", "24", "-q", "1", "-w", "0.5", "8.8.8.8"],
  );
});

test("builds a fixed IPv6 UDP traceroute argument list", () => {
  assert.deepEqual(
    buildTracerouteArguments(
      normalizeIpAddress("2606:4700:4700::1111"),
      options,
    ),
    [
      "-6",
      "-n",
      "-m",
      "24",
      "-q",
      "1",
      "-w",
      "0.5",
      "2606:4700:4700::1111",
    ],
  );
});

test("builds a fixed IPv4 ICMP traceroute argument list", () => {
  assert.deepEqual(
    buildTracerouteArguments(
      normalizeIpAddress("8.8.8.8"),
      options,
      "icmp",
    ),
    [
      "-4",
      "-I",
      "-n",
      "-m",
      "24",
      "-q",
      "1",
      "-w",
      "0.5",
      "8.8.8.8",
    ],
  );
});

test("rejects unsupported traceroute methods", () => {
  assert.throws(
    () =>
      buildTracerouteArguments(
        normalizeIpAddress("8.8.8.8"),
        options,
        "shell",
      ),
    /Unsupported traceroute method/,
  );
});
