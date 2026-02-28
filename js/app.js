// =============================================
// DOMÓTICA SANTANÍ — APP.JS v2
// 3 servicios · GPS + OpenStreetMap · Firebase
// =============================================

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore, collection, getDocs,
  addDoc, serverTimestamp, doc, setDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyD0YuPRVEVZmi-nAOiXT3etSjtQ52Oki60",
  authDomain:        "domotica-santani.firebaseapp.com",
  projectId:         "domotica-santani",
  storageBucket:     "domotica-santani.firebasestorage.app",
  messagingSenderId: "892438528666",
  appId:             "1:892438528666:web:047e75b52f18f1f56dd523",
  measurementId:     "G-9715K1ZB3X"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// ── Horarios 16hs–19hs cada 30 min ────────────────────────
const HORARIOS = ["16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

// ── Servicios por defecto (solo 3) ────────────────────────
const DEFAULTS = [
  {
    id: "iluminacion", icon: "💡",
    nombre: "Control de Iluminación",
    desc: "Encendé, apagá y programá las luces de toda tu casa desde el celular o por voz. Ahorrá energía y creá ambientes perfectos.",
    precio: 250000, unidad: "ambiente", orden: 1
  },
  {
    id: "climatizacion", icon: "❄️",
    nombre: "Climatización Inteligente",
    desc: "Control automático del aire acondicionado según temperatura y horarios. Mayor confort con menor consumo de energía.",
    precio: 350000, unidad: "equipo", orden: 2
  },
  {
    id: "seguridad", icon: "🔐",
    nombre: "Seguridad y Monitoreo",
    desc: "Cámaras de vigilancia y monitoreo en tiempo real desde tu celular. Protegé tu hogar y familia las 24 horas.",
    precio: 450000, unidad: "cámara", orden: 3
  }
];

// ── Estado ────────────────────────────────────────────────
let servicios        = [];
let selectedServicio = null;
let qty              = 1;
let selectedHorario  = null;
let gpsCoords        = null; // { lat, lon, display }

// ── Formato guaraní ───────────────────────────────────────
const fmtGs = n => "₲ " + Number(n).toLocaleString("es-PY");
const formatFecha = iso => { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };

// ─────────────────────────────────────────────────────────
// 1. CARGAR SERVICIOS
// ─────────────────────────────────────────────────────────
async function cargarServicios() {
  try {
    const snap = await getDocs(collection(db, "servicios"));
    if (!snap.empty) {
      servicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      servicios.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    } else {
      servicios = DEFAULTS;
    }
  } catch (e) {
    console.warn("Usando servicios por defecto:", e);
    servicios = DEFAULTS;
  }
  renderServicios();
}

function renderServicios() {
  const grid = document.getElementById("serviciosGrid");
  grid.innerHTML = servicios.map(s => `
    <div class="servicio-card reveal" onclick="abrirModal('${s.id}')">
      <div class="servicio-card__icon">${s.icon}</div>
      <h3>${s.nombre}</h3>
      <p>${s.desc}</p>
      <div class="servicio-card__precio">${fmtGs(s.precio)} <span>/ ${s.unidad}</span></div>
      <div class="servicio-card__cta">Cotizar y agendar →</div>
      <div class="servicio-card__line"></div>
    </div>
  `).join("");

  // Re-observar cards nuevas
  document.querySelectorAll(".servicio-card.reveal").forEach(el => revealObs.observe(el));
}

// ─────────────────────────────────────────────────────────
// 2. MODAL
// ─────────────────────────────────────────────────────────
window.abrirModal = function(id) {
  const s = servicios.find(x => x.id === id);
  if (!s) return;
  selectedServicio = s;
  qty = 1;
  selectedHorario = null;
  gpsCoords = null;

  // Reset campo dirección
  document.getElementById("agDir").value = "";
  document.getElementById("ubicacionResult").className = "ubicacion-result";
  document.getElementById("ubicacionError").className  = "ubicacion-error";
  const map = document.getElementById("mapPreview");
  map.className = "";
  map.src = "";
  document.getElementById("btnUbicacion").textContent = "📍 Usar mi ubicación actual";
  document.getElementById("btnUbicacion").classList.remove("loading");

  document.getElementById("modalIcon").textContent      = s.icon;
  document.getElementById("modalTitle").textContent     = s.nombre;
  document.getElementById("modalPriceUnit").textContent = `${fmtGs(s.precio)} por ${s.unidad}`;
  document.getElementById("modalDesc").textContent      = s.desc;
  document.getElementById("qtyVal").textContent         = qty;
  actualizarTotal();

  mostrarStep(1);
  document.getElementById("modalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";

  logEvent(analytics, "servicio_click", { servicio: s.nombre });
};

function cerrarModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.body.style.overflow = "";
  selectedServicio = null;
  qty = 1;
  selectedHorario = null;
  gpsCoords = null;
}

function mostrarStep(n) {
  [1,2,3].forEach(i =>
    document.getElementById(`step${i}`).classList.toggle("hidden", i !== n)
  );
}

function actualizarTotal() {
  if (!selectedServicio) return;
  document.getElementById("qtyVal").textContent    = qty;
  document.getElementById("modalTotal").textContent = fmtGs(selectedServicio.precio * qty);
}

document.getElementById("qtyMinus").addEventListener("click", () => { if(qty>1){qty--;actualizarTotal();} });
document.getElementById("qtyPlus").addEventListener("click",  () => { if(qty<20){qty++;actualizarTotal();} });

["modalClose","modalClose2"].forEach(id =>
  document.getElementById(id).addEventListener("click", cerrarModal)
);
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal();
});
document.getElementById("btnCerrarFinal").addEventListener("click", cerrarModal);

