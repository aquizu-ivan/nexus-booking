import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const app = document.getElementById("app");

let adminToken = "";

const uiState = {
  action: "-",
  result: "-",
  detail: "",
};

const routes = {
  "#/": renderHome,
  "#/services": renderServices,
  "#/booking": renderBooking,
  "#/admin": renderAdmin,
};

function setActiveLink() {
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.getAttribute("href") === window.location.hash) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

function updateStatus(action, result, detail = "") {
  uiState.action = action;
  uiState.result = result;
  uiState.detail = detail;
  renderStatus();
}

function renderStatus() {
  const actionEl = document.getElementById("status-action");
  if (!actionEl) {
    return;
  }
  const resultEl = document.getElementById("status-result");
  const detailEl = document.getElementById("status-detail");
  const apiEl = document.getElementById("status-api");

  apiEl.textContent = API_BASE;
  actionEl.textContent = uiState.action;
  resultEl.textContent = uiState.result;
  detailEl.textContent = uiState.detail;

  resultEl.dataset.state = uiState.result.startsWith("ok")
    ? "ok"
    : uiState.result.startsWith("error")
      ? "error"
      : "idle";
}

function renderLayout(content) {
  app.innerHTML = `
    <div class="page">
      <header>
        <div class="brand">
          <span class="mark">N</span>
          <div>
            <h1>Nexus Booking</h1>
            <p>Instrumento humano premium - minimo habitable</p>
          </div>
        </div>
        <nav>
          <a href="#/">Home</a>
          <a href="#/services">Services</a>
          <a href="#/booking">Reservar</a>
          <a href="#/admin">Admin</a>
        </nav>
      </header>
      <section class="status-panel">
        <div class="status-item">
          <span class="label">API_BASE</span>
          <span id="status-api"></span>
        </div>
        <div class="status-item">
          <span class="label">Ultima accion</span>
          <span id="status-action"></span>
        </div>
        <div class="status-item">
          <span class="label">Resultado</span>
          <span id="status-result" data-state="idle"></span>
          <small id="status-detail"></small>
        </div>
      </section>
      <main>${content}</main>
      <footer>
        <span>API Base: ${API_BASE}</span>
      </footer>
    </div>
  `;
  setActiveLink();
  renderStatus();
}

function renderHome() {
  renderLayout(`
    <section class="panel">
      <h2>Estado</h2>
      <p class="muted">Consulta el estado vivo del backend.</p>
      <div class="status">
        <button id="health-check">Ver /health</button>
        <pre id="health-output" aria-live="polite"></pre>
      </div>
    </section>
    <section class="panel">
      <h2>Accesos rapidos</h2>
      <p class="muted">Inicia el flujo principal del usuario final.</p>
      <div class="cta-row">
        <a class="cta" href="#/booking">Reservar ahora</a>
        <a class="ghost" href="#/admin">Admin</a>
      </div>
    </section>
  `);

  const button = document.getElementById("health-check");
  const output = document.getElementById("health-output");
  button.addEventListener("click", async () => {
    output.textContent = "Cargando...";
    try {
      const data = await apiRequest("health", "/health");
      output.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      output.textContent = formatErrorText(err);
    }
  });
}

function renderServices() {
  renderLayout(`
    <section class="panel">
      <h2>Servicios</h2>
      <p class="muted">Listado simple desde /services.</p>
      <div id="services-state" class="status">Cargando servicios...</div>
      <div id="services-list" class="grid"></div>
    </section>
  `);

  const state = document.getElementById("services-state");
  const list = document.getElementById("services-list");

  apiRequest("fetch services", "/services")
    .then((data) => {
      state.textContent = "";
      const services = data.services || [];
      if (services.length === 0) {
        setStatusMessage(state, "Sin servicios disponibles.");
        return;
      }
      list.innerHTML = services
        .map(
          (service) => `
            <article>
              <h3>${escapeHtml(service.name)}</h3>
              <p>${escapeHtml(service.description)}</p>
              <div class="meta">
                <span>Duracion: ${service.duration_minutes} min</span>
                <span>${service.active ? "Activo" : "Inactivo"}</span>
              </div>
            </article>
          `
        )
        .join("");
    })
    .catch((err) => {
      const display = formatErrorDisplay(err);
      setStatusMessage(state, display.message, display.detail, "error");
    });
}

