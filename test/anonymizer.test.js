import assert from "node:assert/strict";
import test from "node:test";
import { NodeAnonymizer } from "../src/domain/anonymizer.js";
import { normalizeIpAddress } from "../src/domain/ip-address.js";

const SECRET_A = "a".repeat(32);
const SECRET_B = "b".repeat(32);

test("creates stable opaque node identifiers without exposing the IP", () => {
  const address = normalizeIpAddress("8.8.8.8");
  const anonymizer = new NodeAnonymizer(SECRET_A);
  const first = anonymizer.identify(address);
  const second = anonymizer.identify(address);

  assert.equal(first, second);
  assert.equal(first.includes("8.8.8.8"), false);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
});

test("separates node and participant namespaces", () => {
  const address = normalizeIpAddress("8.8.8.8");
  const anonymizer = new NodeAnonymizer(SECRET_A);
  assert.notEqual(
    anonymizer.identify(address),
    anonymizer.identifyParticipant(address),
  );
});
test("rotating the exhibition secret changes identifiers", () => {
  const address = normalizeIpAddress("2606:4700:4700::1111");
  assert.notEqual(
    new NodeAnonymizer(SECRET_A).identify(address),
    new NodeAnonymizer(SECRET_B).identify(address),
  );
});
