import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { MeasurementService } from "../src/application/measurement-service.js";
import { NodeAnonymizer } from "../src/domain/anonymizer.js";
import { createHttpServer } from "../src/http/server.js";

const PUBLIC_ORIGIN = "https://route.example.com";

async function withServer(run) {
  const service = new MeasurementService({
    anonymizer: new NodeAnonymizer("http-test-secret-that-is-long-enough"),
    resolver: {
      resolve: async () => ({ address: "8.8.8.8", family: 4 }),
    },
    runner: {
      run: async () => ({
        stdout: "1  8.8.8.8  1.0 ms",
        stderr: "",
        exitCode: 0,
        signal: null,
        timedOut: false,
      }),
    },
    config: {
      concurrency: 1,
      queueCapacity: 4,
      cooldownMs: 60_000,
      recordTtlMs: 900_000,
      consentVersion: "v1",
    },
  });
  const server = createHttpServer({
    measurementService: service,
    config: { publicOrigin: PUBLIC_ORIGIN },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("accepts a consented request for a normalized website destination", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/measurements`, {
      method: "POST",
      headers: {
        "cf-connecting-ip": "8.8.8.8",
        "content-type": "application/json",
        origin: PUBLIC_ORIGIN,
      },
      body: JSON.stringify({
        website: "https://Example.com/a/path",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.match(body.measurementId, /^[0-9a-f-]{36}$/);
    assert.equal(body.destination.hostname, "example.com");
    assert.equal(JSON.stringify(body).includes("8.8.8.8"), false);
  });
});

test("serves the participation page and assets with a restrictive CSP", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /^text\/html/);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(html, /このサイトへ鳥を送る/);

    const stylesheet = await fetch(`${baseUrl}/styles.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /^text\/javascript/);
  });
});

test("serves the exhibition display and starts an anonymized event stream", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/display`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /情報通信路/);
    assert.match(html, /qr\.svg/);
    assert.match(html, /id="performance-monitor"/);

    const stylesheet = await fetch(`${baseUrl}/display.css`);
    assert.equal(stylesheet.status, 200);
    const script = await fetch(`${baseUrl}/display.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /__routeForestPerformance/);
    const displayArt = await fetch(`${baseUrl}/display-art.js`);
    assert.equal(displayArt.status, 200);
    assert.match(displayArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await displayArt.text(), /drawRouteHighlight/);
    const birdArt = await fetch(`${baseUrl}/bird-art.js`);
    assert.equal(birdArt.status, 200);
    assert.match(birdArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await birdArt.text(), /BIRD_ART_VERSION/);
    const messageArt = await fetch(`${baseUrl}/message-art.js`);
    assert.equal(messageArt.status, 200);
    assert.match(messageArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await messageArt.text(), /MESSAGE_ART_VERSION/);
    const fogArt = await fetch(`${baseUrl}/fog-art.js`);
    assert.equal(fogArt.status, 200);
    assert.match(fogArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await fogArt.text(), /FOG_ART_VERSION/);
    const treeArt = await fetch(`${baseUrl}/tree-art.js`);
    assert.equal(treeArt.status, 200);
    assert.match(treeArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await treeArt.text(), /TREE_ART_VERSION/);
    const contract = await fetch(`${baseUrl}/experience-contract.js`);
    assert.equal(contract.status, 200);
    assert.match(contract.headers.get("content-type"), /^text\/javascript/);
    const effects = await fetch(`${baseUrl}/exhibition-effects.js`);
    assert.equal(effects.status, 200);
    assert.match(effects.headers.get("content-type"), /^text\/javascript/);
    const performancePage = await fetch(
      `${baseUrl}/display?performance=1`,
    );
    assert.equal(performancePage.status, 200);
    assert.match(await performancePage.text(), /FIELD LOAD \/ FRAME PULSE/);
    const qr = await fetch(`${baseUrl}/qr.svg`);
    assert.equal(qr.status, 200);
    assert.match(qr.headers.get("content-type"), /^image\/svg\+xml/);

    const stream = await fetch(`${baseUrl}/api/display/events`);
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get("content-type"), /^text\/event-stream/);
    const reader = stream.body.getReader();
    const firstChunk = new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    assert.match(firstChunk, /retry: 3000|event: snapshot/);
  });
});

