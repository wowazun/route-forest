import net from "node:net";
import { domainToASCII } from "node:url";

const RESERVED_SUFFIXES = Object.freeze([
  ".example",
  ".invalid",
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".test",
]);

export class WebsiteDestinationError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "WebsiteDestinationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function normalizeWebsiteDestination(input) {
  if (typeof input !== "string") {
    throw new WebsiteDestinationError(
      "website_required",
      "A website hostname is required",
    );
  }

  const value = input.trim();
  if (!value || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new WebsiteDestinationError(
      "invalid_website",
      "The website value is invalid",
    );
  }

  let parsed;
  try {
    parsed = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
  } catch {
    throw new WebsiteDestinationError(
      "invalid_website",
      "Enter a valid website hostname",
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new WebsiteDestinationError(
      "unsupported_website_scheme",
      "Only HTTP and HTTPS website addresses are accepted",
    );
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new WebsiteDestinationError(
      "invalid_website",
      "Credentials and custom ports are not accepted",
    );
  }

  const hostname = domainToASCII(parsed.hostname.replace(/\.$/, "")).toLowerCase();
  if (
    !hostname ||
    hostname.length > 253 ||
    net.isIP(hostname) !== 0 ||
    !hostname.includes(".") ||
    RESERVED_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    )
  ) {
    throw new WebsiteDestinationError(
      "website_not_allowed",
      "Enter a public website domain name",
    );
  }

  const labels = hostname.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new WebsiteDestinationError(
      "invalid_website",
      "Enter a valid website domain name",
    );
  }

  return Object.freeze({ hostname });
}