function renderBooking() {
  renderLayout(`
    <section class="panel">
      <h2>Reservar</h2>
      <p class="muted">Selecciona servicio y fecha, luego confirma tu reserva.</p>

      <div class="step">
        <h3>Paso A: Servicio y fecha</h3>
        <div id="booking-services-state" class="status">Cargando servicios...</div>
        <div class="form-grid">
          <label>
            Servicio
            <select id="service-select" required>
              <option value="">Selecciona un servicio</option>
            </select>
          </label>
          <label>
            Fecha (UTC)
            <input id="date-input" type="date" required />
          </label>
        </div>
        <button id="availability-btn" type="button">Buscar disponibilidad</button>
      </div>

      <div class="step">
        <h3>Paso B: Slots disponibles</h3>
        <div id="availability-state" class="status">Selecciona servicio y fecha.</div>
        <div id="slots-list" class="slot-grid"></div>
      </div>

      <div class="step">
        <h3>Confirmar reserva</h3>
        <div id="booking-summary" class="summary">Sin slot seleccionado.</div>
        <label>
          user_id
          <input id="user-id-input" type="number" min="1" required />
        </label>
        <button id="booking-btn" type="button" disabled>Confirmar</button>
        <div id="booking-state" class="status"></div>
      </div>
    </section>
  `);

  const servicesState = document.getElementById("booking-services-state");
  const serviceSelect = document.getElementById("service-select");
  const dateInput = document.getElementById("date-input");
  const availabilityBtn = document.getElementById("availability-btn");
  const availabilityState = document.getElementById("availability-state");
  const slotsList = document.getElementById("slots-list");
  const summary = document.getElementById("booking-summary");
  const userIdInput = document.getElementById("user-id-input");
  const bookingBtn = document.getElementById("booking-btn");
  const bookingState = document.getElementById("booking-state");

  let services = [];
  let selectedSlot = null;

  function updateSummary() {
    if (!selectedSlot) {
      summary.textContent = "Sin slot seleccionado.";
      bookingBtn.disabled = true;
      return;
    }
    summary.textContent = `Servicio ${selectedSlot.serviceName} | ${selectedSlot.date} ${selectedSlot.start}`;
    bookingBtn.disabled = !(Number(userIdInput.value) > 0);
  }

  userIdInput.addEventListener("input", () => {
    updateSummary();
  });

  apiRequest("fetch services", "/services")
    .then((data) => {
      services = data.services || [];
      servicesState.textContent = "";
      if (services.length === 0) {
        setStatusMessage(servicesState, "Sin servicios disponibles.");
        return;
      }
      services.forEach((service) => {
        const option = document.createElement("option");
        option.value = String(service.id);
        option.textContent = `${service.name} (${service.duration_minutes} min)`;
        serviceSelect.append(option);
      });
    })
    .catch((err) => {
      const display = formatErrorDisplay(err);
      setStatusMessage(servicesState, display.message, display.detail, "error");
    });

  availabilityBtn.addEventListener("click", async () => {
    const serviceId = Number(serviceSelect.value);
    const dateValue = dateInput.value;

    if (!serviceId || !dateValue) {
      setStatusMessage(availabilityState, "Completa servicio y fecha.");
      return;
    }

    selectedSlot = null;
    updateSummary();
    slotsList.innerHTML = "";
    setStatusMessage(availabilityState, "Buscando disponibilidad...");

    try {
      const data = await apiRequest(
        "fetch availability",
        `/availability?serviceId=${serviceId}&date=${dateValue}`
      );
      const slots = data.slots || [];
      if (slots.length === 0) {
        setStatusMessage(availabilityState, "No hay slots para ese dia.");
        return;
      }

      availabilityState.textContent = "Selecciona un slot.";
      slotsList.innerHTML = slots
        .map(
          (slot) => `
            <button class="slot" type="button" data-start="${slot.start_time}">
              ${slot.start_time} - ${slot.end_time}
            </button>
          `
        )
        .join("");

      slotsList.querySelectorAll(".slot").forEach((button) => {
        button.addEventListener("click", () => {
          slotsList.querySelectorAll(".slot").forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
          const service = services.find((item) => item.id === serviceId);
          selectedSlot = {
            serviceId,
            serviceName: service ? service.name : String(serviceId),
            date: dateValue,
            start: button.dataset.start,
          };
          updateSummary();
        });
      });
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(availabilityState, display.message, display.detail, "error");
    }
  });

  bookingBtn.addEventListener("click", async () => {
    if (!selectedSlot) {
      setStatusMessage(bookingState, "Selecciona un slot primero.");
      return;
    }
    const userId = Number(userIdInput.value);
    if (!userId) {
      setStatusMessage(bookingState, "Ingresa user_id valido.");
      return;
    }

    setStatusMessage(bookingState, "Creando reserva...");

    try {
      const startAt = `${selectedSlot.date}T${selectedSlot.start}:00.000Z`;
      const data = await apiRequest("create booking", "/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          service_id: selectedSlot.serviceId,
          start_at: startAt,
        }),
      });
      setStatusMessage(
        bookingState,
        `Reserva creada. ID: ${data.booking?.id ?? "(sin id)"}`,
        "",
        "ok"
      );
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(bookingState, display.message, display.detail, "error");
    }
  });
}

