import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const app = document.getElementById("app");

const uiState = {
  action: "-",
  result: "-",
  detail: "",
};

const routes = {
  "#/": renderHome,
  "#/services": renderServices,
  "#/booking": renderBooking,
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
      <a class="cta" href="#/booking">Reservar ahora</a>
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

function formatErrorDisplay(err) {
  if (err && err.type === "network") {
    return { message: "No se pudo conectar.", detail: "network/cors" };
  }

  if (err && err.type === "http") {
    let message = "Solicitud fallida.";
    if (err.status === 409) {
      message = "Ese horario ya fue tomado.";
    } else if (err.status >= 400 && err.status < 500) {
      message = "Datos invalidos.";
    } else if (err.status >= 500) {
      message = "Error interno.";
    }

    const detail = err.data?.error
      ? `${err.data.error.code}: ${err.data.error.message}`
      : "";
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
