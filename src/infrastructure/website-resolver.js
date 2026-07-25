import { resolve4 } from "node:dns/promises";
import {
  assertGlobalUnicastIp,
  isGlobalUnicastIp,
} from "../domain/ip-address.js";

export class WebsiteResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WebsiteResolutionError";
    this.code = code;
  }
}

export class WebsiteResolver {
  #resolve4;
  #timeoutMs;

  constructor({ lookup = resolve4, timeoutMs = 4_000 } = {}) {
    this.#resolve4 = lookup;
    this.#timeoutMs = timeoutMs;
  }

  async resolve(destination) {
    let timer;
    try {
      const answers = await Promise.race([
        this.#resolve4(destination.hostname),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new WebsiteResolutionError(
                "destination_resolution_timeout",
                "Website address resolution timed out",
              ),
            );
          }, this.#timeoutMs);
          timer.unref();
        }),
      ]);

      if (!Array.isArray(answers) || answers.length === 0) {
        throw new WebsiteResolutionError(
          "destination_unavailable",
          "The website has no usable IPv4 address",
        );
      }

      const addresses = answers.map((answer) =>
        typeof answer === "string" ? answer : answer?.address,
      );
      if (
        addresses.some(
          (address) =>
            typeof address !== "string" || !isGlobalUnicastIp(address),
        )
      ) {
        throw new WebsiteResolutionError(
          "destination_not_allowed",
          "The website resolved to a non-public address",
        );
      }

      return assertGlobalUnicastIp(
        [...new Set(addresses)].sort((left, right) =>
          left.localeCompare(right, "en", { numeric: true }),
        )[0],
      );
    } catch (error) {
      if (error instanceof WebsiteResolutionError) throw error;
      throw new WebsiteResolutionError(
        "destination_unavailable",
        "The website address could not be resolved",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
