import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const INPUT_INTERVAL_MS = 60;
const HIGHLIGHT_COOLDOWN_MS = 5_000;
const MESSAGE_SEQUENCE_MS = 3_200;
const PLANE_CONTROL_DELAY_MS = 520;
const ROUTE_MINIMUM_MS = 5_200;
const ROUTE_STEP_MS = 1_050;

export class ControllerSessionError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "ControllerSessionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function tokenDigest(token) {
  return createHash("sha256").update(String(token), "utf8").digest();
}

function boundedInput(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ControllerSessionError(
      "invalid_controller_input",
      `${field} must be a finite number`,
    );
  }
  return Math.max(-1, Math.min(1, value));
}

function routeDuration(record) {
  const stepCount = record?.observation?.steps?.length || 1;
  return Math.max(ROUTE_MINIMUM_MS, stepCount * ROUTE_STEP_MS);
}

export class ControllerSessionService {
  #clock;
  #recordProvider;
  #recordTtlMs;
  #sessions = new Map();
  #subscribers = new Set();
  #tokenFactory;
  #uuidFactory;

  constructor({
    recordProvider,
    recordTtlMs = 900_000,
    clock = () => new Date(),
    tokenFactory = () => randomBytes(32).toString("base64url"),
    uuidFactory = () => randomUUID(),
  }) {
    if (typeof recordProvider !== "function") {
      throw new TypeError("ControllerSessionService requires recordProvider");
    }
    this.#recordProvider = recordProvider;
    this.#recordTtlMs = Math.max(60_000, Number(recordTtlMs) || 900_000);
    this.#clock = clock;
    this.#tokenFactory = tokenFactory;
    this.#uuidFactory = uuidFactory;
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Controller subscriber must be a function");
    }
    this.#subscribers.add(listener);
    return () => this.#subscribers.delete(listener);
  }

  create(measurementId) {
    this.#expireSessions();
    const now = this.#clock();
    const token = this.#tokenFactory();
    const sessionId = this.#uuidFactory();
    const session = {
      sessionId,
      measurementId,
      tokenDigest: tokenDigest(token),
      createdAt: now.getTime(),
      expiresAt: now.getTime() + this.#recordTtlMs,
      lastInputAt: 0,
      lastSequence: -1,
      lastHighlightAt: 0,
      ended: false,
    };
    this.#sessions.set(sessionId, session);
    return Object.freeze({
      schemaVersion: 1,
      sessionId,
      token,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  }

  status(sessionId, token) {
    const session = this.#authenticate(sessionId, token);
    return this.#publicStatus(session);
  }

  input(sessionId, token, { x, y, sequence }) {
    const session = this.#authenticate(sessionId, token);
    const status = this.#publicStatus(session);
    if (!status.controllable) {
      throw new ControllerSessionError(
        "plane_not_ready",
        "The paper plane is not controllable yet",
        409,
      );
    }
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new ControllerSessionError(
        "invalid_controller_sequence",
        "sequence must be a non-negative safe integer",
      );
    }
    if (sequence <= session.lastSequence) {
      throw new ControllerSessionError(
        "stale_controller_input",
        "Controller input sequence is stale",
        409,
      );
    }

    const resolvedX = boundedInput(x, "x");
    const resolvedY = boundedInput(y, "y");
    const now = this.#clock().getTime();
    const isNeutral = resolvedX === 0 && resolvedY === 0;
    if (!isNeutral && now - session.lastInputAt < INPUT_INTERVAL_MS) {
      throw new ControllerSessionError(
        "controller_rate_limited",
        "Controller input is arriving too quickly",
        429,
      );
    }

    session.lastInputAt = now;
    session.lastSequence = sequence;
    this.#publish({
      schemaVersion: 1,
      type: "plane-control",
      occurredAt: new Date(now).toISOString(),
      measurementId: session.measurementId,
      x: resolvedX,
      y: resolvedY,
      sequence,
    });
    return Object.freeze({
      accepted: true,
      sequence,
      x: resolvedX,
      y: resolvedY,
    });
  }

  highlight(sessionId, token) {
    const session = this.#authenticate(sessionId, token);
    const status = this.#publicStatus(session);
    if (!status.routeReady) {
      throw new ControllerSessionError(
        "route_not_ready",
        "The observed route is not ready",
        409,
      );
    }
    const now = this.#clock().getTime();
    if (now - session.lastHighlightAt < HIGHLIGHT_COOLDOWN_MS) {
      throw new ControllerSessionError(
        "highlight_rate_limited",
        "Route highlight is cooling down",
        429,
      );
    }
    session.lastHighlightAt = now;
    this.#publish({
      schemaVersion: 1,
      type: "route-highlight",
      occurredAt: new Date(now).toISOString(),
      measurementId: session.measurementId,
    });
    return Object.freeze({
      accepted: true,
      activeUntil: new Date(now + 4_000).toISOString(),
    });
  }

  end(sessionId, token) {
    const session = this.#authenticate(sessionId, token);
    session.ended = true;
    session.lastSequence += 1;
    const now = this.#clock().getTime();
    this.#publish({
      schemaVersion: 1,
      type: "plane-control",
      occurredAt: new Date(now).toISOString(),
      measurementId: session.measurementId,
      x: 0,
      y: 0,
      sequence: session.lastSequence,
    });
    return Object.freeze({ ended: true });
  }

  #authenticate(sessionId, token) {
    this.#expireSessions();
    const session = this.#sessions.get(sessionId);
    const suppliedDigest = tokenDigest(token || "");
    if (
      !session ||
      suppliedDigest.length !== session.tokenDigest.length ||
      !timingSafeEqual(suppliedDigest, session.tokenDigest)
    ) {
      throw new ControllerSessionError(
        "controller_unauthorized",
        "Controller session credentials are invalid",
        401,
      );
    }
    return session;
  }

  #publicStatus(session) {
    const now = this.#clock().getTime();
    if (session.ended) {
      return this.#statusPayload(session, "ended", false, false);
    }
    const record = this.#recordProvider(session.measurementId);
    if (!record || now >= session.expiresAt) {
      return Object.freeze({
        schemaVersion: 1,
        sessionId: session.sessionId,
        phase: "ended",
        controllable: false,
        routeReady: false,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    }
    if (record.status === "queued") {
      return this.#statusPayload(session, "connecting", false, false);
    }
    if (record.status === "running") {
      return this.#statusPayload(session, "measuring", false, false);
    }
    if (record.status === "failed") {
      return this.#statusPayload(session, "ended", false, false);
    }

    const completedAt = Date.parse(
      record.observation?.observedAt || record.updatedAt,
    );
    const elapsed = Math.max(0, now - completedAt);
    const flightMs = routeDuration(record);
    if (elapsed < flightMs) {
      return this.#statusPayload(session, "carrying", false, true);
    }
    if (elapsed < flightMs + MESSAGE_SEQUENCE_MS * 0.58) {
      return this.#statusPayload(session, "opening", false, true);
    }
    if (
      elapsed <
      flightMs + MESSAGE_SEQUENCE_MS + PLANE_CONTROL_DELAY_MS
    ) {
      return this.#statusPayload(session, "preparing", false, true);
    }
    return this.#statusPayload(session, "controllable", true, true);
  }

  #statusPayload(session, phase, controllable, routeReady) {
    return Object.freeze({
      schemaVersion: 1,
      sessionId: session.sessionId,
      phase,
      controllable,
      routeReady,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  }

  #publish(event) {
    for (const listener of this.#subscribers) {
      try {
        listener(structuredClone(Object.freeze(event)));
      } catch {
        // A disconnected exhibition display must not fail controller input.
      }
    }
  }

  #expireSessions() {
    const now = this.#clock().getTime();
    for (const [sessionId, session] of this.#sessions) {
      if (session.expiresAt <= now) this.#sessions.delete(sessionId);
    }
  }
}
