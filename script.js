// ================== CONFIGURACIÓN ==================
const ANIO = 2026;          // Año del calendario
const MES = 12;             // Diciembre
const TOTAL_DIAS = 24;      // Cambia a 25 si quieres incluir Navidad
const ARCHIVO_CONTENIDO = "contenido.json";

// Para pruebas: index.html?fecha=2026-12-10 simula esa fecha
// Para editar contenido: index.html?admin=1
// =====================================================

const params = new URLSearchParams(location.search);
const ES_ADMIN = params.get("admin") === "1";

const KEY_ABIERTOS = "adviento_abiertos_" + ANIO;
const KEY_BORRADOR = "adviento_borrador_" + ANIO;

let contenido = {};   // { "1": {titulo, texto, imagen, enlace, enlaceTexto}, ... }
let diaActual = null; // día abierto en el modal

const $ = (id) => document.getElementById(id);

// ---------- Fecha del dispositivo ----------
function fechaHoy() {
  const f = params.get("fecha");
  if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const [y, m, d] = f.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(); // fecha del dispositivo
}

function estaDesbloqueado(dia) {
  const hoy = fechaHoy();
  const fechaDia = new Date(ANIO, MES - 1, dia);
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return hoySinHora >= fechaDia;
}

function esHoy(dia) {
  const h = fechaHoy();
  return h.getFullYear() === ANIO && h.getMonth() === MES - 1 && h.getDate() === dia;
}

// ---------- Almacenamiento local ----------
function leerLS(key, defecto) {
    try { return JSON.parse(localStorage.getItem(key)) ?? defecto; }
  catch { return defecto; }
}
function guardarLS(key, valor) {
  try { localStorage.setItem(key, JSON.stringify(valor)); } catch {}
}

// ---------- Carga de contenido ----------
async function cargarContenido() {
  let base = {};
  try {
    const r = await fetch(ARCHIVO_CONTENIDO, { cache: "no-store" });
    if (r.ok) base = await r.json();
  } catch { /* sin archivo: se usa vacío */ }

  // En modo admin, el borrador local tiene prioridad
  contenido = ES_ADMIN ? { ...base, ...leerLS(KEY_BORRADOR, {}) } : base;
}

// ---------- Cuenta regresiva a Navidad ----------
function actualizarCuenta() {
  const hoy = fechaHoy();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const navidad = new Date(ANIO, 11, 25);
  const dias = Math.round((navidad - hoySinHora) / 86400000);
  const el = $("cuenta-regresiva");

  if (dias > 1) el.innerHTML = `🎅 Faltan <strong>${dias}</strong> días para Navidad`;
  else if (dias === 1) el.innerHTML = `🎅 Falta <strong>1</strong> día para Navidad`;
  else if (dias === 0) el.innerHTML = `🎄 ¡Hoy es Navidad! ¡Feliz Navidad!`;
  else el.innerHTML = `🎁 La Navidad de ${ANIO} ya pasó`;
}

// ---------- Dibujar calendario ----------
function dibujar() {
  const cont = $("calendario");
  cont.innerHTML = "";
  const abiertos = leerLS(KEY_ABIERTOS, []);

  for (let d = 1; d <= TOTAL_DIAS; d++) {
    const libre = estaDesbloqueado(d);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dia";
    if (!libre) btn.classList.add("bloqueado");
    if (libre && esHoy(d)) btn.classList.add("hoy");
    if (libre && abiertos.includes(d)) btn.classList.add("abierto");

    const num = document.createElement("span");
    num.textContent = d;
    btn.appendChild(num);

    if (!libre) {
      const c = document.createElement("span");
      c.className = "candado";
      c.textContent = "🔒";
      btn.appendChild(c);
    } else if (!contenido[d]) {
      const s = document.createElement("span");
      s.className = "sin-contenido";
      s.textContent = "(vacío)";
      btn.appendChild(s);
    }

    btn.setAttribute("aria-label", libre ? `Día ${d}` : `Día ${d}, bloqueado`);
    btn.addEventListener("click", () => clicDia(d, btn, libre));
    cont.appendChild(btn);
  }

  const hoy = fechaHoy();
  $("estado-fecha").textContent =
    "Esposita, hoy es " + hoy.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  actualizarCuenta();
}

