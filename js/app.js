// =============================================
// DOMÓTICA SANTANÍ — APP.JS
// Servicios desde Firestore + Modal + Agendamiento
// =============================================

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore, collection, getDocs,
  addDoc, serverTimestamp, doc, getDoc
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

// ── Horarios disponibles (16hs a 19hs) ─────────────────────
const HORARIOS = ["16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

// ── Estado del modal ────────────────────────────────────────
let selectedServicio = null;
let qty              = 1;
let selectedHorario  = null;

// ── Formato guaraní ─────────────────────────────────────────
const fmtGs = n => "₲ " + Number(n).toLocaleString("es-PY");

// ─────────────────────────────────────────────────────────────
// 1. CARGAR SERVICIOS DESDE FIRESTORE
// ─────────────────────────────────────────────────────────────
async function cargarServicios() {
  const grid = document.getElementById("serviciosGrid");

  // Servicios por defecto si Firestore no tiene datos aún
  const defaults = [
    { id:"iluminacion", icon:"💡", nombre:"Control de Iluminación",    desc:"Enciende, apaga y programá las luces desde el celular. Ahorrá energía y creá ambientes perfectos.",   precio:250000, unidad:"ambiente" },
    { id:"clima",       icon:"❄️", nombre:"Climatización Inteligente", desc:"Control automático del aire acondicionado. Mayor confort con menor consumo energético.",                precio:350000, unidad:"equipo"   },
    { id:"remoto",      icon:"📱", nombre:"Manejo Remoto",             desc:"Controlá todos los dispositivos desde cualquier lugar del mundo con tu smartphone.",                     precio:150000, unidad:"unidad"   },
    { id:"seguridad",   icon:"🔐", nombre:"Seguridad y Monitoreo",     desc:"Cámaras de vigilancia y monitoreo en tiempo real para proteger lo que más querés.",                      precio:450000, unidad:"cámara"   },
    { id:"voz",         icon:"🗣️", nombre:"Asistentes de Voz",        desc:"Compatible con Alexa y Google Home. Controlá tu hogar con simples comandos de voz.",                     precio:200000, unidad:"unidad"   },
  ];

  try {
    const snap = await getDocs(collection(db, "servicios"));
    let servicios = [];

    if (!snap.empty) {
      snap.forEach(d => servicios.push({ id: d.id, ...d.data() }));
      // Ordenar por orden si existe
      servicios.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    } else {
      servicios = defaults;
    }

    renderServicios(servicios);
  } catch (e) {
    console.warn("Firestore error, usando defaults:", e);
    renderServicios(defaults);
  }
}

function renderServicios(lista) {
  const grid = document.getElementById("serviciosGrid");
  grid.innerHTML = lista.map(s => `
    <div class="servicio-card reveal" data-id="${s.id}" onclick="abrirModal('${s.id}')">
      <div class="servicio-card__icon">${s.icon}</div>
      <h3>${s.nombre}</h3>
      <p>${s.desc}</p>
      <div class="servicio-card__precio">${fmtGs(s.precio)} <span>/ ${s.unidad}</span></div>
      <button class="btn btn--primary btn--sm servicio-btn">Cotizar y agendar</button>
      <div class="servicio-card__line"></div>
    </div>
  `).join("");

  // Re-observar las nuevas cards para animación reveal
  document.querySelectorAll(".servicio-card.reveal").forEach(el => revealObserver.observe(el));

  // Guardar referencia global
  window.__servicios = lista;
}

// ─────────────────────────────────────────────────────────────
// 2. MODAL
// ─────────────────────────────────────────────────────────────
window.abrirModal = function(id) {
  const s = (window.__servicios || []).find(x => x.id === id);
  if (!s) return;

  selectedServicio = s;
  qty = 1;
  selectedHorario = null;

  document.getElementById("modalIcon").textContent   = s.icon;
  document.getElementById("modalTitle").textContent  = s.nombre;
  document.getElementById("modalPriceUnit").textContent = `${fmtGs(s.precio)} por ${s.unidad}`;
  document.getElementById("modalDesc").textContent   = s.desc;
  document.getElementById("qtyVal").textContent      = qty;
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
}

function mostrarStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`step${i}`).classList.toggle("hidden", i !== n);
  });
}

function actualizarTotal() {
  if (!selectedServicio) return;
  const total = selectedServicio.precio * qty;
  document.getElementById("qtyVal").textContent = qty;
  document.getElementById("modalTotal").textContent = fmtGs(total);
}