// Paso 1 → 2
document.getElementById("btnContinuar").addEventListener("click", () => {
  const total = selectedServicio.precio * qty;
  document.getElementById("resumenMini").innerHTML = `
    <span class="resumen-icon">${selectedServicio.icon}</span>
    <div>
      <strong>${selectedServicio.nombre}</strong>
      <span>${qty} ${selectedServicio.unidad}${qty>1?"s":""} · ${fmtGs(total)}</span>
    </div>`;
  renderHorarios();
  // Fecha mínima = mañana
  const d = new Date(); d.setDate(d.getDate()+1);
  document.getElementById("agFecha").min = d.toISOString().split("T")[0];
  mostrarStep(2);
});

// Volver paso 1
document.getElementById("btnVolver").addEventListener("click", () => mostrarStep(1));

function renderHorarios() {
  document.getElementById("horariosGrid").innerHTML = HORARIOS.map(h =>
    `<button class="horario-btn" data-hora="${h}" onclick="selHorario('${h}')">${h}</button>`
  ).join("");
  selectedHorario = null;
}

window.selHorario = function(h) {
  selectedHorario = h;
  document.querySelectorAll(".horario-btn").forEach(b =>
    b.classList.toggle("selected", b.dataset.hora === h)
  );
  document.getElementById("errHorario").textContent = "";
};

// ─────────────────────────────────────────────────────────
// 3. GPS + OPENSTREETMAP (Nominatim geocoding inverso)
// ─────────────────────────────────────────────────────────
document.getElementById("btnUbicacion").addEventListener("click", async () => {
  const btn = document.getElementById("btnUbicacion");
  const resultEl = document.getElementById("ubicacionResult");
  const errorEl  = document.getElementById("ubicacionError");
  const mapEl    = document.getElementById("mapPreview");

  if (!navigator.geolocation) {
    errorEl.textContent = "Tu navegador no soporta geolocalización.";
    errorEl.className = "ubicacion-error visible";
    return;
  }

  btn.textContent = "⏳ Obteniendo ubicación...";
  btn.classList.add("loading");
  resultEl.className = "ubicacion-result";
  errorEl.className  = "ubicacion-error";
  mapEl.className    = "";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;

      try {
        // Geocoding inverso con Nominatim (gratis, no necesita API key)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
          { headers: { "Accept-Language": "es" } }
        );
        const data = await res.json();

        const addr = data.address || {};
        const partes = [
          addr.road || addr.pedestrian || addr.suburb,
          addr.house_number,
          addr.neighbourhood || addr.quarter,
          addr.city || addr.town || addr.village || addr.municipality,
          addr.state
        ].filter(Boolean);

        const display = partes.join(", ") || data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        gpsCoords = { lat, lon, display };

        // Mostrar resultado
        resultEl.innerHTML = `✅ <strong>${display}</strong><br><small style="opacity:.7">Lat: ${lat.toFixed(5)} · Lon: ${lon.toFixed(5)}</small>`;
        resultEl.className = "ubicacion-result visible";
        errorEl.className  = "ubicacion-error";

        // Mapa estático con OpenStreetMap tiles via staticmap
        const zoom = 16;
        const size = "600x200";
        mapEl.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${size}&markers=${lat},${lon},red`;
        mapEl.className = "visible";
        mapEl.onerror = () => { mapEl.className = ""; };

        // Pre-llenar campo dirección
        document.getElementById("agDir").value = display;
        document.getElementById("errDir").textContent = "";

      } catch (err) {
        // Si falla el geocoding, usamos solo coordenadas
        gpsCoords = { lat, lon, display: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
        resultEl.innerHTML = `📍 Coordenadas: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        resultEl.className = "ubicacion-result visible";
        document.getElementById("agDir").value = gpsCoords.display;
      }

      btn.textContent = "📍 Ubicación obtenida ✓";
    },
    (err) => {
      const msgs = {
        1: "Permiso denegado. Activá la ubicación en tu navegador.",
        2: "No se pudo determinar la ubicación.",
        3: "Tiempo de espera agotado. Intentá de nuevo."
      };
      errorEl.textContent = msgs[err.code] || "Error al obtener ubicación.";
      errorEl.className = "ubicacion-error visible";
      btn.textContent = "📍 Usar mi ubicación actual";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  btn.classList.remove("loading");
});

