const http = require("http");

const port = Number(process.env.API_PORT) || 4000;

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
        process.exitCode = 0;
        return;
      }
      console.error(`health: status ${res.statusCode}`);
      console.error(body);
      process.exitCode = 1;
    });
  }
);

req.on("error", (err) => {
  console.error("health: request failed");
  console.error(err.message);
  process.exitCode = 1;
});

req.end();
