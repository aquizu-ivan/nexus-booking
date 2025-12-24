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

function requestHealth(triesLeft) {
  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/health",
      method: "GET",
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log(body);
          shutdown(0);
          return;
        }
        console.error(`health: status ${res.statusCode}`);
        console.error(body);
        shutdown(1);
      });
    }
  );

  req.on("error", (err) => {
    if (triesLeft > 0) {
      setTimeout(() => requestHealth(triesLeft - 1), 300);
      return;
    }
    console.error("health: request failed");
    console.error(err.message);
    shutdown(1);
  });

  req.end();
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  server.kill();
  setTimeout(() => {
    process.exit(code);
  }, 200);
}

const timeout = setTimeout(() => {
  console.error("health: timeout");
  shutdown(1);
}, 5000);

server.on("exit", (code) => {
  clearTimeout(timeout);
  if (!shuttingDown) {
    console.error(`server exited early with code ${code}`);
    process.exit(1);
  }
});

setTimeout(() => requestHealth(5), 300);
