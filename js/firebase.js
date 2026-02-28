// ===================================
// DOMÓTICA SANTANÍ — FIREBASE CONFIG
// ===================================
// Firestore: guarda mensajes del formulario
// Analytics: rastrea visitas y eventos

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, logEvent }from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Configuración ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyD0YuPRVEVZmi-nAOiXT3etSjtQ52Oki60",
  authDomain:        "domotica-santani.firebaseapp.com",
  projectId:         "domotica-santani",
  storageBucket:     "domotica-santani.firebasestorage.app",
  messagingSenderId: "892438528666",
  appId:             "1:892438528666:web:047e75b52f18f1f56dd523",
  measurementId:     "G-9715K1ZB3X"
};

// ── Inicialización ─────────────────────────────────────────
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// ── Analytics: evento de página vista ─────────────────────
logEvent(analytics, "page_view", {
  page_title:    document.title,
  page_location: window.location.href,
});

// ── Analytics: rastrear clicks en WhatsApp ─────────────────
document.querySelectorAll('a[href*="wa.me"]').forEach(btn => {
  btn.addEventListener("click", () => {
    logEvent(analytics, "whatsapp_click", {
      source: btn.classList.contains("whatsapp-float") ? "float" : "button"
    });
  });
});

// ── Analytics: rastrear clicks en servicios ────────────────
document.querySelectorAll(".servicio-card").forEach(card => {
  card.addEventListener("click", () => {
    const titulo = card.querySelector("h3")?.textContent || "unknown";
    logEvent(analytics, "servicio_click", { servicio: titulo });
  });
});

// ── Guardar mensajes del formulario en Firestore ───────────
const form = document.getElementById("contactForm");

if (form) {
  // Sobreescribimos el submit para enviarlo a Firestore
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ── Validación (igual que en main.js) ──────────────────
    const nombre   = document.getElementById("nombre");
    const email    = document.getElementById("email");
    const telefono = document.getElementById("telefono");
    const mensaje  = document.getElementById("mensaje");

    const errNombre  = document.getElementById("errorNombre");
    const errEmail   = document.getElementById("errorEmail");
    const errMensaje = document.getElementById("errorMensaje");

    [nombre, email, mensaje].forEach(f => f.classList.remove("error"));
    [errNombre, errEmail, errMensaje].forEach(el => el.textContent = "");

    let valid = true;

    if (!nombre.value.trim() || nombre.value.trim().length < 2) {
      nombre.classList.add("error");
      errNombre.textContent = "Por favor ingresá tu nombre completo.";
      valid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value.trim() || !emailRegex.test(email.value)) {
      email.classList.add("error");
      errEmail.textContent = "Ingresá un email válido.";
      valid = false;
    }

    if (!mensaje.value.trim() || mensaje.value.trim().length < 10) {
      mensaje.classList.add("error");
      errMensaje.textContent = "El mensaje debe tener al menos 10 caracteres.";
      valid = false;
    }

    if (!valid) return;

    // ── Envío a Firestore ──────────────────────────────────
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.textContent = "Enviando...";
    submitBtn.disabled    = true;

    try {
      await addDoc(collection(db, "mensajes"), {
        nombre:    nombre.value.trim(),
        email:     email.value.trim(),
        telefono:  telefono.value.trim() || null,
        mensaje:   mensaje.value.trim(),
        timestamp: serverTimestamp(),
        leido:     false          // útil para panel admin futuro
      });

      // Analytics: evento formulario enviado
      logEvent(analytics, "form_submit", {
        form_name: "contacto"
      });

      // UI: éxito
      form.reset();
      const successEl = document.getElementById("formSuccess");
      successEl.style.display = "block";
      setTimeout(() => (successEl.style.display = "none"), 5000);

    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
      alert("Hubo un problema al enviar el mensaje. Por favor intentá de nuevo o escribinos por WhatsApp.");
    } finally {
      submitBtn.textContent = "Enviar mensaje";
      submitBtn.disabled    = false;
    }
  });

  // Quitar error al escribir
  form.querySelectorAll("input, textarea").forEach(field => {
    field.addEventListener("input", () => field.classList.remove("error"));
  });
}