// ---------- Interacción ----------
function clicDia(d, btn, libre) {
  if (!libre && !ES_ADMIN) {
    btn.classList.remove("sacudir");
    void btn.offsetWidth; // reinicia animación
    btn.classList.add("sacudir");
    return;
  }
  abrirModal(d, libre);
}

function abrirModal(d, libre) {
  diaActual = d;
  mostrarVista(d, libre);
  $("modal").showModal();

  if (libre) {
    const abiertos = leerLS(KEY_ABIERTOS, []);
    if (!abiertos.includes(d)) { abiertos.push(d); guardarLS(KEY_ABIERTOS, abiertos); }
    dibujar();
  }
}

function mostrarVista(d, libre) {
  $("modal-form").hidden = true;
  $("modal-vista").hidden = false;

  const c = contenido[d];
  $("modal-dia").textContent = `Día ${d} de diciembre` + (libre ? "" : " (bloqueado — solo lo ves tú como admin)");
  $("modal-titulo").textContent = c?.titulo || (libre ? "¡Sorpresa!" : "Sin título");
  $("modal-texto").textContent = c?.texto || "Todavía no hay contenido para este día.";

  const img = $("modal-imagen");
  if (c?.imagen) { img.src = c.imagen; img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); }

  const a = $("modal-enlace");
  if (c?.enlace && /^https?:\/\//i.test(c.enlace)) {
    a.href = c.enlace;
    a.textContent = c.enlaceTexto || "Ver más";
    a.hidden = false;
  } else { a.hidden = true; }

  $("btn-editar").hidden = !ES_ADMIN;
}

// ---------- Edición (admin) ----------
function abrirFormulario() {
  const c = contenido[diaActual] || {};
  $("form-titulo-dia").textContent = `Editar día ${diaActual}`;
  $("f-titulo").value = c.titulo || "";
  $("f-texto").value = c.texto || "";
  $("f-imagen").value = c.imagen || "";
  $("f-enlace").value = c.enlace || "";
  $("f-enlace-texto").value = c.enlaceTexto || "";
  $("modal-vista").hidden = true;
  $("modal-form").hidden = false;
}

function guardarFormulario(e) {
  e.preventDefault();
  contenido[diaActual] = {
    titulo: $("f-titulo").value.trim(),
    texto: $("f-texto").value.trim(),
    imagen: $("f-imagen").value.trim(),
    enlace: $("f-enlace").value.trim(),
    enlaceTexto: $("f-enlace-texto").value.trim()
  };
  guardarLS(KEY_BORRADOR, contenido);
  mostrarVista(diaActual, estaDesbloqueado(diaActual));
  dibujar();
}

function exportar() {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contenido.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importar(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);
      if (typeof datos !== "object" || Array.isArray(datos)) throw new Error();
      contenido = datos;
      guardarLS(KEY_BORRADOR, contenido);
      dibujar();
    } catch { alert("El archivo JSON no es válido."); }
  };
  lector.readAsText(archivo);
}

async function descartarBorrador() {
  if (!confirm("¿Descartar los cambios locales y volver al contenido.json publicado?")) return;
  try { localStorage.removeItem(KEY_BORRADOR); } catch {}
  await cargarContenido();
  dibujar();
}

// ---------- Nieve decorativa ----------
function nieve() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cont = document.querySelector(".nieve");
  for (let i = 0; i < 30; i++) {
    const c = document.createElement("span");
    c.className = "copo";
    c.textContent = "❄";
    c.style.left = Math.random() * 100 + "vw";
    c.style.fontSize = 10 + Math.random() * 16 + "px";
    c.style.animationDuration = 8 + Math.random() * 12 + "s";
    c.style.animationDelay = -Math.random() * 15 + "s";
    cont.appendChild(c);
  }
}

// ---------- Inicio ----------
(async function init() {
  if (ES_ADMIN) {
    document.body.classList.add("admin");
    $("panel-admin").hidden = false;
  }
  await cargarContenido();
  dibujar();
  nieve();

  $("btn-editar").addEventListener("click", abrirFormulario);
  $("btn-cancelar").addEventListener("click", () => mostrarVista(diaActual, estaDesbloqueado(diaActual)));
  $("modal-form").addEventListener("submit", guardarFormulario);
  $("btn-exportar").addEventListener("click", exportar);
  $("input-importar").addEventListener("change", importar);
  $("btn-borrar-borrador").addEventListener("click", descartarBorrador);
})();
