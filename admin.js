// admin.js — Panel de administrador UDES Diagnóstico 2030
//
// La contraseña aquí es una protección superficial (client-side) para evitar
// acceso casual. Los datos en Google Sheets son públicamente legibles.
// Cambiar al mismo valor que ADMIN_PASSWORD en codigo.gs antes de desplegar.

var ADMIN_PASS_LOCAL = "UDES2030admin";

// URL de la hoja de Google Sheets (opcional, para el botón "Ver Google Sheets")
var SHEETS_URL = "";

document.addEventListener("DOMContentLoaded", function () {
  configurarAdminLogin();
  configurarFiltrosAdmin();
  configurarBotonSalir();
});

// ── Login administrador ───────────────────────────────────────────────────────

function configurarAdminLogin() {
  document.getElementById("btn-admin-login").addEventListener("click", function () {
    document.getElementById("screen-admin-login").classList.remove("hidden");
    setTimeout(function () {
      document.getElementById("input-admin-pass").focus();
    }, 80);
  });

  document.getElementById("btn-admin-cancel").addEventListener("click", function () {
    cerrarLoginAdmin();
  });

  document.getElementById("btn-admin-submit").addEventListener("click", function () {
    verificarAdmin();
  });

  document.getElementById("input-admin-pass").addEventListener("keydown", function (e) {
    if (e.key === "Enter") verificarAdmin();
    if (e.key === "Escape") cerrarLoginAdmin();
  });
}

function cerrarLoginAdmin() {
  document.getElementById("screen-admin-login").classList.add("hidden");
  document.getElementById("input-admin-pass").value = "";
  document.getElementById("admin-login-error").classList.add("hidden");
}

function verificarAdmin() {
  var pass    = document.getElementById("input-admin-pass").value;
  var errorEl = document.getElementById("admin-login-error");

  if (pass === ADMIN_PASS_LOCAL) {
    cerrarLoginAdmin();
    mostrarPanelAdmin();
  } else {
    errorEl.classList.remove("hidden");
    document.getElementById("input-admin-pass").value = "";
    document.getElementById("input-admin-pass").focus();
  }
}

// ── Panel administrador ───────────────────────────────────────────────────────

function mostrarPanelAdmin() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-board").classList.add("hidden");
  document.getElementById("screen-admin").classList.remove("hidden");

  if (SHEETS_URL) {
    var btnSheets = document.getElementById("btn-sheets-link");
    btnSheets.href = SHEETS_URL;
    btnSheets.classList.remove("hidden");
  }

  // Llenar filtros de la pantalla admin
  var filterCampus    = document.getElementById("filter-campus");
  var filterCategoria = document.getElementById("filter-categoria");
  var filterRol       = document.getElementById("filter-rol");

  // Limpiar opciones antes de llenar (evitar duplicados si admin entra varias veces)
  filterCampus.innerHTML    = '<option value="">Todos</option>';
  filterCategoria.innerHTML = '<option value="">Todas</option>';
  filterRol.innerHTML       = '<option value="">Todos</option>';

  CONFIG.CAMPUS.forEach(function (c) {
    filterCampus.insertAdjacentHTML("beforeend",
      '<option value="' + c + '">' + c + '</option>');
  });

  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var cat = CONFIG.CATEGORIAS[key];
    filterCategoria.insertAdjacentHTML("beforeend",
      '<option value="' + key + '">' + cat.emoji + " " + cat.label + '</option>');
  });

  CONFIG.ROLES.forEach(function (r) {
    filterRol.insertAdjacentHTML("beforeend",
      '<option value="' + r + '">' + r + '</option>');
  });

  cargarDatosAdmin();
  cargarResultados("admin-resultados-charts", "admin-resultados-total", leerFiltrosAdmin());
  cargarNubePalabras("admin-nubes", leerFiltrosAdmin());
  configurarBotonesExport();

  // Refresco en vivo de tarjetas, resultados del cuestionario y nube de palabras
  if (STATE.pollResultados) clearInterval(STATE.pollResultados);
  STATE.pollResultados = setInterval(function () {
    cargarDatosAdmin();
    cargarResultados("admin-resultados-charts", "admin-resultados-total", leerFiltrosAdmin());
    cargarNubePalabras("admin-nubes", leerFiltrosAdmin());
  }, CONFIG.POLL_INTERVAL);

  document.getElementById("btn-admin-refresh").addEventListener("click", function () {
    cargarDatosAdmin();
    cargarResultados("admin-resultados-charts", "admin-resultados-total", leerFiltrosAdmin());
    cargarNubePalabras("admin-nubes", leerFiltrosAdmin());
  });
}