// Qty controls
document.getElementById("qtyMinus").addEventListener("click", () => {
  if (qty > 1) { qty--; actualizarTotal(); }
});
document.getElementById("qtyPlus").addEventListener("click", () => {
  if (qty < 20) { qty++; actualizarTotal(); }
});

// Cerrar modal
["modalClose","modalClose2"].forEach(id => {
  document.getElementById(id).addEventListener("click", cerrarModal);
});
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal();
});

// Continuar al paso 2
document.getElementById("btnContinuar").addEventListener("click", () => {
  // Resumen
  const total = selectedServicio.precio * qty;
  document.getElementById("resumenMini").innerHTML = `
    <span class="resumen-icon">${selectedServicio.icon}</span>
    <div>
      <strong>${selectedServicio.nombre}</strong>
      <span>${qty} ${selectedServicio.unidad}${qty>1?"s":""} · ${fmtGs(total)}</span>
    </div>
  `;
  // Generar horarios
  renderHorarios();
  // Fecha mínima = mañana
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  document.getElementById("agFecha").min = manana.toISOString().split("T")[0];

  mostrarStep(2);
});

// Volver al paso 1
document.getElementById("btnVolver").addEventListener("click", () => mostrarStep(1));

function renderHorarios() {
  const grid = document.getElementById("horariosGrid");
  grid.innerHTML = HORARIOS.map(h => `
    <button class="horario-btn" data-hora="${h}" onclick="seleccionarHorario('${h}')">${h}</button>
  `).join("");
  selectedHorario = null;
}

window.seleccionarHorario = function(hora) {
  selectedHorario = hora;
  document.querySelectorAll(".horario-btn").forEach(b => {
    b.classList.toggle("selected", b.dataset.hora === hora);
  });
  document.getElementById("errHorario").textContent = "";
};

// ─────────────────────────────────────────────────────────────
// 3. CONFIRMAR AGENDAMIENTO → GUARDAR EN FIRESTORE
// ─────────────────────────────────────────────────────────────
document.getElementById("btnAgendar").addEventListener("click", async () => {
  // Limpiar errores
  ["errNombre","errTel","errDir","errFecha","errHorario"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
  ["agNombre","agTel","agDir","agFecha"].forEach(id => {
    document.getElementById(id).classList.remove("error");
  });

  const nombre  = document.getElementById("agNombre").value.trim();
  const tel     = document.getElementById("agTel").value.trim();
  const dir     = document.getElementById("agDir").value.trim();
  const fecha   = document.getElementById("agFecha").value;
  let valid = true;

  if (!nombre || nombre.length < 2) {
    document.getElementById("agNombre").classList.add("error");
    document.getElementById("errNombre").textContent = "Ingresá tu nombre.";
    valid = false;
  }
  if (!tel || tel.length < 7) {
    document.getElementById("agTel").classList.add("error");
    document.getElementById("errTel").textContent = "Ingresá tu número de WhatsApp.";
    valid = false;
  }
  if (!dir) {
    document.getElementById("agDir").classList.add("error");
    document.getElementById("errDir").textContent = "Ingresá tu dirección.";
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
  btn.disabled = true;

  const total = selectedServicio.precio * qty;

  try {
    await addDoc(collection(db, "agendamientos"), {
      nombre,
      telefono:   tel,
      direccion:  dir,
      fecha,
      horario:    selectedHorario,
      servicio:   selectedServicio.nombre,
      servicioId: selectedServicio.id,
      icon:       selectedServicio.icon,
      cantidad:   qty,
      precioUnit: selectedServicio.precio,
      total,
      estado:     "pendiente",   // pendiente | confirmado | cancelado
      timestamp:  serverTimestamp(),
    });

    logEvent(analytics, "agendamiento_creado", {
      servicio: selectedServicio.nombre,
      total
    });

    // Paso 3 éxito
    document.getElementById("successMsg").textContent =
      `${nombre}, tu instalación de "${selectedServicio.nombre}" está agendada para el ${formatFecha(fecha)} a las ${selectedHorario} hs.`;
    mostrarStep(3);

  } catch (err) {
    console.error(err);
    alert("Error al guardar. Intentá de nuevo o escribinos por WhatsApp.");
  } finally {
    btn.textContent = "Confirmar ✓";
    btn.disabled = false;
  }
});

document.getElementById("btnCerrarFinal").addEventListener("click", cerrarModal);

// ─────────────────────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────────────────────
function formatFecha(iso) {
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Reveal observer (exportado para que renderServicios lo use) ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

window.__revealObserver = revealObserver;

// ── Arrancar ────────────────────────────────────────────────
cargarServicios();