function renderAdmin() {
  renderLayout(`
    <section class="panel">
      <h2>Admin minimo</h2>
      <p class="muted">Token solo en memoria. No se guarda.</p>
      <label>
        Admin token
        <input id="admin-token" type="password" placeholder="X-ADMIN-TOKEN" />
      </label>
      <div class="token-row">
        <span id="token-state" class="token-state">Sin token</span>
        <button id="token-clear" type="button">Limpiar token</button>
      </div>
    </section>

    <section class="panel">
      <h2>Servicios</h2>
      <div class="status-row">
        <button id="admin-services-load" type="button">Cargar servicios</button>
        <div id="admin-services-state" class="status"></div>
      </div>
      <div id="admin-services-list" class="grid"></div>
      <h3>Crear servicio</h3>
      <form id="admin-service-form">
        <label>
          name
          <input name="name" type="text" minlength="2" maxlength="80" required />
        </label>
        <label>
          description
          <input name="description" type="text" maxlength="500" />
        </label>
        <label>
          duration_min
          <input name="duration_min" type="number" min="5" required />
        </label>
        <label class="inline">
          <input name="active" type="checkbox" checked />
          active
        </label>
        <button type="submit">Crear</button>
      </form>
      <div id="admin-service-state" class="status"></div>
    </section>

    <section class="panel">
      <h2>Disponibilidad</h2>
      <form id="admin-availability-form">
        <label>
          service_id
          <input name="service_id" type="number" min="1" required />
        </label>
        <label>
          date (UTC)
          <input name="date" type="date" required />
        </label>
        <label>
          start_time
          <input name="start_time" type="time" required />
        </label>
        <label>
          end_time
          <input name="end_time" type="time" required />
        </label>
        <label class="inline">
          <input name="active" type="checkbox" checked />
          active
        </label>
        <button type="submit">Guardar slot</button>
      </form>
      <div id="admin-availability-state" class="status"></div>
    </section>

    <section class="panel">
      <h2>Reservas del dia</h2>
      <form id="admin-bookings-form">
        <label>
          service_id (opcional)
          <input name="service_id" type="number" min="1" />
        </label>
        <label>
          date (UTC)
          <input name="date" type="date" required />
        </label>
        <button type="submit">Ver reservas</button>
      </form>
      <div id="admin-bookings-state" class="status"></div>
      <div id="admin-bookings-list" class="grid"></div>
    </section>
  `);

  const tokenInput = document.getElementById("admin-token");
  const tokenState = document.getElementById("token-state");
  const tokenClear = document.getElementById("token-clear");
  const servicesLoad = document.getElementById("admin-services-load");
  const servicesState = document.getElementById("admin-services-state");
  const servicesList = document.getElementById("admin-services-list");
  const serviceForm = document.getElementById("admin-service-form");
  const serviceState = document.getElementById("admin-service-state");
  const availabilityForm = document.getElementById("admin-availability-form");
  const availabilityState = document.getElementById("admin-availability-state");
  const bookingsForm = document.getElementById("admin-bookings-form");
  const bookingsState = document.getElementById("admin-bookings-state");
  const bookingsList = document.getElementById("admin-bookings-list");

  function updateTokenState() {
    tokenState.textContent = adminToken ? `Token cargado ${maskToken(adminToken)}` : "Sin token";
  }

  tokenInput.addEventListener("input", () => {
    adminToken = tokenInput.value.trim();
    updateTokenState();
  });

  tokenClear.addEventListener("click", () => {
    adminToken = "";
    tokenInput.value = "";
    updateTokenState();
  });

  updateTokenState();

  servicesLoad.addEventListener("click", async () => {
    servicesList.innerHTML = "";
    if (!adminToken) {
      setStatusMessage(servicesState, "Token requerido.");
      return;
    }
    setStatusMessage(servicesState, "Cargando servicios...");
    try {
      const data = await adminRequest("admin fetch services", "/admin/services");
      const services = data.services || [];
      if (services.length === 0) {
        setStatusMessage(servicesState, "Sin servicios.");
        return;
      }
      servicesState.textContent = "";
      servicesList.innerHTML = services
        .map(
          (service) => `
            <article>
              <h3>${escapeHtml(service.name)}</h3>
              <p>${escapeHtml(service.description || "")}</p>
              <div class="meta">
                <span>Duracion: ${service.duration_minutes} min</span>
                <span>${service.active ? "Activo" : "Inactivo"}</span>
              </div>
            </article>
          `
        )
        .join("");
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(servicesState, display.message, display.detail, "error");
    }
  });

  serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminToken) {
      setStatusMessage(serviceState, "Token requerido.");
      return;
    }
    setStatusMessage(serviceState, "Creando servicio...");

    const formData = new FormData(serviceForm);
    const payload = {
      name: formData.get("name")?.toString().trim(),
      description: formData.get("description")?.toString().trim(),
      duration_min: Number(formData.get("duration_min")),
      active: formData.get("active") === "on",
    };

    try {
      const data = await adminRequest("admin create service", "/admin/services", payload);
      setStatusMessage(
        serviceState,
        `Servicio creado. ID: ${data.service?.id ?? "(sin id)"}`,
        "",
        "ok"
      );
      serviceForm.reset();
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(serviceState, display.message, display.detail, "error");
    }
  });

  availabilityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatusMessage(availabilityState, "Guardando disponibilidad...");

    const formData = new FormData(availabilityForm);
    const payload = {
      service_id: Number(formData.get("service_id")),
      date: formData.get("date")?.toString(),
      start_time: formData.get("start_time")?.toString(),
      end_time: formData.get("end_time")?.toString(),
      active: formData.get("active") === "on",
    };

    try {
      const data = await adminRequest("admin create availability", "/admin/availability", payload);
      setStatusMessage(
        availabilityState,
        `Slot creado. ID: ${data.slot?.id ?? "(sin id)"}`,
        "",
        "ok"
      );
      availabilityForm.reset();
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(availabilityState, display.message, display.detail, "error");
    }
  });

  bookingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatusMessage(bookingsState, "Buscando reservas...");
    bookingsList.innerHTML = "";

    const formData = new FormData(bookingsForm);
    const serviceId = formData.get("service_id")?.toString().trim();
    const dateValue = formData.get("date")?.toString().trim();
    const query = new URLSearchParams({ date: dateValue || "" });
    if (serviceId) {
      query.set("serviceId", serviceId);
    }

    try {
      const data = await adminRequest("admin fetch bookings", `/admin/bookings?${query.toString()}`);
      const bookings = data.bookings || [];
      if (bookings.length === 0) {
        setStatusMessage(bookingsState, "Sin reservas para ese dia.");
        return;
      }
      bookingsState.textContent = "";
      bookingsList.innerHTML = bookings
        .map(
          (booking) => `
            <article>
              <h3>#${booking.id}</h3>
              <p>Service: ${booking.service_id} | User: ${booking.user_id}</p>
              <p>Start: ${new Date(booking.start_at).toISOString()}</p>
              <p>Status: ${booking.status}</p>
              <button class="cancel-btn" data-id="${booking.id}">Cancelar</button>
            </article>
          `
        )
        .join("");

      bookingsList.querySelectorAll(".cancel-btn").forEach((button) => {
        button.addEventListener("click", async () => {
          const bookingId = button.dataset.id;
          button.disabled = true;
          try {
            const data = await adminRequest(
              "admin cancel booking",
              `/admin/bookings/${bookingId}/cancel`,
              { method: "POST" }
            );
            button.textContent = "Cancelado";
            button.disabled = true;
            updateStatus("admin cancel booking", "ok", `booking ${data.booking?.id || bookingId}`);
          } catch (err) {
            button.disabled = false;
            const display = formatErrorDisplay(err);
            setStatusMessage(bookingsState, display.message, display.detail, "error");
          }
        });
      });
    } catch (err) {
      const display = formatErrorDisplay(err);
      setStatusMessage(bookingsState, display.message, display.detail, "error");
    }
  });
}