// Lee los filtros de Campus/Rol/Categoría actualmente seleccionados en el panel
// admin, para aplicarlos también a las gráficas de la encuesta y a la nube de
// palabras (la encuesta ignora "categoria" porque no la tiene).
function leerFiltrosAdmin() {
  var campusEl    = document.getElementById("filter-campus");
  var rolEl       = document.getElementById("filter-rol");
  var categoriaEl = document.getElementById("filter-categoria");
  return {
    campus:    campusEl    ? campusEl.value    : "",
    rol:       rolEl       ? rolEl.value       : "",
    categoria: categoriaEl ? categoriaEl.value : ""
  };
}

function cargarDatosAdmin() {
  fetch(CONFIG.GAS_URL + "?action=getCards")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.cards) {
        STATE.todasLasTarjetas = data.cards;
        renderizarAdmin(data.cards);
      }
    })
    .catch(function (err) {
      console.error("Error cargando datos admin:", err);
      document.getElementById("admin-table-body").innerHTML =
        '<tr><td colspan="7" class="px-4 py-8 text-center text-red-500">Error al conectar con el servidor. Verifica la URL del endpoint.</td></tr>';
    });
}

function renderizarAdmin(tarjetas) {
  renderizarEstadisticas(tarjetas);
  renderizarTablaAdmin(tarjetas);
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

function renderizarEstadisticas(tarjetas) {
  var statsEl = document.getElementById("admin-stats");
  statsEl.innerHTML = "";

  // Total general
  statsEl.appendChild(crearStatCard("Total aportes", tarjetas.length, "#374151"));

  // Por campus
  CONFIG.CAMPUS.forEach(function (campus) {
    var count = tarjetas.filter(function (t) { return t.campus === campus; }).length;
    statsEl.appendChild(crearStatCard(campus, count, "#1a237e"));
  });

  // Por categoría
  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var cat   = CONFIG.CATEGORIAS[key];
    var count = tarjetas.filter(function (t) { return t.categoria === key; }).length;
    statsEl.appendChild(crearStatCard(cat.emoji + " " + cat.label.split(" ")[0], count, "#374151"));
  });

  // Total votos
  var totalVotos = tarjetas.reduce(function (sum, t) { return sum + (t.votos || 0); }, 0);
  statsEl.appendChild(crearStatCard("Total votos 👍", totalVotos, "#c62828"));
}

function crearStatCard(titulo, valor, color) {
  var div = document.createElement("div");
  div.className = "text-white rounded-xl p-4 text-center shadow-sm";
  div.style.backgroundColor = color;
  div.innerHTML =
    '<div class="text-3xl font-bold">' + valor + "</div>" +
    '<div class="text-xs mt-1 opacity-80 leading-tight">' + escapeHtml(titulo) + "</div>";
  return div;
}

// ── Tabla con filtros ─────────────────────────────────────────────────────────

function configurarFiltrosAdmin() {
  ["filter-campus", "filter-categoria", "filter-rol"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", aplicarFiltrosAdmin);
  });
}

function aplicarFiltrosAdmin() {
  var campus    = document.getElementById("filter-campus").value;
  var categoria = document.getElementById("filter-categoria").value;
  var rol       = document.getElementById("filter-rol").value;

  var tarjetas = STATE.todasLasTarjetas;
  if (campus)    tarjetas = tarjetas.filter(function (t) { return t.campus === campus; });
  if (categoria) tarjetas = tarjetas.filter(function (t) { return t.categoria === categoria; });
  if (rol)       tarjetas = tarjetas.filter(function (t) { return t.rol === rol; });

  renderizarTablaAdmin(tarjetas);

  // Las gráficas de la encuesta también se filtran por campus/rol (no tienen categoría)
  cargarResultados("admin-resultados-charts", "admin-resultados-total", { campus: campus, rol: rol });

  // La nube de palabras sí admite categoría (si se filtra una sola, las demás
  // quedan ocultas de forma natural al no tener tarjetas)
  cargarNubePalabras("admin-nubes", { campus: campus, rol: rol, categoria: categoria });
}

