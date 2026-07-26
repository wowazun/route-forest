import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { MeasurementService } from "../src/application/measurement-service.js";
import { ControllerSessionService } from "../src/application/controller-session-service.js";
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

async function withReadyControllerServer(run) {
  const service = new MeasurementService({
    anonymizer: new NodeAnonymizer("controller-test-secret-that-is-long-enough"),
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
  const controllerService = new ControllerSessionService({
    recordProvider: (measurementId) => service.get(measurementId),
    clock: () => new Date(Date.now() + 60_000),
  });
  const server = createHttpServer({
    measurementService: service,
    controllerService,
    config: { publicOrigin: PUBLIC_ORIGIN },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
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
    assert.match(body.controller.sessionId, /^[0-9a-f-]{36}$/);
    assert.ok(body.controller.token.length >= 32);
    assert.match(body.controller.color, /^#[0-9a-f]{6}$/);
    assert.equal(body.destination.hostname, "example.com");
    assert.equal(JSON.stringify(body).includes("8.8.8.8"), false);

    const controllerStatus = await fetch(
      `${baseUrl}/api/controller/sessions/${body.controller.sessionId}`,
      {
        headers: {
          authorization: `Bearer ${body.controller.token}`,
        },
      },
    );
    assert.equal(controllerStatus.status, 200);
    assert.match(
      (await controllerStatus.json()).phase,
      /connecting|measuring|carrying|opening|preparing|controllable/,
    );

    const unauthorized = await fetch(
      `${baseUrl}/api/controller/sessions/${body.controller.sessionId}`,
      {
        headers: {
          authorization: `Bearer ${"x".repeat(43)}`,
        },
      },
    );
    assert.equal(unauthorized.status, 401);
  });
});

test("forwards authenticated controller input and route highlights to displays", async () => {
  await withReadyControllerServer(async (baseUrl) => {
    const stream = await fetch(`${baseUrl}/api/display/events`);
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let streamText = "";
    async function readUntil(pattern) {
      const deadline = Date.now() + 2_000;
      while (!streamText.includes(pattern) && Date.now() < deadline) {
        const result = await Promise.race([
          reader.read(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SSE read timed out")), 500),
          ),
        ]);
        if (result.done) break;
        streamText += decoder.decode(result.value);
      }
      assert.match(streamText, new RegExp(pattern));
    }

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
      }),
    });
    const created = await response.json();
    let record;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      record = await (
        await fetch(`${baseUrl}/api/measurements/${created.measurementId}`)
      ).json();
      if (record.status === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(record.status, "completed");

    const input = await fetch(
      `${baseUrl}/api/controller/sessions/${created.controller.sessionId}/input`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${created.controller.token}`,
          "content-type": "application/json",
          origin: PUBLIC_ORIGIN,
        },
        body: JSON.stringify({
          x: 2,
          y: -2,
          sequence: 1,
          inputAt: Date.now(),
        }),
      },
    );
    assert.equal(input.status, 202);
    assert.deepEqual(await input.json(), {
      accepted: true,
      sequence: 1,
      x: 1,
      y: -1,
    });
    await readUntil("event: plane-control");
    assert.match(streamText, new RegExp(created.measurementId));
    assert.match(streamText, /"controller":\{"sessionId":.+?"color":"#[0-9a-f]{6}"/);

    const highlight = await fetch(
      `${baseUrl}/api/controller/sessions/${created.controller.sessionId}/highlight`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${created.controller.token}`,
          origin: PUBLIC_ORIGIN,
        },
      },
    );
    assert.equal(highlight.status, 202);
    await readUntil("event: route-highlight");

    const ended = await fetch(
      `${baseUrl}/api/controller/sessions/${created.controller.sessionId}/end`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${created.controller.token}`,
          origin: PUBLIC_ORIGIN,
        },
      },
    );
    assert.equal(ended.status, 200);
    await readUntil("event: controller-ended");
    await reader.cancel();
  });
});

test("serves the participation page and assets with a restrictive CSP", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /^text\/html/);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(html, /<title>渡り路<\/title>/);
    assert.match(html, /鳥を送る/);
    assert.match(html, /作品について/);
    assert.doesNotMatch(html, /ROUTE OBSERVATION|TECHNICAL STUDY/);

    const stylesheet = await fetch(`${baseUrl}/styles.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /^text\/javascript/);
    assert.match(await script.text(), /controller-pad|sendControllerInput/);
  });
});

test("serves the exhibition display and starts an anonymized event stream", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/display`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /渡り路/);
    assert.match(html, /qr\.svg/);
    assert.match(html, /育った木/);
    assert.match(html, /届いた経路/);
    assert.match(html, /スマートフォンで読み取ってください/);
    assert.doesNotMatch(html, /YOUR ROUTE/);
    assert.doesNotMatch(html, /class="ticket-copy"/);
    assert.doesNotMatch(html, /class="field-key"/);
    assert.match(html, /id="display-calibration"/);
    assert.match(html, /id="art-scale"/);
    assert.match(html, /id="qr-scale"/);
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
    const routeArt = await fetch(`${baseUrl}/route-art.js`);
    assert.equal(routeArt.status, 200);
    assert.match(routeArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await routeArt.text(), /ROUTE_ART_VERSION/);
    const birdArt = await fetch(`${baseUrl}/bird-art.js`);
    assert.equal(birdArt.status, 200);
    assert.match(birdArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await birdArt.text(), /BIRD_ART_VERSION/);
    const featherArt = await fetch(`${baseUrl}/feather-art.js`);
    assert.equal(featherArt.status, 200);
    assert.match(featherArt.headers.get("content-type"), /^text\/javascript/);
    assert.match(await featherArt.text(), /DEFAULT_FEATHER_ART/);
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
