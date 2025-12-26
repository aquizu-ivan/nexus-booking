const { randomUUID } = require("crypto");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { AppError, buildErrorPayload, getErrorEntry } = require("./errors");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const app = express();
const prisma = new PrismaClient();
const startedAt = new Date().toISOString();
const gitSha = process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || "unknown";
app.locals.startedAt = startedAt;
app.locals.gitSha = gitSha;

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

app.use(express.json());
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});
const corsAllowList = (
  process.env.CORS_ORIGIN || "http://localhost:5173,https://aquizu-ivan.github.io"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const originHeader = req.get("Origin");
  const isAllowedOrigin = originHeader && corsAllowList.includes(originHeader);

  if (isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", originHeader);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-ADMIN-TOKEN");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return "\"unserializable\"";
  }
}

function logError(err, req) {
  const requestId = req && req.requestId ? req.requestId : "unknown";
  const method = req && req.method ? req.method : "unknown";
  const path = req && (req.originalUrl || req.url) ? req.originalUrl || req.url : "unknown";
  const prismaCode = err && typeof err.code === "string" ? err.code : "n/a";
  const prismaMeta = err && err.meta ? safeStringify(err.meta) : "n/a";
  console.error(
    `ERROR request_id=${requestId} method=${method} path=${path} prisma_code=${prismaCode} prisma_meta=${prismaMeta}`
  );
}

function parseDayOfWeek(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return DAY_NAMES.includes(normalized) ? normalized : null;
}

function getUtcMinutes(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!configuredToken) {
    return next(new AppError("FORBIDDEN", { reason: "admin token not configured" }));
  }

  const providedToken = req.get("X-ADMIN-TOKEN");
  if (!providedToken) {
    return next(new AppError("UNAUTHORIZED", { reason: "missing admin token" }));
  }

  if (providedToken !== configuredToken) {
    return next(new AppError("FORBIDDEN", { reason: "invalid admin token" }));
  }

  return next();
}

function handleCreateService(req, res, next) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const durationMinutes = parsePositiveInt(req.body?.duration_minutes);
  const active = typeof req.body?.active === "boolean" ? req.body.active : true;

  if (!name || !description || !durationMinutes) {
    return next(
      new AppError("VALIDATION_ERROR", {
        name: Boolean(name),
        description: Boolean(description),
        duration_minutes: Boolean(durationMinutes),
      })
    );
  }

  return prisma.services
    .create({
      data: {
        name,
        description,
        duration_minutes: durationMinutes,
        active,
        created_at: new Date(),
      },
    })
    .then((service) => {
      res.status(201).json({ ok: true, service });
    })
    .catch((err) => {
      next(err);
    });
}

app.get("/health", (req, res) => {
  const runtimeEnv = process.env.NODE_ENV || (process.env.PORT ? "production" : "development");
  res.status(200).json({
    ok: true,
    service: "nexus-booking-api",
    env: runtimeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    gitSha: app.locals.gitSha,
    startedAt: app.locals.startedAt,
    node: process.version,
    expected: {
      apiBase: process.env.PUBLIC_API_BASE || process.env.API_PUBLIC_URL || null,
      webBasePath: "/nexus-booking/",
      webBaseUrl: process.env.PUBLIC_WEB_BASE || null,
      routes: ["/health", "/services", "/availability", "/bookings", "/admin/..."],
    },
  });
});

app.get("/services", async (req, res, next) => {
  try {
    const services = await prisma.services.findMany({
      orderBy: { id: "asc" },
    });
    res.status(200).json({ ok: true, services });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    if (err && typeof err.code === "string") {
      logError(err, req);
      return res.status(200).json({ ok: true, services: [] });
    }
    return next(err);
  }
});

app.post("/services", handleCreateService);

app.post("/users", async (req, res, next) => {
  const alias = typeof req.body?.alias === "string" ? req.body.alias.trim() : "";
  const clientSeed = typeof req.body?.clientSeed === "string" ? req.body.clientSeed.trim() : "";

  if (!alias || !clientSeed) {
    return next(
      new AppError("VALIDATION_ERROR", {
        alias: Boolean(alias),
        clientSeed: Boolean(clientSeed),
      })
    );
  }

  try {
    const existing = await prisma.users.findUnique({
      where: { clientSeed },
    });
    if (existing) {
      return res.status(200).json({ ok: true, user: { id: existing.id, alias: existing.name } });
    }

    const user = await prisma.users.create({
      data: {
        name: alias,
        clientSeed,
        created_at: new Date(),
      },
    });

    return res.status(201).json({ ok: true, user: { id: user.id, alias: user.name } });
  } catch (err) {
    if (err && err.code === "P2002") {
      try {
        const existing = await prisma.users.findUnique({
          where: { clientSeed },
        });
        if (existing) {
          return res.status(200).json({ ok: true, user: { id: existing.id, alias: existing.name } });
        }
      } catch (innerErr) {
        return next(innerErr);
      }
    }
    return next(err);
  }
});

