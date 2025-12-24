const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { AppError, buildErrorPayload, getErrorEntry } = require("./errors");

const app = express();
const prisma = new PrismaClient();

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

app.use(express.json());

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

function getUtcMinutes(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

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

app.get("/services", async (req, res, next) => {
  try {
    const services = await prisma.services.findMany({
      orderBy: { id: "asc" },
    });
    res.status(200).json({ ok: true, services });
  } catch (err) {
    next(err);
  }
});

app.post("/services", async (req, res, next) => {
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

  try {
    const service = await prisma.services.create({
      data: {
        name,
        description,
        duration_minutes: durationMinutes,
        active,
        created_at: new Date(),
      },
    });

    res.status(201).json({ ok: true, service });
  } catch (err) {
    next(err);
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

  if (err && err.status === 400) {
    const entry = getErrorEntry("VALIDATION_ERROR");
    res.status(entry.httpStatus).json(buildErrorPayload(entry.code));
    return;
  }

  const entry = getErrorEntry("INTERNAL_ERROR");
  res.status(entry.httpStatus).json(buildErrorPayload(entry.code));
});

module.exports = app;
