import { spawn } from "node:child_process";

const brave = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const port = 9333;
const browser = spawn(
  brave,
  [
    "--no-first-run",
    "--window-size=1100,720",
    "--window-position=40,40",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    "--user-data-dir=/tmp/ferrell-brave-profile",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cdpUp() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* starting */
    }
    await sleep(250);
  }
  throw new Error("browser debugging port did not open");
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
      return;
    }
    if (data.method === "Runtime.consoleAPICalled") {
      const text = data.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
      logs.push(`${data.params.type}: ${text}`);
    }
    if (data.method === "Runtime.exceptionThrown") {
      const details = data.params.exceptionDetails;
      logs.push(
        JSON.stringify(
          {
            text: details.text,
            url: details.url,
            line: details.lineNumber,
            column: details.columnNumber,
            exception: details.exception?.description,
            stack: details.stackTrace?.callFrames?.slice(0, 8),
          },
          null,
          2,
        ),
      );
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        logs,
        send(method, params = {}) {
          const msgId = ++id;
          ws.send(JSON.stringify({ id: msgId, method, params }));
          return new Promise((done) => pending.set(msgId, done));
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", () => reject(new Error("websocket failed")));
  });
}

async function inspect(path) {
  const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`http://127.0.0.1:4173${path}`)}`, {
    method: "PUT",
  }).then((res) => res.json());
  const page = await connect(created.webSocketDebuggerUrl);
  await page.send("Runtime.enable");
  await sleep(7000);
  const result = await page.send("Runtime.evaluate", {
    expression: `({
      label: document.getElementById("hourLabel")?.textContent ?? "",
      fly: document.getElementById("flyBtn")?.textContent ?? "",
      zones: document.getElementById("zonesBtn")?.textContent ?? "",
      tilt: document.getElementById("tiltBtn")?.textContent ?? "",
      effects: document.getElementById("effectsBtn")?.textContent ?? "",
      exportBtn: document.getElementById("exportBtn")?.textContent ?? "",
      fog: !!document.getElementById("ferrell-fog"),
      fx: !!document.getElementById("ferrell-fx"),
      clouds: !!document.getElementById("ferrell-clouds"),
      miniCanvas: !!document.querySelector("#miniMap canvas"),
      explored: document.getElementById("exploredChip")?.textContent ?? "",
      banner: document.getElementById("zoneBanner")?.textContent ?? "",
      windows: !!document.querySelector(".maplibregl-canvas")
    })`,
    returnByValue: true,
  });
  await page.send("Runtime.evaluate", {
    expression: `(() => {
      document.getElementById("zonesBtn")?.click();
      document.getElementById("tiltBtn")?.click();
      document.getElementById("effectsBtn")?.click();
      document.getElementById("flyBtn")?.click();
      document.getElementById("questBtn")?.click();
    })()`,
  });
  await sleep(400);
  const after = await page.send("Runtime.evaluate", {
    expression: `({
      zones: document.getElementById("zonesBtn")?.textContent ?? "",
      tilt: document.getElementById("tiltBtn")?.textContent ?? "",
      effects: document.getElementById("effectsBtn")?.textContent ?? "",
      fly: document.getElementById("flyBtn")?.textContent ?? "",
      quest: getComputedStyle(document.getElementById("questlog")).display,
      banner: document.getElementById("flyBanner")?.style.display ?? ""
    })`,
    returnByValue: true,
  });
  const value = {
    ...(result.result?.result?.value ?? {}),
    after: after.result?.result?.value,
  };
  const logs = page.logs.slice();
  page.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${created.id}`);
  return { path, value, logs };
}

try {
  await cdpUp();
  const created = await fetch(
    `http://127.0.0.1:${port}/json/new?http://127.0.0.1:4173/?time=12:00`,
    { method: "PUT" },
  ).then((res) => res.json());
  const page = await connect(created.webSocketDebuggerUrl);
  await page.send("Runtime.enable");
  await sleep(7000);
  await page.send("Runtime.evaluate", {
    expression: `localStorage.removeItem("realm-of-nash-progress-v1"); document.querySelector(".q-mark")?.click();`,
  });
  await sleep(3200);
  const card = await page.send("Runtime.evaluate", {
    expression: `({
      title: document.getElementById("loreTitle")?.textContent ?? "",
      accept: !!document.querySelector("#loreQuest .btn"),
      marker: !!document.querySelector(".q-mark")
    })`,
    returnByValue: true,
  });
  await page.send("Runtime.evaluate", {
    expression: `document.querySelector("#loreQuest .btn")?.click();`,
  });
  await sleep(300);
  const saved = await page.send("Runtime.evaluate", {
    expression: `localStorage.getItem("realm-of-nash-progress-v1")`,
    returnByValue: true,
  });
  await page.send("Page.reload");
  await sleep(4000);
  const reloaded = await page.send("Runtime.evaluate", {
    expression: `localStorage.getItem("realm-of-nash-progress-v1")`,
    returnByValue: true,
  });
  console.log(
    JSON.stringify(
      {
        card: card.result?.result?.value,
        saved: JSON.parse(saved.result?.result?.value ?? "null")?.activeQuestId ?? null,
        reloaded: JSON.parse(reloaded.result?.result?.value ?? "null")?.activeQuestId ?? null,
        logs: page.logs,
      },
      null,
      2,
    ),
  );
  page.close();
} finally {
  browser.kill("SIGTERM");
}
