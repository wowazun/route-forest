import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  extractTrustedCloudflareClientIp,
  IpAddressError,
} from "../domain/ip-address.js";
import { MeasurementRequestError } from "../application/measurement-service.js";
import { QueueFullError } from "../application/bounded-job-queue.js";
import { WebsiteDestinationError } from "../domain/website-destination.js";

const MAX_BODY_BYTES = 4096;
const DEFAULT_PUBLIC_DIRECTORY = fileURLToPath(
  new URL("../../public/", import.meta.url),
);
const STATIC_FILES = Object.freeze({
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  "/display": ["display.html", "text/html; charset=utf-8"],
  "/display/": ["display.html", "text/html; charset=utf-8"],
  "/display.js": ["display.js", "text/javascript; charset=utf-8"],
  "/display-art.js": ["display-art.js", "text/javascript; charset=utf-8"],
  "/bird-art.js": ["bird-art.js", "text/javascript; charset=utf-8"],
  "/message-art.js": ["message-art.js", "text/javascript; charset=utf-8"],
  "/fog-art.js": ["fog-art.js", "text/javascript; charset=utf-8"],
  "/tree-art.js": ["tree-art.js", "text/javascript; charset=utf-8"],
  "/display.css": ["display.css", "text/css; charset=utf-8"],
  "/simulator": ["simulator.html", "text/html; charset=utf-8"],
  "/simulator/": ["simulator.html", "text/html; charset=utf-8"],
  "/simulator.js": ["simulator.js", "text/javascript; charset=utf-8"],
  "/simulator.css": ["simulator.css", "text/css; charset=utf-8"],
  "/simulator-scenarios.js": [
    "simulator-scenarios.js",
    "text/javascript; charset=utf-8",
  ],
  "/style-guide": ["style-guide.html", "text/html; charset=utf-8"],
  "/style-guide/": ["style-guide.html", "text/html; charset=utf-8"],
  "/style-guide.js": ["style-guide.js", "text/javascript; charset=utf-8"],
  "/style-guide.css": ["style-guide.css", "text/css; charset=utf-8"],
  "/visual-style.js": ["visual-style.js", "text/javascript; charset=utf-8"],
  "/art-lab": ["art-lab.html", "text/html; charset=utf-8"],
  "/art-lab/": ["art-lab.html", "text/html; charset=utf-8"],
  "/art-lab.js": ["art-lab.js", "text/javascript; charset=utf-8"],
  "/art-lab.css": ["art-lab.css", "text/css; charset=utf-8"],
  "/art-variants.js": ["art-variants.js", "text/javascript; charset=utf-8"],
  "/experience-contract.js": [
    "experience-contract.js",
    "text/javascript; charset=utf-8",
  ],
  "/exhibition-effects.js": [
    "exhibition-effects.js",
    "text/javascript; charset=utf-8",
  ],
  "/control-lab": ["control-lab.html", "text/html; charset=utf-8"],
  "/control-lab/": ["control-lab.html", "text/html; charset=utf-8"],
  "/control-lab.js": ["control-lab.js", "text/javascript; charset=utf-8"],
  "/control-lab.css": ["control-lab.css", "text/css; charset=utf-8"],
  "/flow-field.js": ["flow-field.js", "text/javascript; charset=utf-8"],
  "/qr.svg": ["qr.svg", "image/svg+xml"],
});
const MAX_DISPLAY_CLIENTS = 8;
const FORBIDDEN_DESTINATION_FIELDS = new Set([
  "target",
  "ip",
  "address",
  "host",
  "hostname",
  "destination",
]);
const ALLOWED_MEASUREMENT_FIELDS = new Set([
  "consentAccepted",
  "consentVersion",
  "website",
]);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

async function sendStatic(response, pathname, publicDirectory) {
  const [filename, contentType] = STATIC_FILES[pathname];
  const body = await readFile(`${publicDirectory}/${filename}`);
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": body.length,
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "content-type": contentType,
    "cross-origin-opener-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function sendSseEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readJson(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new MeasurementRequestError(
      "unsupported_media_type",
      "Content-Type must be application/json",
      415,
    );
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new MeasurementRequestError(
        "body_too_large",
        "Request body is too large",
        413,
      );
    }
    chunks.push(chunk);
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object") {
      throw new Error("Expected an object");
    }
    return body;
  } catch {
    throw new MeasurementRequestError(
      "invalid_json",
      "Request body must be a JSON object",
    );
  }
}

