import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const app = document.getElementById("app");

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
          <a href="#/booking">Booking</a>
        </nav>
      </header>
      <main>${content}</main>
      <footer>
        <span>API Base: ${API_BASE}</span>
      </footer>
    </div>
  `;
  setActiveLink();
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
      <p>Usa los links para explorar servicios o crear una reserva.</p>
    </section>
  `);

  const button = document.getElementById("health-check");
  const output = document.getElementById("health-output");
  button.addEventListener("click", async () => {
    output.textContent = "Cargando...";
    try {
      const data = await apiGet("/health");
      output.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      output.textContent = formatError(err);
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

  apiGet("/services")
    .then((data) => {
      state.textContent = "";
      const services = data.services || [];
      if (services.length === 0) {
        state.textContent = "Sin servicios disponibles.";
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
      state.textContent = formatError(err);
    });
}

function renderBooking() {
  renderLayout(`
    <section class="panel">
      <h2>Crear reserva</h2>
      <p class="muted">Completa el payload minimo para /bookings.</p>
      <form id="booking-form">
        <label>
          user_id
          <input name="user_id" type="number" min="1" required />
        </label>
        <label>
          service_id
          <input name="service_id" type="number" min="1" required />
        </label>
        <label>
          start_at (UTC)
          <input name="start_at" type="datetime-local" required />
        </label>
        <button type="submit">Crear booking</button>
      </form>
      <div id="booking-state" class="status"></div>
    </section>
  `);

  const form = document.getElementById("booking-form");
  const state = document.getElementById("booking-state");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.textContent = "Enviando...";

    const formData = new FormData(form);
    const userId = Number(formData.get("user_id"));
    const serviceId = Number(formData.get("service_id"));
    const startAtRaw = formData.get("start_at");
    const startAt = startAtRaw
      ? new Date(`${startAtRaw.toString()}:00.000Z`).toISOString()
      : null;

    try {
      const data = await apiPost("/bookings", {
        user_id: userId,
        service_id: serviceId,
        start_at: startAt,
      });
      state.textContent = `Reserva creada. ID: ${data.booking?.id ?? "(sin id)"}`;
    } catch (err) {
      state.textContent = formatError(err);
    }
  });
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  return handleResponse(response);
}

async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

async function handleResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw data || { error: { message: "Request failed" } };
  }
  return data;
}

function formatError(err) {
  if (err && err.error) {
    const details = err.error.details ? ` | ${JSON.stringify(err.error.details)}` : "";
    return `Error ${err.error.code}: ${err.error.message}${details}`;
  }
  return "Error inesperado";
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
