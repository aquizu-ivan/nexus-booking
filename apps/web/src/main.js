import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const app = document.getElementById("app");

let adminToken = "";
let lastCreatedServiceId = null;
let lastCreatedServiceName = "";
const IDENTITY_STORAGE_KEY = "NEXUS_IDENTITY_V1";
let identity = loadIdentity();

const uiState = {
  action: "-",
  result: "-",
  detail: "",
};

function isDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") {
    return true;
  }
  return window.location.hash.includes("debug=1");
}

const routes = {
  "#/": renderHome,
  "#/services": renderServices,
  "#/booking": renderBooking,
  "#/admin": renderAdmin,
};

function loadIdentity() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const id = parsed.id;
    const alias = typeof parsed.alias === "string" ? parsed.alias : "";
    const clientSeed = typeof parsed.clientSeed === "string" ? parsed.clientSeed : "";
    if (!id || !alias || !clientSeed) {
      return null;
    }
    return { id, alias, clientSeed };
  } catch (err) {
    return null;
  }
}

function saveIdentity(nextIdentity) {
  identity = nextIdentity;
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
  } catch (err) {
    // ignore storage errors
  }
}

function clearIdentity() {
  identity = null;
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  } catch (err) {
    // ignore storage errors
  }
}

function getIdentity() {
  return identity;
}

function generateClientSeed() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `seed-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatIdentityId(value) {
  const raw = String(value);
  if (raw.length <= 4) {
    return raw;
  }
  return raw.slice(-4);
}

function normalizeSlotTime(value) {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function isValidSlotTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function renderIdentityPanel() {
  const current = getIdentity();
  if (current) {
    return `
      <section class="panel">
        <h2>Identidad activa</h2>
        <p class="muted">Alias: ${escapeHtml(current.alias)}</p>
        <div class="meta">
          <span>ID ${escapeHtml(formatIdentityId(current.id))}</span>
          <button id="identity-reset" type="button">Cambiar identidad</button>
        </div>
      </section>
    `;
  }
  return `
      <section class="panel">
        <h2>Tu identidad</h2>
        <p class="muted">Crea un alias para reservar.</p>
        <label>
        Alias
        <input id="identity-alias" type="text" maxlength="80" />
      </label>
      <button id="identity-create" type="button">Crear identidad</button>
      <div id="identity-state" class="status"></div>
    </section>
  `;
}

function wireIdentityPanel() {
  const createButton = document.getElementById("identity-create");
  const aliasInput = document.getElementById("identity-alias");
  const stateEl = document.getElementById("identity-state");
  if (createButton && aliasInput && stateEl) {
    createButton.addEventListener("click", async () => {
      const alias = aliasInput.value.trim();
      if (!alias) {
        setError(stateEl, "Ingresa un alias.");
        return;
      }
      setLoading(stateEl, "Creando...");
      setButtonLoading(createButton, "Creando...");
      aliasInput.disabled = true;
      const clientSeed = generateClientSeed();
      try {
        const data = await apiRequest("create identity", "/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias, clientSeed }),
        });
        if (!data.user || !data.user.id) {
          setError(stateEl, "No se pudo crear la identidad.");
          clearButtonLoading(createButton);
          aliasInput.disabled = false;
          return;
        }
        saveIdentity({
          id: data.user.id,
          alias: data.user.alias || alias,
          clientSeed,
        });
        renderRoute();
      } catch (err) {
        const display = formatErrorDisplay(err);
        setError(stateEl, display.message);
        clearButtonLoading(createButton);
        aliasInput.disabled = false;
      }
    });
  }

  const resetButton = document.getElementById("identity-reset");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      clearIdentity();
      renderRoute();
    });
  }
}

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
  if (!isDebugEnabled()) {
    return;
  }
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
  const debugEnabled = isDebugEnabled();
  const statusPanel = debugEnabled
    ? `
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
    `
    : "";
  const footer = debugEnabled ? `<footer><span>API Base: ${API_BASE}</span></footer>` : "";
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
      ${statusPanel}
      <main>${content}</main>
      ${footer}
    </div>
  `;
  setActiveLink();
  renderStatus();
}