async function apiRequest(action, path, options = {}) {
  updateStatus(action, "loading");
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (err) {
    updateStatus(action, "error network", "no connection");
    throw { type: "network" };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    updateStatus(action, `error ${response.status}`, data?.error?.code || "");
    throw { type: "http", status: response.status, data };
  }
  updateStatus(action, "ok");
  return data;
}

async function adminRequest(action, path, payload, options = {}) {
  if (!adminToken) {
    updateStatus(action, "error 401", "UNAUTHORIZED");
    throw { type: "missing-token" };
  }
  const headers = { ...(options.headers || {}) };
  if (adminToken) {
    headers["X-ADMIN-TOKEN"] = adminToken;
  }
  if (payload && !options.body) {
    headers["Content-Type"] = "application/json";
  }

  const requestOptions = {
    method: payload ? "POST" : options.method || "GET",
    ...options,
    headers,
    body: payload && !options.body ? JSON.stringify(payload) : options.body,
  };

  return apiRequest(action, path, requestOptions);
}

function formatErrorDisplay(err) {
  if (err && err.type === "network") {
    return { message: "No se pudo conectar.", detail: "network/cors" };
  }

  if (err && err.type === "missing-token") {
    return { message: "Token requerido.", detail: "X-ADMIN-TOKEN" };
  }

  if (err && err.type === "http") {
    let message = "Solicitud fallida.";
    if (err.status === 401) {
      message = "Token requerido.";
    } else if (err.status === 403) {
      message = "Token invalido.";
    } else if (err.status === 409) {
      message = "Ese horario ya fue tomado.";
    } else if (err.status >= 400 && err.status < 500) {
      message = "Datos invalidos.";
    } else if (err.status >= 500) {
      message = "Error interno.";
    }

    const detailParts = [];
    if (err.data?.error?.code && err.data?.error?.message) {
      detailParts.push(`${err.data.error.code}: ${err.data.error.message}`);
    } else if (err.data?.error?.code) {
      detailParts.push(err.data.error.code);
    }
    const details = err.data?.error?.details;
    if (details && typeof details === "object") {
      if (details.reason) {
        detailParts.push(`reason=${details.reason}`);
      }
      if (details.request_id) {
        detailParts.push(`request_id=${details.request_id}`);
      }
    }
    const detail = detailParts.join(" | ");
    return { message, detail };
  }

  return { message: "Error inesperado.", detail: "" };
}

function formatErrorText(err) {
  const display = formatErrorDisplay(err);
  return `${display.message}${display.detail ? ` (${display.detail})` : ""}`;
}

function setStatusMessage(element, message, detail = "", tone = "") {
  element.className = `status ${tone}`.trim();
  const safeMessage = escapeHtml(message);
  const safeDetail = detail ? `<small>${escapeHtml(detail)}</small>` : "";
  element.innerHTML = `${safeMessage}${safeDetail}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function maskToken(token) {
  const suffix = token.length >= 4 ? token.slice(-4) : "";
  return `****${suffix}`;
}

function renderRoute() {
  const route = routes[window.location.hash] || routes["#/"];
  route();
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) {
    window.location.hash = "#/";
  }
  renderRoute();
});