app.get("/availability", async (req, res, next) => {
  const serviceId = parsePositiveInt(req.query?.serviceId);
  const dateValue = parseDateOnly(req.query?.date);

  if (!serviceId || !dateValue) {
    return next(
      new AppError("VALIDATION_ERROR", {
        serviceId: Boolean(serviceId),
        date: Boolean(dateValue),
      })
    );
  }

  try {
    const service = await prisma.services.findUnique({ where: { id: serviceId } });
    if (!service) {
      return next(new AppError("NOT_FOUND", { target: "service", service_id: serviceId }));
    }

    const dayName = DAY_NAMES[dateValue.getUTCDay()];
    const slots = await prisma.availability.findMany({
      where: {
        service_id: serviceId,
        day_of_week: dayName,
        active: true,
      },
      orderBy: { start_time: "asc" },
    });

    res.status(200).json({
      ok: true,
      service_id: serviceId,
      date: req.query.date,
      day_of_week: dayName,
      slots: slots.map((slot) => ({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
      })),
    });
  } catch (err) {
    next(err);
  }
});

app.post("/bookings", async (req, res, next) => {
  const userId = parsePositiveInt(req.body?.user_id);
  const serviceId = parsePositiveInt(req.body?.service_id);
  const startDate = req.body?.start_at ? new Date(req.body.start_at) : null;
  const isValidStart = startDate instanceof Date && !Number.isNaN(startDate.getTime());

  if (!userId || !serviceId || !isValidStart) {
    return next(
      new AppError("VALIDATION_ERROR", {
        user_id: Boolean(userId),
        service_id: Boolean(serviceId),
        start_at: isValidStart,
      })
    );
  }

  if (startDate.getTime() < Date.now()) {
    return next(new AppError("VALIDATION_ERROR", { start_at: "past" }));
  }

  try {
    const [user, service] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.services.findUnique({ where: { id: serviceId } }),
    ]);

    if (!user) {
      return next(new AppError("NOT_FOUND", { target: "user", user_id: userId }));
    }

    if (!service) {
      return next(new AppError("NOT_FOUND", { target: "service", service_id: serviceId }));
    }

    if (!service.active) {
      return next(new AppError("VALIDATION_ERROR", { service_id: serviceId, active: false }));
    }

    const dayName = DAY_NAMES[startDate.getUTCDay()];
    const startMinutes = getUtcMinutes(startDate);
    const durationMinutes = service.duration_minutes;
    const endMinutes = startMinutes + durationMinutes;

    if (endMinutes > 24 * 60) {
      return next(new AppError("VALIDATION_ERROR", { start_at: "invalid window" }));
    }

    const availability = await prisma.availability.findMany({
      where: {
        service_id: serviceId,
        day_of_week: dayName,
        active: true,
      },
    });

    const fitsWindow = availability.some((slot) => {
      const slotStart = parseTimeToMinutes(slot.start_time);
      const slotEnd = parseTimeToMinutes(slot.end_time);
      if (slotStart === null || slotEnd === null) {
        return false;
      }
      return startMinutes >= slotStart && endMinutes <= slotEnd;
    });

    if (!fitsWindow) {
      return next(new AppError("CONFLICT", { reason: "outside availability" }));
    }

    const dayStart = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0)
    );
    const dayEnd = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 23, 59, 59, 999)
    );

    const existing = await prisma.bookings.findMany({
      where: {
        service_id: serviceId,
        start_at: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    const requestedEnd = new Date(startDate.getTime() + durationMinutes * 60000);
    const hasOverlap = existing.some((booking) => {
      const bookingStart = booking.start_at;
      const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60000);
      return startDate < bookingEnd && requestedEnd > bookingStart;
    });

    if (hasOverlap) {
      return next(new AppError("CONFLICT", { reason: "overlap" }));
    }

    const booking = await prisma.bookings.create({
      data: {
        user_id: userId,
        service_id: serviceId,
        start_at: startDate,
        status: "pending",
        created_at: new Date(),
      },
    });

    res.status(201).json({ ok: true, booking });
  } catch (err) {
    if (err && err.code === "P2002") {
      return next(new AppError("CONFLICT", { target: err.meta && err.meta.target }));
    }
    if (err && err.code === "P2003") {
      return next(new AppError("NOT_FOUND", { target: err.meta && err.meta.field_name }));
    }
    return next(err);
  }
});

