function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function number(name, fallback, { min = 0, max = Number.MAX_VALUE } = {}) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function choice(name, fallback, allowed) {
  const value = process.env[name]?.trim().toLowerCase() || fallback;
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

export function loadConfig() {
  const hmacSecret = required("ROUTE_HMAC_SECRET");
  if (Buffer.byteLength(hmacSecret, "utf8") < 32) {
    throw new Error("ROUTE_HMAC_SECRET must contain at least 32 bytes");
  }

  const publicOrigin = new URL(required("PUBLIC_ORIGIN"));
  if (publicOrigin.protocol !== "https:") {
    throw new Error("PUBLIC_ORIGIN must use https");
  }
  return Object.freeze({
    host: process.env.HOST?.trim() || "127.0.0.1",
    port: integer("PORT", 8080, { min: 1, max: 65535 }),
    publicOrigin: publicOrigin.origin,
    consentVersion: process.env.CONSENT_VERSION?.trim() || "route-observation-v2",
    hmacSecret,
    traceroute: Object.freeze({
      binary: process.env.TRACEROUTE_BIN?.trim() || "traceroute",
      method: choice("TRACEROUTE_METHOD", "icmp", ["icmp", "udp"]),
      fallbackMethod: choice("TRACEROUTE_FALLBACK_METHOD", "udp", [
        "udp",
        "none",
      ]),
      ipv6Enabled: boolean("TRACEROUTE_IPV6_ENABLED", true),
      maxHops: integer("TRACEROUTE_MAX_HOPS", 24, { min: 1, max: 64 }),
      hopWaitSeconds: number("TRACEROUTE_HOP_WAIT_SECONDS", 0.5, {
        min: 0.1,
        max: 5,
      }),
      timeoutMs: integer("TRACEROUTE_TIMEOUT_MS", 12_000, {
        min: 1_000,
        max: 60_000,
      }),
      maxOutputBytes: integer("TRACEROUTE_MAX_OUTPUT_BYTES", 131_072, {
        min: 4_096,
        max: 1_048_576,
      }),
    }),
    measurements: Object.freeze({
      concurrency: integer("MEASUREMENT_CONCURRENCY", 2, { min: 1, max: 16 }),
      queueCapacity: integer("MEASUREMENT_QUEUE_CAPACITY", 20, {
        min: 1,
        max: 500,
      }),
      cooldownMs: integer("MEASUREMENT_COOLDOWN_MS", 60_000, {
        min: 1_000,
        max: 86_400_000,
      }),
      recordTtlMs: integer("MEASUREMENT_RECORD_TTL_MS", 900_000, {
        min: 60_000,
        max: 86_400_000,
      }),
    }),
  });
}