function renderHome() {
  const identityPanel = renderIdentityPanel();
  renderLayout(`
    ${identityPanel}
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
  wireIdentityPanel();
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
      <div id="services-state" class="status">Cargando...</div>
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
        setStatusMessage(state, "Todavia no hay servicios disponibles.");
        return;
      }
      list.innerHTML = services
        .map(
          (service) => `
            <article>
              <h3>${escapeHtml(service.name)}</h3>
              <p>${escapeHtml(service.description)}</p>
              <p class="muted small">ID: #${service.id}</p>
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
      setError(state, display.message);
    });
}

function renderBooking() {
  renderLayout(`
    ${renderIdentityPanel()}
    <section class="panel">
      <h2>Reservar</h2>
      <p class="muted">Selecciona servicio y fecha, luego confirma tu reserva.</p>

      <div class="step">
        <h3>Paso A: Servicio y fecha</h3>
        <div id="booking-services-state" class="status">Cargando...</div>
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
        <h3>Paso B: Slots disponibles (UTC)</h3>
        <div id="availability-state" class="status">Selecciona servicio y fecha.</div>
        <div id="slots-list" class="slot-grid"></div>
      </div>

      <div class="step">
        <h3>Confirmar reserva</h3>
        <div id="booking-summary" class="summary">Sin slot seleccionado.</div>
        <button id="booking-btn" type="button" disabled>Confirmar</button>
        <div id="booking-state" class="status"></div>
      </div>
    </section>

    <section class="panel">
      <h2>Mis reservas</h2>
      <p class="muted">Tus reservas recientes en UTC.</p>
      <div id="user-bookings-state" class="status"></div>
      <div id="user-bookings-list" class="grid"></div>
      <button id="user-bookings-refresh" type="button">Actualizar</button>
    </section>
  `);

  const servicesState = document.getElementById("booking-services-state");
  const serviceSelect = document.getElementById("service-select");
  const dateInput = document.getElementById("date-input");
  const availabilityBtn = document.getElementById("availability-btn");
  const availabilityState = document.getElementById("availability-state");
  const slotsList = document.getElementById("slots-list");
  const summary = document.getElementById("booking-summary");
  const bookingBtn = document.getElementById("booking-btn");
  const bookingState = document.getElementById("booking-state");
  const userBookingsState = document.getElementById("user-bookings-state");
  const userBookingsList = document.getElementById("user-bookings-list");
  const userBookingsRefresh = document.getElementById("user-bookings-refresh");

  let services = [];
  let selectedSlot = null;

  function updateSummary() {
    if (!selectedSlot) {
      summary.textContent = "Sin slot seleccionado.";
      bookingBtn.disabled = true;
      return;
    }
    const currentIdentity = getIdentity();
    if (!currentIdentity) {
      summary.textContent = "Necesitas crear tu identidad para reservar.";
      bookingBtn.disabled = true;
      return;
    }
    summary.textContent = `Servicio ${selectedSlot.serviceName} | ${selectedSlot.date} ${selectedSlot.start} UTC | ${currentIdentity.alias}`;
    bookingBtn.disabled = false;
  }

  wireIdentityPanel();

  apiRequest("fetch services", "/services")
    .then((data) => {
      services = data.services || [];
      servicesState.textContent = "";
      if (services.length === 0) {
        setStatusMessage(servicesState, "Todavia no hay servicios disponibles.");
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
      setError(servicesState, display.message);
    });

  availabilityBtn.addEventListener("click", async () => {
    const serviceId = Number(serviceSelect.value);
    const dateValue = dateInput.value;

    if (!serviceId || !dateValue) {
      setError(availabilityState, "Completa servicio y fecha.");
      return;
    }

    selectedSlot = null;
    updateSummary();
    slotsList.innerHTML = "";
    setLoading(availabilityState, "Buscando...");
    setButtonLoading(availabilityBtn, "Buscando...");

    try {
      const data = await apiRequest(
        "fetch availability",
        `/availability?serviceId=${serviceId}&date=${dateValue}`
      );
      const slots = data.slots || [];
      if (slots.length === 0) {
        clearButtonLoading(availabilityBtn);
        setStatusMessage(availabilityState, "No hay horarios para ese dia (UTC).");
        return;
      }

      const now = Date.now();
      const normalizedSlots = slots
        .map((slot) => {
          const startTime = normalizeSlotTime(slot.start_time);
          const endTime = normalizeSlotTime(slot.end_time);
          if (!isValidSlotTime(startTime) || !isValidSlotTime(endTime)) {
            return null;
          }
          const startAt = new Date(`${dateValue}T${startTime}:00.000Z`);
          if (Number.isNaN(startAt.getTime())) {
            return null;
          }
          return { id: slot.id, startTime, endTime, startAt };
        })
        .filter(Boolean);

      const futureSlots = normalizedSlots.filter((slot) => slot.startAt.getTime() >= now);
      if (futureSlots.length === 0) {
        clearButtonLoading(availabilityBtn);
        setStatusMessage(availabilityState, "No hay horarios para ese dia (UTC).");
        return;
      }

      availabilityState.textContent = "Selecciona un slot.";
      clearButtonLoading(availabilityBtn);
      slotsList.innerHTML = futureSlots
        .map(
          (slot) => `
            <button class="slot" type="button" data-start="${slot.startTime}">
              ${slot.startTime} UTC - ${slot.endTime} UTC
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
      clearButtonLoading(availabilityBtn);
      setError(availabilityState, display.message);
    }
  });

  bookingBtn.addEventListener("click", async () => {
    if (!selectedSlot) {
      setError(bookingState, "Selecciona un slot primero.");
      return;
    }
    const currentIdentity = getIdentity();
    if (!currentIdentity) {
      setError(bookingState, "Necesitas crear tu identidad para reservar.");
      return;
    }

    setLoading(bookingState, "Confirmando...");
    setButtonLoading(bookingBtn, "Confirmando...");

    try {
      const startTime = normalizeSlotTime(selectedSlot.start);
      if (!isValidSlotTime(startTime)) {
        clearButtonLoading(bookingBtn, !selectedSlot);
        setError(bookingState, "Horario invalido.");
        return;
      }
      const startAt = `${selectedSlot.date}T${startTime}:00.000Z`;
      const data = await apiRequest("create booking", "/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: currentIdentity.id,
          service_id: selectedSlot.serviceId,
          start_at: startAt,
        }),
      });
      clearButtonLoading(bookingBtn, false);
      setSuccess(bookingState, "Reserva creada.");
      await loadUserBookings();
    } catch (err) {
      const display = formatErrorDisplay(err);
      clearButtonLoading(bookingBtn, !selectedSlot);
      setError(bookingState, display.message);
    }
  });

  function formatUtcTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  function canCancelStatus(status) {
    return status === "pending" || status === "confirmed";
  }

  function renderUserBookings(bookings) {
    if (!userBookingsList) {
      return;
    }
    userBookingsList.innerHTML = bookings
      .map((booking) => {
        const statusLabel = booking.status || "pending";
        const allowCancel = canCancelStatus(statusLabel);
        return `
          <article>
            <h3>#${booking.id}</h3>
            <p>Servicio: ${booking.service_id}</p>
            <p>Fecha: ${formatUtcTimestamp(booking.start_at)}</p>
            <p>Estado: ${statusLabel}</p>
            ${
              allowCancel
                ? `<button class="cancel-user-booking" type="button" data-id="${booking.id}">Cancelar</button>`
                : `<span class="muted">No cancelable</span>`
            }
          </article>
        `;
      })
      .join("");
  }

  async function discoverBookings(identityValue) {
    const attempts = [
      { path: `/bookings?user_id=${identityValue.id}` },
      { path: `/users/${identityValue.id}/bookings` },
    ];

    for (const attempt of attempts) {
      updateStatus("fetch my bookings", `loading ${attempt.path}`);
      let response;
      try {
        response = await fetch(`${API_BASE}${attempt.path}`);
      } catch (err) {
        updateStatus("fetch my bookings", "error network");
        return { type: "network" };
      }

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        updateStatus(
          "fetch my bookings",
          `error ${response.status}`,
          data?.error?.code || ""
        );
        return { type: "http", status: response.status, data };
      }

      updateStatus("fetch my bookings", "ok");
      return { type: "ok", data };
    }

    return { type: "not-supported" };
  }

  function getBookingsMessage(result) {
    if (result.type === "network") {
      return "No se pudo conectar.";
    }
    if (result.type === "not-supported") {
      return "Tu backend todavia no expone 'Mis reservas'.";
    }
    if (result.type === "http") {
      if (result.status >= 500) {
        return "Error interno. Proba de nuevo.";
      }
      const display = formatErrorDisplay(result);
      return display.message;
    }
    return "Error inesperado.";
  }

  async function loadUserBookings() {
    if (!userBookingsState || !userBookingsList || !userBookingsRefresh) {
      return;
    }
    const currentIdentity = getIdentity();
    if (!currentIdentity) {
      userBookingsList.innerHTML = "";
      userBookingsRefresh.disabled = true;
      setStatusMessage(userBookingsState, "Crea tu identidad para ver tus reservas.");
      return;
    }

    userBookingsRefresh.disabled = true;
    setLoading(userBookingsState, "Cargando reservas...");

    const result = await discoverBookings(currentIdentity);
    if (result.type !== "ok") {
      userBookingsList.innerHTML = "";
      setError(userBookingsState, getBookingsMessage(result));
      userBookingsRefresh.disabled = false;
      return;
    }

    const bookings = result.data.bookings || result.data || [];
    if (!Array.isArray(bookings) || bookings.length === 0) {
      userBookingsList.innerHTML = "";
      setStatusMessage(userBookingsState, "No tenes reservas todavia.");
      userBookingsRefresh.disabled = false;
      return;
    }

    userBookingsState.textContent = "";
    renderUserBookings(bookings);
    userBookingsRefresh.disabled = false;

    userBookingsList.querySelectorAll(".cancel-user-booking").forEach((button) => {
      button.addEventListener("click", async () => {
        const bookingId = Number(button.dataset.id);
        if (!bookingId) {
          return;
        }
        const confirmed = window.confirm("Confirmas cancelar esta reserva?");
        if (!confirmed) {
          return;
        }
        setButtonLoading(button, "Cancelando...");
        setLoading(userBookingsState, "Cancelando...");
        const cancelResult = await cancelUserBooking(bookingId);
        if (cancelResult.type === "ok") {
          setSuccess(userBookingsState, "Reserva cancelada.");
          await loadUserBookings();
          return;
        }
        clearButtonLoading(button);
        setError(userBookingsState, getCancelMessage(cancelResult));
      });
    });
  }

  async function cancelUserBooking(bookingId) {
    const attempts = [
      { path: `/bookings/${bookingId}/cancel`, body: null },
      { path: `/bookings/${bookingId}`, body: { status: "cancelled" } },
    ];

    for (const attempt of attempts) {
      updateStatus("cancel booking", `loading ${attempt.path}`);
      let response;
      try {
        response = await fetch(`${API_BASE}${attempt.path}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: attempt.body ? JSON.stringify(attempt.body) : undefined,
        });
      } catch (err) {
        updateStatus("cancel booking", "error network");
        return { type: "network" };
      }

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        updateStatus("cancel booking", `error ${response.status}`, data?.error?.code || "");
        return { type: "http", status: response.status, data };
      }

      updateStatus("cancel booking", "ok");
      return { type: "ok", data };
    }

    return { type: "not-supported" };
  }

  function getCancelMessage(result) {
    if (result.type === "network") {
      return "No se pudo conectar.";
    }
    if (result.type === "not-supported") {
      return "Tu backend todavia no expone cancelar reservas.";
    }
    if (result.type === "http") {
      if (result.status === 409) {
        return "Esa reserva ya fue modificada.";
      }
      if (result.status === 404) {
        return "No se encontro la reserva.";
      }
      if (result.status === 400) {
        return "Solicitud invalida.";
      }
      if (result.status >= 500) {
        return "Error interno. Proba de nuevo.";
      }
      const display = formatErrorDisplay(result);
      return display.message;
    }
    return "Error inesperado.";
  }

  if (userBookingsRefresh) {
    userBookingsRefresh.addEventListener("click", () => {
      loadUserBookings();
    });
  }

  loadUserBookings();
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
      <h2>Crear servicio</h2>
      <form id="admin-service-form">
        <label>
          name
          <input name="name" type="text" required />
        </label>
        <label>
          description
          <input name="description" type="text" required />
        </label>
        <label>
          duration_minutes
          <input name="duration_minutes" type="number" min="1" required />
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
          Servicio
          <select id="admin-service-select" name="service_id" required>
            <option value="">Selecciona un servicio</option>
          </select>
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
  const serviceForm = document.getElementById("admin-service-form");
  const serviceState = document.getElementById("admin-service-state");
  const availabilityForm = document.getElementById("admin-availability-form");
  const availabilityState = document.getElementById("admin-availability-state");
  const availabilitySelect = document.getElementById("admin-service-select");
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

  serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = serviceForm.querySelector("button[type='submit']");
    setLoading(serviceState, "Creando...");
    setButtonLoading(submitButton, "Creando...");

    const formData = new FormData(serviceForm);
    const payload = {
      name: formData.get("name")?.toString().trim(),
      description: formData.get("description")?.toString().trim(),
      duration_minutes: Number(formData.get("duration_minutes")),
      active: formData.get("active") === "on",
    };

    try {
      const data = await adminRequest("admin create service", "/admin/services", payload);
      const createdId = data.service?.id;
      const createdName = data.service?.name || payload.name || "Servicio";
      if (createdId) {
        lastCreatedServiceId = createdId;
        lastCreatedServiceName = createdName;
      }
      clearButtonLoading(submitButton, false);
      if (createdId) {
        setSuccess(serviceState, `Servicio creado: ${createdName} (ID: ${createdId})`);
      } else {
        setSuccess(serviceState, "Servicio creado.");
      }
      serviceForm.reset();
      await loadAdminServices();
    } catch (err) {
      const display = formatErrorDisplay(err);
      clearButtonLoading(submitButton, false);
      setError(serviceState, display.message);
    }
  });

  async function loadAdminServices() {
    if (!availabilitySelect || !availabilityState || !availabilityForm) {
      return;
    }
    availabilitySelect.innerHTML = `<option value="">Selecciona un servicio</option>`;
    availabilitySelect.disabled = true;
    setLoading(availabilityState, "Cargando servicios...");

    try {
      const data = await apiRequest("fetch services", "/services");
      const services = data.services || [];
      if (services.length === 0) {
        setStatusMessage(availabilityState, "Primero crea un servicio.");
        availabilitySelect.disabled = true;
        availabilityForm.querySelector("button[type='submit']").disabled = true;
        return;
      }

      services.forEach((service) => {
        const option = document.createElement("option");
        option.value = String(service.id);
        option.textContent = `#${service.id} — ${service.name} (${service.duration_minutes} min)`;
        availabilitySelect.append(option);
      });

      const preferredId = lastCreatedServiceId ? String(lastCreatedServiceId) : "";
      if (preferredId && services.some((service) => String(service.id) === preferredId)) {
        availabilitySelect.value = preferredId;
      } else {
        availabilitySelect.value = String(services[0].id);
      }

      availabilitySelect.disabled = false;
      availabilityForm.querySelector("button[type='submit']").disabled = false;
      setStatusMessage(
        availabilityState,
        lastCreatedServiceName
          ? `Servicio sugerido: ${lastCreatedServiceName}.`
          : "Selecciona un servicio y horario."
      );
    } catch (err) {
      const display = formatErrorDisplay(err);
      setError(availabilityState, display.message);
      availabilitySelect.disabled = true;
      availabilityForm.querySelector("button[type='submit']").disabled = true;
    }
  }

  availabilityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = availabilityForm.querySelector("button[type='submit']");
    const serviceId = Number(availabilitySelect?.value);
    const formData = new FormData(availabilityForm);
    const dateValue = formData.get("date")?.toString();
    const startTime = formData.get("start_time")?.toString();
    const endTime = formData.get("end_time")?.toString();

    if (!serviceId) {
      setError(availabilityState, "Elegi un servicio.");
      return;
    }
    if (!dateValue || !startTime || !endTime) {
      setError(availabilityState, "Completa fecha y horario.");
      return;
    }

    setLoading(availabilityState, "Guardando...");
    setButtonLoading(submitButton, "Guardando...");
    if (availabilitySelect) {
      availabilitySelect.disabled = true;
    }

    const payload = {
      service_id: serviceId,
      date: dateValue,
      start_time: startTime,
      end_time: endTime,
      active: formData.get("active") === "on",
    };

    try {
      const data = await adminRequest("admin create availability", "/admin/availability", payload);
      clearButtonLoading(submitButton, false);
      setSuccess(availabilityState, "Slot creado.");
      availabilityForm.reset();
      if (availabilitySelect) {
        availabilitySelect.disabled = false;
        if (lastCreatedServiceId) {
          availabilitySelect.value = String(lastCreatedServiceId);
        }
      }
    } catch (err) {
      const display = formatErrorDisplay(err);
      clearButtonLoading(submitButton, false);
      setError(availabilityState, display.message);
      if (availabilitySelect) {
        availabilitySelect.disabled = false;
      }
    }
  });

  bookingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLoading(bookingsState, "Buscando...");
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
        setStatusMessage(bookingsState, "No hay reservas para ese dia.");
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
            setError(bookingsState, display.message);
          }
        });
      });
    } catch (err) {
      const display = formatErrorDisplay(err);
      setError(bookingsState, display.message);
    }
  });

  loadAdminServices();
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
    return { message: "No se pudo conectar con el sistema.", detail: "" };
  }

  if (err && err.type === "missing-token") {
    return { message: "Token requerido.", detail: "" };
  }

  if (err && err.type === "http") {
    const details = err.data?.error?.details || {};
    let message = "Solicitud fallida.";
    if (err.status === 401) {
      message = "Token invalido.";
    } else if (err.status === 403) {
      message = "Token invalido.";
    } else if (err.status === 409) {
      message = "Ese horario ya fue tomado.";
    } else if (err.status >= 400 && err.status < 500) {
      if (Object.prototype.hasOwnProperty.call(details, "start_at")) {
        message = "Horario en el pasado. Elegi otro dia.";
      } else {
        message = "Datos invalidos. Revisa e intenta de nuevo.";
      }
    } else if (err.status >= 500) {
      message = "Error interno. Intenta de nuevo.";
    }

    return { message, detail: "" };
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

function setLoading(element, message) {
  setStatusMessage(element, message || "Cargando...");
}

function setError(element, message) {
  setStatusMessage(element, message, "", "error");
}

function setSuccess(element, message) {
  setStatusMessage(element, message, "", "ok");
}

function setButtonLoading(button, label) {
  if (!button) {
    return;
  }
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }
  button.textContent = label;
  button.disabled = true;
}

function clearButtonLoading(button, keepDisabled = false) {
  if (!button) {
    return;
  }
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
  button.disabled = keepDisabled;
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
  return `••••${suffix}`;
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
