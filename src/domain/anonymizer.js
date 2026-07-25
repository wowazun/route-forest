import { createHmac } from "node:crypto";

export class NodeAnonymizer {
  #secret;

  constructor(secret) {
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("Anonymization secret must contain at least 32 bytes");
    }
    this.#secret = secret;
  }

  identify({ address, family }) {
    return createHmac("sha256", this.#secret)
      .update(`route-node:v1:ipv${family}:${address}`, "utf8")
      .digest("base64url");
  }

  identifyParticipant({ address, family }) {
    return createHmac("sha256", this.#secret)
      .update(`participant-rate-key:v1:ipv${family}:${address}`, "utf8")
      .digest("base64url");
  }
}