// ─────────────────────────────────────────────────────────
// 4. GUARDAR AGENDAMIENTO EN FIRESTORE
// ─────────────────────────────────────────────────────────
document.getElementById("btnAgendar").addEventListener("click", async () => {
  // Limpiar errores
  ["errNombre","errTel","errDir","errFecha","errHorario"].forEach(id =>
    document.getElementById(id).textContent = ""
  );
  ["agNombre","agTel","agDir","agFecha"].forEach(id =>
    document.getElementById(id).classList.remove("error")
  );

  const nombre = document.getElementById("agNombre").value.trim();
  const tel    = document.getElementById("agTel").value.trim();
  const dir    = document.getElementById("agDir").value.trim();
  const fecha  = document.getElementById("agFecha").value;
  let valid    = true;

  if (!nombre || nombre.length < 2) {
    document.getElementById("agNombre").classList.add("error");
    document.getElementById("errNombre").textContent = "Ingresá tu nombre.";
    valid = false;
  }
  if (!tel || tel.replace(/\D/g,"").length < 7) {
    document.getElementById("agTel").classList.add("error");
    document.getElementById("errTel").textContent = "Ingresá tu WhatsApp.";
    valid = false;
  }
  if (!dir) {
    document.getElementById("agDir").classList.add("error");
    document.getElementById("errDir").textContent = "Ingresá o usá tu ubicación.";
    valid = false;
  }
  if (!fecha) {
    document.getElementById("agFecha").classList.add("error");
    document.getElementById("errFecha").textContent = "Elegí una fecha.";
    valid = false;
  }
  if (!selectedHorario) {
    document.getElementById("errHorario").textContent = "Elegí un horario.";
    valid = false;
  }
  if (!valid) return;

  const btn = document.getElementById("btnAgendar");
  btn.textContent = "Guardando...";
  btn.disabled    = true;

  const total = selectedServicio.precio * qty;

  try {
    await addDoc(collection(db, "agendamientos"), {
      nombre,
      telefono:   tel,
      direccion:  dir,
      lat:        gpsCoords?.lat || null,
      lon:        gpsCoords?.lon || null,
      fecha,
      horario:    selectedHorario,
      servicio:   selectedServicio.nombre,
      servicioId: selectedServicio.id,
      icon:       selectedServicio.icon,
      unidad:     selectedServicio.unidad,
      cantidad:   qty,
      precioUnit: selectedServicio.precio,
      total,
      estado:     "pendiente",
      timestamp:  serverTimestamp()
    });

    logEvent(analytics, "agendamiento_creado", { servicio: selectedServicio.nombre, total });

    document.getElementById("successMsg").textContent =
      `${nombre}, tu instalación de "${selectedServicio.nombre}" (${qty} ${selectedServicio.unidad}${qty>1?"s":""}) quedó agendada para el ${formatFecha(fecha)} a las ${selectedHorario} hs.`;

    mostrarStep(3);
  } catch (err) {
    console.error(err);
    alert("Error al guardar. Intentá de nuevo o escribinos por WhatsApp.");
  } finally {
    btn.textContent = "Confirmar ✓";
    btn.disabled    = false;
  }
});

// ─────────────────────────────────────────────────────────
// 5. REVEAL OBSERVER
// ─────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));

// ── Arrancar ──────────────────────────────────────────────
cargarServicios();
