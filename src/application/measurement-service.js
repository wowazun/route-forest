import { randomUUID } from "node:crypto";
import { BoundedJobQueue } from "./bounded-job-queue.js";
import {
  normalizeRouteObservation,
  parseTracerouteOutput,
} from "../domain/route-normalizer.js";
import { normalizeWebsiteDestination } from "../domain/website-destination.js";

export class MeasurementRequestError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "MeasurementRequestError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function publicRecord(record) {
  return structuredClone(record);
}

export class MeasurementService {
  #anonymizer;
  #clock;
  #config;
  #lastSubmissionByParticipant = new Map();
  #queue;
  #recentObservations = [];
  #records = new Map();
  #resolver;
  #runner;
  #subscribers = new Set();
  #treeVisitsByNode = new Map();

  constructor({
    anonymizer,
    resolver,
    runner,
    config,
    clock = () => new Date(),
  }) {
    this.#anonymizer = anonymizer;
    this.#resolver = resolver;
    this.#runner = runner;
    this.#config = config;
    this.#clock = clock;
    this.#queue = new BoundedJobQueue({
      capacity: config.queueCapacity,
      concurrency: config.concurrency,
    });
  }

  get queueState() {
    return this.#queue.state;
  }

  getRecentObservations() {
    this.#expireOldRecords();
    return structuredClone(this.#recentObservations);
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Measurement subscriber must be a function");
    }
    this.#subscribers.add(listener);
    return () => {
      this.#subscribers.delete(listener);
    };
  }

  submit({ clientIp, website, consentAccepted, consentVersion }) {
    this.#expireOldRecords();
    if (consentAccepted !== true) {
      throw new MeasurementRequestError(
        "consent_required",
        "Explicit consent is required",
      );
    }
    if (consentVersion !== this.#config.consentVersion) {
      throw new MeasurementRequestError(
        "consent_version_mismatch",
        "The consent text has changed",
        409,
      );
    }
    const destination = normalizeWebsiteDestination(website);

    const participantKey = this.#anonymizer.identifyParticipant(clientIp);
    const now = this.#clock();
    const lastSubmission = this.#lastSubmissionByParticipant.get(participantKey);
    if (
      lastSubmission &&
      now.getTime() - lastSubmission.getTime() < this.#config.cooldownMs
    ) {
      throw new MeasurementRequestError(
        "rate_limited",
        "A measurement was already requested recently",
        429,
      );
    }

    const measurementId = randomUUID();
    const record = {
      schemaVersion: 2,
      measurementId,
      destination,
      addressFamily: null,
      status: "queued",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      observation: null,
      failure: null,
    };

    const job = { destination };
    this.#queue.enqueue(async () => {
      await this.#execute(measurementId, job);
    });

    this.#records.set(measurementId, record);
    this.#lastSubmissionByParticipant.set(participantKey, now);
    return publicRecord(record);
  }

  get(measurementId) {
    this.#expireOldRecords();
    const record = this.#records.get(measurementId);
    return record ? publicRecord(record) : null;
  }

  async #execute(measurementId, job) {
    const record = this.#records.get(measurementId);
    if (!record) {
      job.target = undefined;
      return;
    }

    record.status = "running";
    record.updatedAt = this.#clock().toISOString();
    let target;

    try {
      target = await this.#resolver.resolve(job.destination);
      record.addressFamily = target.family;
      const methods = this.#config.tracerouteMethods || ["udp"];
      let result;
      let hops = [];
      let method = methods[0];

      for (const candidateMethod of methods) {
        method = candidateMethod;
        try {
          result = await this.#runner.run(target, {
            method: candidateMethod,
          });
          hops = parseTracerouteOutput(result.stdout);
        } catch (error) {
          if (candidateMethod === methods.at(-1)) throw error;
          continue;
        }

        const hasObservedAddress = hops.some((hop) => hop.addresses.length > 0);
        if (hasObservedAddress || candidateMethod === methods.at(-1)) break;
      }

      const reachedTarget = hops.some((hop) =>
        hop.addresses.some(
          (address) =>
            address.family === target.family &&
            address.address === target.address,
        ),
      );

      let kind = "command_error";
      if (result.timedOut) kind = hops.length > 0 ? "partial_timeout" : "timeout";
      else if (reachedTarget) kind = "destination_reached";
      else if (result.exitCode === 0) kind = "completed_without_destination";
      else if (hops.length > 0) kind = "partial_result";

      if (kind === "command_error") {
        record.status = "failed";
        record.failure = Object.freeze({
          code: "traceroute_failed",
          category: "system",
        });
      } else {
        record.status = "completed";
        record.observation = this.#withTreeGrowth(
          normalizeRouteObservation({
            measurementId,
            observedAt: this.#clock().toISOString(),
            destination: job.destination,
            target,
            method,
            hops,
            anonymizer: this.#anonymizer,
            termination: {
              kind,
              exitCode: result.exitCode,
            },
          }),
        );
        this.#publishObservation(record.observation);
      }
    } catch (error) {
      record.status = "failed";
      record.failure = Object.freeze({
        code: error?.code || "worker_error",
        category: error?.code?.startsWith("destination_")
          ? "destination"
          : "system",
      });
    } finally {
      target = undefined;
      job.destination = undefined;
      record.updatedAt = this.#clock().toISOString();
    }
  }

  #withTreeGrowth(observation) {
    const steps = observation.steps.map((step) => {
      if (step.kind !== "observed-node") return step;
      const nodes = step.nodes.map((node) => {
        const treeVisitCount =
          (this.#treeVisitsByNode.get(node.nodeId) || 0) + 1;
        this.#treeVisitsByNode.set(node.nodeId, treeVisitCount);
        return Object.freeze({ ...node, treeVisitCount });
      });
      return Object.freeze({ ...step, nodes: Object.freeze(nodes) });
    });
    return Object.freeze({
      ...observation,
      steps: Object.freeze(steps),
    });
  }

  #expireOldRecords() {
    const cutoff = this.#clock().getTime() - this.#config.recordTtlMs;
    for (const [measurementId, record] of this.#records) {
      if (Date.parse(record.createdAt) < cutoff) {
        this.#records.delete(measurementId);
      }
    }
    for (const [participantKey, submittedAt] of this.#lastSubmissionByParticipant) {
      if (submittedAt.getTime() < cutoff) {
        this.#lastSubmissionByParticipant.delete(participantKey);
      }
    }
    this.#recentObservations = this.#recentObservations.filter(
      (event) => Date.parse(event.occurredAt) >= cutoff,
    );
  }

  #publishObservation(observation) {
    const event = Object.freeze({
      schemaVersion: 1,
      type: "route-observed",
      occurredAt: observation.observedAt,
      observation,
    });
    this.#recentObservations.push(event);
    const limit = this.#config.recentObservationLimit || 64;
    if (this.#recentObservations.length > limit) {
      this.#recentObservations.splice(
        0,
        this.#recentObservations.length - limit,
      );
    }

    for (const listener of this.#subscribers) {
      try {
        listener(structuredClone(event));
      } catch {
        // A disconnected display must never fail a measurement job.
      }
    }
  }
}