app.post("/admin/services", requireAdmin, handleCreateService);
app.get("/admin/services", requireAdmin, async (req, res, next) => {
  try {
    const services = await prisma.services.findMany({
      orderBy: { id: "asc" },
    });
    res.status(200).json({ ok: true, services });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/availability", requireAdmin, async (req, res, next) => {
  const serviceId = parsePositiveInt(req.body?.service_id);
  const dayFromDate = parseDateOnly(req.body?.date);
  const dayName = dayFromDate ? DAY_NAMES[dayFromDate.getUTCDay()] : parseDayOfWeek(req.body?.day_of_week);
  const startTime = typeof req.body?.start_time === "string" ? req.body.start_time : "";
  const endTime = typeof req.body?.end_time === "string" ? req.body.end_time : "";
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const active = typeof req.body?.active === "boolean" ? req.body.active : true;

  if (!serviceId || !dayName || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return next(
      new AppError("VALIDATION_ERROR", {
        service_id: Boolean(serviceId),
        day_of_week: Boolean(dayName),
        start_time: startMinutes !== null,
        end_time: endMinutes !== null && endMinutes > startMinutes,
      })
    );
  }

  try {
    const service = await prisma.services.findUnique({ where: { id: serviceId } });
    if (!service) {
      return next(new AppError("NOT_FOUND", { target: "service", service_id: serviceId }));
    }

    const slot = await prisma.availability.create({
      data: {
        service_id: serviceId,
        day_of_week: dayName,
        start_time: startTime,
        end_time: endTime,
        active,
      },
    });

    res.status(201).json({ ok: true, slot });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/bookings", requireAdmin, async (req, res, next) => {
  const serviceIdRaw = req.query?.serviceId;
  const serviceId = serviceIdRaw ? parsePositiveInt(serviceIdRaw) : null;
  const dateValue = parseDateOnly(req.query?.date);

  if (!dateValue || (serviceIdRaw && !serviceId)) {
    return next(
      new AppError("VALIDATION_ERROR", {
        serviceId: Boolean(serviceId),
        date: Boolean(dateValue),
      })
    );
  }

  const dayStart = new Date(
    Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), 0, 0, 0, 0)
  );
  const dayEnd = new Date(
    Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), 23, 59, 59, 999)
  );

  try {
    const where = {
      start_at: {
        gte: dayStart,
        lte: dayEnd,
      },
    };
    if (serviceId) {
      where.service_id = serviceId;
    }

    const bookings = await prisma.bookings.findMany({
      where,
      orderBy: { start_at: "asc" },
    });

    res.status(200).json({ ok: true, bookings });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/bookings/:id/cancel", requireAdmin, async (req, res, next) => {
  const bookingId = parsePositiveInt(req.params?.id);
  if (!bookingId) {
    return next(new AppError("VALIDATION_ERROR", { id: false }));
  }

  try {
    const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return next(new AppError("NOT_FOUND", { target: "booking", id: bookingId }));
    }

    if (booking.status === "cancelled") {
      return res.status(200).json({ ok: true, booking });
    }

    const updated = await prisma.bookings.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
    });

    res.status(200).json({ ok: true, booking: updated });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  const entry = getErrorEntry("NOT_FOUND");
  res.status(entry.httpStatus).json(buildErrorPayload(entry.code, undefined, req.requestId));
});

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    const entry = getErrorEntry(err.code);
    res.status(entry.httpStatus).json(buildErrorPayload(entry.code, err.details, req.requestId));
    return;
  }

  if (err && err.status === 400) {
    const entry = getErrorEntry("VALIDATION_ERROR");
    res.status(entry.httpStatus).json(buildErrorPayload(entry.code, undefined, req.requestId));
    return;
  }

  logError(err, req);
  const entry = getErrorEntry("INTERNAL_ERROR");
  res.status(entry.httpStatus).json(buildErrorPayload(entry.code, undefined, req.requestId));
});

module.exports = app;
