const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { AppError, buildErrorPayload, getErrorEntry } = require("./errors");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get("/health", (req, res) => {
  const runtimeEnv = process.env.NODE_ENV || (process.env.PORT ? "production" : "development");
  res.status(200).json({
    ok: true,
    service: "nexus-booking-api",
    env: runtimeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/bookings", async (req, res, next) => {
  const { user_id, service_id, start_at, test_case } = req.body || {};

  const startDate = start_at ? new Date(start_at) : null;
  const isValidUser = Number.isInteger(user_id) && user_id > 0;
  const isValidService = Number.isInteger(service_id) && service_id > 0;
  const isValidStart = startDate instanceof Date && !Number.isNaN(startDate.getTime());

  if (!isValidUser || !isValidService || !isValidStart) {
    return next(
      new AppError("VALIDATION_ERROR", {
        user_id: isValidUser,
        service_id: isValidService,
        start_at: isValidStart,
      })
    );
  }

  if (test_case === "conflict") {
    return next(new AppError("CONFLICT", { reason: "Simulated conflict" }));
  }

  if (test_case === "internal") {
    throw new Error("Simulated unexpected error");
  }

  try {
    await prisma.bookings.create({
      data: {
        user_id,
        service_id,
        start_at: startDate,
        status: "pending",
        created_at: new Date(),
      },
    });
  } catch (err) {
    if (err && err.code === "P2002") {
      return next(new AppError("CONFLICT", { target: err.meta && err.meta.target }));
    }
    if (err && err.code === "P2003") {
      return next(new AppError("NOT_FOUND", { target: err.meta && err.meta.field_name }));
    }
    return next(err);
  }

  return res.status(201).json({ ok: true });
});

app.use((req, res) => {
  const entry = getErrorEntry("NOT_FOUND");
  res.status(entry.httpStatus).json(buildErrorPayload(entry.code));
});

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    const entry = getErrorEntry(err.code);
    res.status(entry.httpStatus).json(buildErrorPayload(entry.code, err.details));
    return;
  }

  const entry = getErrorEntry("INTERNAL_ERROR");
  res.status(entry.httpStatus).json(buildErrorPayload(entry.code));
});

module.exports = app;