function assertSafeMeasurementBody(body) {
  for (const field of Object.keys(body)) {
    if (FORBIDDEN_DESTINATION_FIELDS.has(field.toLowerCase())) {
      throw new MeasurementRequestError(
        "destination_not_allowed",
        "Measurement destinations cannot be supplied by clients",
      );
    }
    if (!ALLOWED_MEASUREMENT_FIELDS.has(field)) {
      throw new MeasurementRequestError(
        "unexpected_field",
        "The request contains an unsupported field",
      );
    }
  }
}

function assertAllowedOrigin(request, publicOrigin) {
  const origin = request.headers.origin;
  if (origin !== publicOrigin) {
    throw new MeasurementRequestError(
      "origin_not_allowed",
      "Request origin is not allowed",
      403,
    );
  }
}

function errorResponse(error) {
  if (
    error instanceof MeasurementRequestError ||
    error instanceof IpAddressError ||
    error instanceof WebsiteDestinationError
  ) {
    return {
      statusCode: error.statusCode || 400,
      payload: { error: { code: error.code, message: error.message } },
    };
  }
  if (error instanceof QueueFullError) {
    return {
      statusCode: 503,
      payload: { error: { code: error.code, message: error.message } },
    };
  }
  return {
    statusCode: 500,
    payload: {
      error: {
        code: "internal_error",
        message: "The request could not be completed",
      },
    },
  };
}

export function createHttpServer({
  measurementService,
  config,
  publicDirectory = DEFAULT_PUBLIC_DIRECTORY,
}) {
  const displayClients = new Set();

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && STATIC_FILES[url.pathname]) {
        await sendStatic(response, url.pathname, publicDirectory);
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          queue: measurementService.queueState,
        });
        return;
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/display/events"
      ) {
        if (displayClients.size >= MAX_DISPLAY_CLIENTS) {
          sendJson(response, 503, {
            error: {
              code: "display_capacity_reached",
              message: "Too many display clients are connected",
            },
          });
          return;
        }

        response.writeHead(200, {
          "cache-control": "no-store, no-transform",
          connection: "keep-alive",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
          "content-type": "text/event-stream; charset=utf-8",
          "referrer-policy": "no-referrer",
          "x-accel-buffering": "no",
          "x-content-type-options": "nosniff",
        });
        response.write("retry: 3000\n\n");
        sendSseEvent(response, "snapshot", {
          schemaVersion: 1,
          observations: measurementService.getRecentObservations(),
        });

        const unsubscribe = measurementService.subscribe((event) => {
          sendSseEvent(response, event.type, event);
        });
        const heartbeat = setInterval(() => {
          response.write(`: heartbeat ${Date.now()}\n\n`);
        }, 15_000);
        heartbeat.unref();

        const client = { response, unsubscribe, heartbeat };
        displayClients.add(client);
        request.once("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
          displayClients.delete(client);
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/measurements") {
        assertAllowedOrigin(request, config.publicOrigin);
        const body = await readJson(request);
        assertSafeMeasurementBody(body);
        const clientIp = extractTrustedCloudflareClientIp({
          remoteAddress: request.socket.remoteAddress,
          connectingIpHeader: request.headers["cf-connecting-ip"],
        });
        const record = measurementService.submit({
          clientIp,
          website: body.website,
          consentAccepted: body.consentAccepted,
          consentVersion: body.consentVersion,
        });
        sendJson(response, 202, record);
        return;
      }

      const statusMatch =
        request.method === "GET" &&
        /^\/api\/measurements\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (statusMatch) {
        const record = measurementService.get(statusMatch[1]);
        if (!record) {
          sendJson(response, 404, {
            error: {
              code: "measurement_not_found",
              message: "Measurement was not found",
            },
          });
          return;
        }
        sendJson(response, 200, record);
        return;
      }

      sendJson(response, 404, {
        error: { code: "not_found", message: "Route not found" },
      });
    } catch (error) {
      const { statusCode, payload } = errorResponse(error);
      sendJson(response, statusCode, payload);
    }
  });
}
