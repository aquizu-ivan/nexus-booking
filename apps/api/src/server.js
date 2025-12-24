const app = require("./app");

const port = Number(process.env.PORT || process.env.API_PORT) || 4000;
const host = process.env.API_HOST || "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`nexus-booking-api listening on ${host}:${port}`);
});

module.exports = server;
