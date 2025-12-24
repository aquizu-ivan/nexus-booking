const ERROR_CATALOG = Object.freeze({
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    httpStatus: 400,
    message: "Validation failed",
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    httpStatus: 404,
    message: "Not Found",
  },
  CONFLICT: {
    code: "CONFLICT",
    httpStatus: 409,
    message: "Conflict detected",
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    httpStatus: 500,
    message: "Internal error",
  },
});

function getErrorEntry(code) {
  return ERROR_CATALOG[code] || ERROR_CATALOG.INTERNAL_ERROR;
}

class AppError extends Error {
  constructor(code, details) {
    const entry = getErrorEntry(code);
    super(entry.message);
    this.code = entry.code;
    this.details = details;
  }
}

function buildErrorPayload(code, details) {
  const entry = getErrorEntry(code);
  const error = { code: entry.code, message: entry.message, timestamp: new Date().toISOString() };
  if (details !== undefined) {
    error.details = details;
  }
  return { ok: false, error };
}

module.exports = {
  ERROR_CATALOG,
  AppError,
  buildErrorPayload,
  getErrorEntry,
};
