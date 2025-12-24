const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const port = Number(process.env.API_PORT) || 4000;
const serverPath = path.join(__dirname, "..", "src", "server.js");
const total = Number(process.env.CONCURRENCY_N) || 20;

const server = spawn(process.execPath, [serverPath], {
  env: { ...process.env, API_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (data) => {
  process.stdout.write(data);
});

server.stderr.on("data", (data) => {
  process.stderr.write(data);
});

function requestJson(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/bookings",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve(res.statusCode);
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function waitForHealth(triesLeft) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/health",
        method: "GET",
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        if (triesLeft <= 0) {
          reject(new Error(`health: status ${res.statusCode}`));
          return;
        }
        setTimeout(() => resolve(waitForHealth(triesLeft - 1)), 300);
      }
    );

    req.on("error", (err) => {
      if (triesLeft <= 0) {
        reject(err);
        return;
      }
      setTimeout(() => resolve(waitForHealth(triesLeft - 1)), 300);
    });

    req.end();
  });
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  server.kill();
  setTimeout(() => process.exit(code), 200);
}

const timeout = setTimeout(() => {
  console.error("concurrency:smoke timeout");
  shutdown(1);
}, 10000);

server.on("exit", (code) => {
  clearTimeout(timeout);
  if (!shuttingDown) {
    console.error(`server exited early with code ${code}`);
    process.exit(1);
  }
});

(async () => {
  try {
    await waitForHealth(6);

    const startAt = new Date().toISOString();
    const payload = {
      user_id: 1,
      service_id: 1,
      start_at: startAt,
    };

    const results = await Promise.all(
      Array.from({ length: total }, () => requestJson(payload))
    );

    const created = results.filter((code) => code === 201).length;
    const conflicts = results.filter((code) => code === 409).length;
    const other = results.filter((code) => code !== 201 && code !== 409).length;

    console.log(`Total: ${total} | 201: ${created} | 409: ${conflicts} | other: ${other}`);

    if (created === 1 && conflicts === total - 1 && other === 0) {
      shutdown(0);
      return;
    }

    shutdown(1);
  } catch (err) {
    console.error(err.message || err);
    shutdown(1);
  }
})();
