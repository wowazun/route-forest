import { spawn } from "node:child_process";

export class TracerouteExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TracerouteExecutionError";
    this.code = code;
  }
}

export function buildTracerouteArguments(target, options, method = "udp") {
  if (method !== "icmp" && method !== "udp") {
    throw new TypeError(`Unsupported traceroute method: ${method}`);
  }

  const args = [
    target.family === 6 ? "-6" : "-4",
  ];
  if (method === "icmp") args.push("-I");
  args.push(
    "-n",
    "-m",
    String(options.maxHops),
    "-q",
    "1",
    "-w",
    String(options.hopWaitSeconds),
    target.address,
  );
  return Object.freeze(args);
}

export class TracerouteRunner {
  #options;

  constructor(options) {
    this.#options = Object.freeze({ ...options });
  }

  run(target, { method = "udp" } = {}) {
    const args = buildTracerouteArguments(target, this.#options, method);

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let timedOut = false;
      let overflowed = false;
      let settled = false;

      const child = spawn(this.#options.binary, args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const finishWithError = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };

      const append = (current, chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > this.#options.maxOutputBytes) {
          overflowed = true;
          child.kill("SIGKILL");
          return current;
        }
        return current + chunk.toString("utf8");
      };

      child.stdout.on("data", (chunk) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr = append(stderr, chunk);
      });
      child.on("error", () => {
        finishWithError(
          new TracerouteExecutionError(
            "spawn_failed",
            "The traceroute process could not be started",
          ),
        );
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.#options.timeoutMs);
      timer.unref();

      child.on("close", (exitCode, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (overflowed) {
          reject(
            new TracerouteExecutionError(
              "output_limit",
              "The traceroute output limit was exceeded",
            ),
          );
          return;
        }

        resolve(
          Object.freeze({
            stdout,
            stderr,
            exitCode,
            signal,
            timedOut,
          }),
        );
      });
    });
  }
}
