import net from "node:net";

export class IpAddressError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IpAddressError";
    this.code = code;
  }
}

function canonicalizeIpv4(value) {
  return value
    .split(".")
    .map((part) => String(Number.parseInt(part, 10)))
    .join(".");
}

function canonicalizeIpv6(value) {
  const parsed = new URL(`http://[${value}]/`);
  return parsed.hostname.slice(1, -1).toLowerCase();
}

export function normalizeIpAddress(input) {
  if (typeof input !== "string") {
    throw new IpAddressError("invalid_ip", "IP address must be a string");
  }

  let value = input.trim();
  if (!value || value.includes(",") || /\s/.test(value)) {
    throw new IpAddressError("invalid_ip", "Expected exactly one IP address");
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped && net.isIP(mapped[1]) === 4) {
    value = mapped[1];
  }

  const family = net.isIP(value);
  if (family === 4) {
    return Object.freeze({ address: canonicalizeIpv4(value), family: 4 });
  }
  if (family === 6) {
    return Object.freeze({ address: canonicalizeIpv6(value), family: 6 });
  }

  throw new IpAddressError("invalid_ip", "Invalid IP address");
}

function ipv4ToInteger(address) {
  return address
    .split(".")
    .reduce((total, part) => (total * 256 + Number.parseInt(part, 10)) >>> 0, 0);
}

function ipv4InCidr(address, base, prefix) {
  const value = ipv4ToInteger(address);
  const baseValue = ipv4ToInteger(base);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

const NON_GLOBAL_IPV4 = Object.freeze([
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]);

function parseIpv6Words(address) {
  const [leftPart, rightPart = ""] = address.split("::");
  const left = leftPart ? leftPart.split(":") : [];
  const right = rightPart ? rightPart.split(":") : [];
  const missing = 8 - left.length - right.length;
  return [
    ...left.map((word) => Number.parseInt(word, 16)),
    ...Array(Math.max(0, missing)).fill(0),
    ...right.map((word) => Number.parseInt(word, 16)),
  ];
}

function ipv6StartsWith(address, prefixWords, prefixBits) {
  const words = parseIpv6Words(address);
  const fullWords = Math.floor(prefixBits / 16);
  const remainder = prefixBits % 16;

  for (let index = 0; index < fullWords; index += 1) {
    if (words[index] !== prefixWords[index]) return false;
  }

  if (remainder === 0) return true;
  const mask = (0xffff << (16 - remainder)) & 0xffff;
  return (words[fullWords] & mask) === (prefixWords[fullWords] & mask);
}

export function isGlobalUnicastIp(input) {
  const normalized =
    typeof input === "string" ? normalizeIpAddress(input) : input;

  if (normalized.family === 4) {
    return !NON_GLOBAL_IPV4.some(([base, prefix]) =>
      ipv4InCidr(normalized.address, base, prefix),
    );
  }

  const words = parseIpv6Words(normalized.address);
  const isGlobal2000Block = (words[0] & 0xe000) === 0x2000;
  if (!isGlobal2000Block) return false;

  const documentation = ipv6StartsWith(
    normalized.address,
    [0x2001, 0x0db8, 0, 0, 0, 0, 0, 0],
    32,
  );
  const benchmarking = ipv6StartsWith(
    normalized.address,
    [0x2001, 0x0002, 0, 0, 0, 0, 0, 0],
    48,
  );
  return !documentation && !benchmarking;
}

export function assertGlobalUnicastIp(input) {
  const normalized = normalizeIpAddress(input);
  if (!isGlobalUnicastIp(normalized)) {
    throw new IpAddressError(
      "non_global_ip",
      "Only global unicast destination addresses are accepted",
    );
  }
  return normalized;
}

export function isLoopbackAddress(input) {
  let normalized;
  try {
    normalized = normalizeIpAddress(input);
  } catch {
    return false;
  }

  if (normalized.family === 4) {
    return ipv4InCidr(normalized.address, "127.0.0.0", 8);
  }
  return normalized.address === "::1";
}

export function extractTrustedCloudflareClientIp({
  remoteAddress,
  connectingIpHeader,
}) {
  if (!isLoopbackAddress(remoteAddress)) {
    throw new IpAddressError(
      "untrusted_proxy",
      "Client IP headers are accepted only from the loopback tunnel proxy",
    );
  }

  if (Array.isArray(connectingIpHeader)) {
    throw new IpAddressError(
      "ambiguous_client_ip",
      "Expected a single CF-Connecting-IP header",
    );
  }

  return assertGlobalUnicastIp(connectingIpHeader);
}