function renderizarTablaAdmin(tarjetas) {
  var tbody     = document.getElementById("admin-table-body");
  var countEl   = document.getElementById("table-count");
  countEl.textContent = tarjetas.length + " tarjeta" + (tarjetas.length !== 1 ? "s" : "");
  tbody.innerHTML = "";

  if (tarjetas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">No hay tarjetas para los filtros seleccionados.</td></tr>';
    return;
  }

  tarjetas.forEach(function (t) {
    var cat  = CONFIG.CATEGORIAS[t.categoria] || { emoji: "?", label: t.categoria };
    var fila = document.createElement("tr");
    fila.setAttribute("data-id", t.id);
    fila.className = "border-t border-gray-100 hover:bg-gray-50";

    var opcionesCategoria = Object.keys(CONFIG.CATEGORIAS).map(function (key) {
      var c = CONFIG.CATEGORIAS[key];
      var sel = key === t.categoria ? " selected" : "";
      return '<option value="' + key + '"' + sel + ">" + c.emoji + " " + c.label + "</option>";
    }).join("");

    fila.innerHTML =
      '<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">' + formatearFechaAdmin(t.timestamp) + "</td>" +
      '<td class="px-4 py-3 text-sm font-medium text-gray-700">' + escapeHtml(t.campus) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(t.rol) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-500">' + escapeHtml(t.nombre || "Anónimo") + "</td>" +
      '<td class="px-4 py-3 text-sm">' + cat.emoji + " " + escapeHtml(cat.label) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-700 max-w-xs">' + escapeHtml(t.texto) + "</td>" +
      '<td class="px-4 py-3 text-sm text-center font-bold text-blue-600">' + (t.votos || 0) + "</td>" +
      '<td class="px-4 py-3 text-center">' +
        '<div class="flex flex-col gap-1 items-center">' +
          '<button class="btn-eliminar text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded-lg transition-colors" data-id="' + t.id + '">🗑 Eliminar</button>' +
          '<select class="sel-mover text-xs border border-gray-200 rounded-lg px-1 py-1 text-gray-600 bg-white" data-id="' + t.id + '">' +
            opcionesCategoria +
          "</select>" +
          '<button class="btn-mover text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-lg transition-colors" data-id="' + t.id + '">↕ Mover</button>' +
        "</div>" +
      "</td>";
    tbody.appendChild(fila);
  });

  tbody.addEventListener("click", function (e) {
    var btnEliminar = e.target.closest(".btn-eliminar");
    var btnMover    = e.target.closest(".btn-mover");
    if (btnEliminar) eliminarTarjeta(btnEliminar.getAttribute("data-id"));
    if (btnMover)    moverTarjeta(btnMover.getAttribute("data-id"));
  });
}

// ── Exportación CSV ──────────────────────────────────────────────────────────

