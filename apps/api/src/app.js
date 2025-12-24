const express = require("express");

const app = express();

app.use(express.json());

function buildError(code, message, details) {
  const error = { code, message, timestamp: new Date().toISOString() };
  if (details !== undefined) {
    error.details = details;
  }
  return { ok: false, error };
}

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "nexus-booking-api",
    env: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/bookings", (req, res, next) => {
  const { user_id, service_id, start_at } = req.body || {};

  const startDate = start_at ? new Date(start_at) : null;
  const isValidUser = Number.isInteger(user_id) && user_id > 0;
  const isValidService = Number.isInteger(service_id) && service_id > 0;
  const isValidStart = startDate instanceof Date && !Number.isNaN(startDate.getTime());

  if (!isValidUser || !isValidService || !isValidStart) {
    const err = new Error("Invalid booking payload");
    err.status = 400;
    err.code = "BAD_REQUEST";
    err.details = {
      user_id: isValidUser,
      service_id: isValidService,
      start_at: isValidStart,
    };
    return next(err);
  }

  return res.status(201).json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json(buildError("NOT_FOUND", "Not Found"));
});

app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const code = err.code || (status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR");
  const message = err.message || "Unexpected error";
  const details = err.details;

  res.status(status).json(buildError(code, message, details));
});

module.exports = app;
