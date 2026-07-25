import { loadConfig } from "./config.js";
import { NodeAnonymizer } from "./domain/anonymizer.js";
import { TracerouteRunner } from "./infrastructure/traceroute-runner.js";
import { WebsiteResolver } from "./infrastructure/website-resolver.js";
import { MeasurementService } from "./application/measurement-service.js";
import { createHttpServer } from "./http/server.js";

const config = loadConfig();
const anonymizer = new NodeAnonymizer(config.hmacSecret);
const runner = new TracerouteRunner(config.traceroute);
const resolver = new WebsiteResolver();
const tracerouteMethods = [config.traceroute.method];
if (
  config.traceroute.fallbackMethod !== "none" &&
  config.traceroute.fallbackMethod !== config.traceroute.method
) {
  tracerouteMethods.push(config.traceroute.fallbackMethod);
}
const measurementService = new MeasurementService({
  anonymizer,
  resolver,
  runner,
  config: {
    ...config.measurements,
    consentVersion: config.consentVersion,
    tracerouteMethods: Object.freeze(tracerouteMethods),
  },
});
const server = createHttpServer({ measurementService, config });

server.listen(config.port, config.host, () => {
  process.stdout.write(
    `Route Forest validation service listening on ${config.host}:${config.port}\n`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