test("serves the isolated paper-plane control lab and flow-field module", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/control-lab`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /風の操縦実験/);
    assert.match(html, /id="control-pad"/);

    const stylesheet = await fetch(`${baseUrl}/control-lab.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const controller = await fetch(`${baseUrl}/control-lab.js`);
    assert.equal(controller.status, 200);
    assert.match(await controller.text(), /__routeForestControlLab/);

    const flowField = await fetch(`${baseUrl}/flow-field.js`);
    assert.equal(flowField.status, 200);
    assert.match(flowField.headers.get("content-type"), /^text\/javascript/);
  });
});

test("serves the scenario simulator and reusable scenario module", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/simulator`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /経路を、/);
    assert.match(html, /id="scenario-list"/);

    const stylesheet = await fetch(`${baseUrl}/simulator.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const controller = await fetch(`${baseUrl}/simulator.js`);
    assert.equal(controller.status, 200);
    assert.match(await controller.text(), /__routeForestSimulator/);

    const scenarios = await fetch(`${baseUrl}/simulator-scenarios.js`);
    assert.equal(scenarios.status, 200);
    assert.match(scenarios.headers.get("content-type"), /^text\/javascript/);
  });
});

test("serves the executable visual style guide and tokens", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/style-guide`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /闇の中で、/);
    assert.match(html, /id="asset-grid"/);

    const stylesheet = await fetch(`${baseUrl}/style-guide.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const controller = await fetch(`${baseUrl}/style-guide.js`);
    assert.equal(controller.status, 200);
    assert.match(await controller.text(), /__routeForestStyleGuide/);

    const tokens = await fetch(`${baseUrl}/visual-style.js`);
    assert.equal(tokens.status, 200);
    assert.match(tokens.headers.get("content-type"), /^text\/javascript/);
  });
});

test("serves the isolated Art Lab and vector art directions", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/art-lab`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /鳥と木を、/);
    assert.match(html, /id="proofs"/);

    const stylesheet = await fetch(`${baseUrl}/art-lab.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const controller = await fetch(`${baseUrl}/art-lab.js`);
    assert.equal(controller.status, 200);
    assert.match(await controller.text(), /__routeForestArtLab/);

    const variants = await fetch(`${baseUrl}/art-variants.js`);
    assert.equal(variants.status, 200);
    assert.match(variants.headers.get("content-type"), /^text\/javascript/);
  });
});

test("rejects all client-supplied destination fields", async () => {
  await withServer(async (baseUrl) => {
    for (const field of ["target", "ip", "host", "hostname", "destination"]) {
      const response = await fetch(`${baseUrl}/api/measurements`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "8.8.8.8",
          "content-type": "application/json",
          origin: PUBLIC_ORIGIN,
        },
        body: JSON.stringify({
          website: "example.com",
          consentAccepted: true,
          consentVersion: "v1",
          [field]: "1.1.1.1",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 400, field);
      assert.equal(body.error.code, "destination_not_allowed", field);
    }
  });
});

test("rejects IP literals in the website field before queueing work", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/measurements`, {
      method: "POST",
      headers: {
        "cf-connecting-ip": "8.8.8.8",
        "content-type": "application/json",
        origin: PUBLIC_ORIGIN,
      },
      body: JSON.stringify({
        website: "http://127.0.0.1/admin",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "website_not_allowed");
  });
});

test("rejects a missing trusted header and a cross-origin request", async () => {
  await withServer(async (baseUrl) => {
    const missingHeader = await fetch(`${baseUrl}/api/measurements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: PUBLIC_ORIGIN,
      },
      body: JSON.stringify({
        website: "example.com",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    });
    assert.equal(missingHeader.status, 400);

    const crossOrigin = await fetch(`${baseUrl}/api/measurements`, {
      method: "POST",
      headers: {
        "cf-connecting-ip": "8.8.8.8",
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
      body: JSON.stringify({
        website: "example.com",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    });
    assert.equal(crossOrigin.status, 403);
  });
});