function generarCSV(cabeceras, filas) {
  function escaparCelda(val) {
    var s = val === null || val === undefined ? "" : String(val);
    if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  var lineas = [cabeceras.map(escaparCelda).join(",")];
  filas.forEach(function (fila) {
    lineas.push(fila.map(escaparCelda).join(","));
  });
  return "﻿" + lineas.join("\r\n");
}

function descargarArchivo(contenido, nombre, tipo) {
  var blob = new Blob([contenido], { type: tipo });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function obtenerTarjetasFiltradas() {
  var campus    = document.getElementById("filter-campus").value;
  var categoria = document.getElementById("filter-categoria").value;
  var rol       = document.getElementById("filter-rol").value;
  var tarjetas  = STATE.todasLasTarjetas.slice();
  if (campus)    tarjetas = tarjetas.filter(function (t) { return t.campus === campus; });
  if (categoria) tarjetas = tarjetas.filter(function (t) { return t.categoria === categoria; });
  if (rol)       tarjetas = tarjetas.filter(function (t) { return t.rol === rol; });
  return tarjetas;
}

function descargarCSVTarjetas() {
  var tarjetas = obtenerTarjetasFiltradas();
  if (tarjetas.length === 0) {
    alert("No hay tarjetas para los filtros seleccionados.");
    return;
  }

  var cabeceras = ["Fecha", "Campus", "Rol", "Nombre", "Categoria", "Categoria_clave", "Aporte", "Votos"];
  var filas = tarjetas.map(function (t) {
    var cat = CONFIG.CATEGORIAS[t.categoria] || { label: t.categoria };
    return [
      t.timestamp ? new Date(t.timestamp).toLocaleString("es-CO") : "",
      t.campus,
      t.rol,
      t.nombre || "Anonimo",
      cat.label,
      t.categoria,
      t.texto,
      t.votos || 0
    ];
  });

  var hoy = new Date().toISOString().slice(0, 10);
  descargarArchivo(generarCSV(cabeceras, filas), "tarjetas_UDES_" + hoy + ".csv", "text/csv;charset=utf-8;");
}

function descargarCSVEncuesta() {
  var btn = document.getElementById("btn-export-encuesta");
  btn.disabled = true;
  btn.textContent = "Descargando...";

  var campus = document.getElementById("filter-campus").value;
  var rol    = document.getElementById("filter-rol").value;

  fetch(CONFIG.GAS_URL + "?action=getEncuesta")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var respuestas = data.respuestas || [];
      if (campus) respuestas = respuestas.filter(function (r) { return r.campus === campus; });
      if (rol)    respuestas = respuestas.filter(function (r) { return r.rol === rol; });

      if (respuestas.length === 0) {
        alert("No hay respuestas para los filtros seleccionados.");
        btn.disabled = false;
        btn.textContent = "⬇ CSV Cuestionario";
        return;
      }

      var p = CONFIG.PREGUNTAS;
      var cabeceras = [
        "Fecha", "Campus", "Rol", "Nombre",
        "P1_" + (p[0] ? p[0].texto.slice(0, 45) : "p1"),
        "P2_" + (p[1] ? p[1].texto.slice(0, 45) : "p2"),
        "P3_" + (p[2] ? p[2].texto.slice(0, 45) : "p3")
      ];
      var filas = respuestas.map(function (r) {
        return [
          r.timestamp ? new Date(r.timestamp).toLocaleString("es-CO") : "",
          r.campus,
          r.rol,
          r.nombre || "Anonimo",
          (r.p1 || []).join("; "),
          (r.p2 || []).join("; "),
          (r.p3 || []).join("; ")
        ];
      });

      var hoy = new Date().toISOString().slice(0, 10);
      descargarArchivo(generarCSV(cabeceras, filas), "encuesta_UDES_" + hoy + ".csv", "text/csv;charset=utf-8;");
      btn.disabled = false;
      btn.textContent = "⬇ CSV Cuestionario";
    })
    .catch(function () {
      alert("Error al conectar con el servidor. Intenta de nuevo.");
      btn.disabled = false;
      btn.textContent = "⬇ CSV Cuestionario";
    });
}

function configurarBotonesExport() {
  var btnT = document.getElementById("btn-export-tarjetas");
  var btnE = document.getElementById("btn-export-encuesta");
  if (btnT) btnT.onclick = descargarCSVTarjetas;
  if (btnE) btnE.onclick = descargarCSVEncuesta;
}

// ── Salir del panel admin ─────────────────────────────────────────────────────

function configurarBotonSalir() {
  document.getElementById("btn-admin-exit").addEventListener("click", function () {
    if (STATE.pollResultados) { clearInterval(STATE.pollResultados); STATE.pollResultados = null; }
    document.getElementById("screen-admin").classList.add("hidden");
    document.getElementById("screen-config").classList.remove("hidden");
  });
}

// ── Acciones de moderación ────────────────────────────────────────────────────

function eliminarTarjeta(id) {
  if (!confirm("¿Eliminar esta tarjeta? Esta acción no se puede deshacer.")) return;

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "deleteCard", id: id, password: ADMIN_PASS_LOCAL })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        cargarDatosAdmin();
      } else {
        alert("Error al eliminar: " + (data.error || "desconocido"));
      }
    })
    .catch(function () { alert("Error de conexión al eliminar la tarjeta."); });
}

function moverTarjeta(id) {
  var fila = document.querySelector('tr[data-id="' + id + '"]');
  if (!fila) return;
  var select = fila.querySelector(".sel-mover");
  if (!select) return;
  var nuevaCategoria = select.value;

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "moveCard", id: id, nuevaCategoria: nuevaCategoria, password: ADMIN_PASS_LOCAL })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        cargarDatosAdmin();
      } else {
        alert("Error al mover: " + (data.error || "desconocido"));
      }
    })
    .catch(function () { alert("Error de conexión al mover la tarjeta."); });
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatearFechaAdmin(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit", month: "2-digit", year: "2-digit"
    }) + " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}
