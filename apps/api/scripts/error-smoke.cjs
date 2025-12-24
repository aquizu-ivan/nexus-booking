const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const port = Number(process.env.API_PORT) || 4000;
const serverPath = path.join(__dirname, "..", "src", "server.js");

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

function requestJson(method, reqPath, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : "";
    const headers = payload
      ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        }
      : {};

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk.toString("utf8");
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: responseBody });
        });
      }
    );

    req.on("error", reject);
    if (payload) {
      req.write(body);
    }
    req.end();
  });
}

async function waitForHealth(triesLeft) {
  try {
    const response = await requestJson("GET", "/health");
    if (response.statusCode === 200) {
      return;
    }
  } catch (err) {
    if (triesLeft <= 0) {
      throw err;
    }
  }

  if (triesLeft <= 0) {
    throw new Error("health: timeout");
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return waitForHealth(triesLeft - 1);
}

function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch (err) {
    return null;
  }
}

function validateResponse(label, response, expectedStatus, expectedCode) {
  const payload = parseJson(response.body);
  console.log(`\n${label}`);
  console.log(response.body);

  if (response.statusCode !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}`);
  }

  if (!payload || payload.ok !== false || !payload.error) {
    throw new Error("Response does not match error shape");
  }

  if (payload.error.code !== expectedCode) {
    throw new Error(`Expected code ${expectedCode}, got ${payload.error.code}`);
  }
}

function nextMondayUtcAtTen() {
  const now = new Date();
  const day = now.getUTCDay();
  let delta = (1 - day + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + delta);
  next.setUTCHours(10, 0, 0, 0);
  return next;
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
  console.error("error:smoke timeout");
  shutdown(1);
}, 8000);

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

    const validPayload = {
      user_id: 1,
      service_id: 1,
      start_at: nextMondayUtcAtTen().toISOString(),
    };

    const notFoundResponse = await requestJson("GET", "/missing");
    validateResponse("404 NOT_FOUND", notFoundResponse, 404, "NOT_FOUND");

    const validationResponse = await requestJson("POST", "/bookings", {});
    validateResponse("400 VALIDATION_ERROR", validationResponse, 400, "VALIDATION_ERROR");

    const firstCreate = await requestJson("POST", "/bookings", validPayload);
    console.log("\nPOST /bookings (primer intento)");
    console.log(firstCreate.body);

    const secondCreate = await requestJson("POST", "/bookings", validPayload);
    validateResponse("409 CONFLICT", secondCreate, 409, "CONFLICT");

    shutdown(0);
  } catch (err) {
    console.error(err.message || err);
    shutdown(1);
  }
})();
