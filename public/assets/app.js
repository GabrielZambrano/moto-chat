'use strict';
/* Central MotoTaxi — panel. Vanilla JS: auth JWT + router + vistas. */

const TOKEN_KEY = 'mt_token';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = { token: localStorage.getItem(TOKEN_KEY) || '', condFiltro: '', viajeFiltro: '' };

/* ---------------- API ---------------- */
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`/api/admin${path}`, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Error de servidor');
  return data;
}

/* ---------------- Utilidades ---------------- */
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : ''); t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2800);
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}
function badge(estado) { return `<span class="badge ${esc(estado)}">${esc(estado)}</span>`; }

/* ---------------- Auth ---------------- */
function logout() {
  state.token = ''; localStorage.removeItem(TOKEN_KEY);
  const m = $('#modal'); if (m) m.hidden = true;   // cerrar cualquier modal abierto
  $('#app').hidden = true; $('#login').hidden = false;
}
async function boot() {
  if (!state.token) return logout();
  try { const me = await api('/me'); $('#who-user').textContent = me.user.usuario; enterApp(); }
  catch { logout(); }
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target; const err = $('#login-error'); err.hidden = true;
  try {
    const r = await api('/login', { method: 'POST', body: { usuario: f.usuario.value.trim(), password: f.password.value } });
    state.token = r.token; localStorage.setItem(TOKEN_KEY, r.token);
    $('#who-user').textContent = r.user.usuario;
    f.reset(); enterApp();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
});
$('#logout').addEventListener('click', logout);

// Ocultar / mostrar el menú lateral (aplica a todas las vistas).
$('#toggle-nav').addEventListener('click', () => {
  $('#app').classList.toggle('nav-oculto');
  if (mapa) setTimeout(() => mapa.invalidateSize(), 220); // el mapa se re-ajusta al nuevo ancho
});

function enterApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  routeFromHash();
}

/* ---------------- Router ---------------- */
const VIEWS = {
  dashboard: { title: 'Panel', eyebrow: 'Despacho en vivo', load: loadDashboard },
  conductores: { title: 'Conductores', eyebrow: 'Flota de unidades', load: loadConductores },
  viajes: { title: 'Viajes', eyebrow: 'Historial de pedidos', load: loadViajes },
  sectores: { title: 'Sectores', eyebrow: 'Zonas y polígonos', load: loadSectores },
};
function routeFromHash() {
  const view = (location.hash.replace('#', '') || 'dashboard');
  const cfg = VIEWS[view] || VIEWS.dashboard;
  $$('.view').forEach((v) => (v.hidden = true));
  $(`#view-${VIEWS[view] ? view : 'dashboard'}`).hidden = false;
  $$('.nav-link').forEach((a) => a.classList.toggle('is-active', a.dataset.view === view));
  $('#view-title').textContent = cfg.title;
  $('#view-eyebrow').textContent = cfg.eyebrow;
  cfg.load();
}
window.addEventListener('hashchange', routeFromHash);
$('#refresh').addEventListener('click', routeFromHash);

/* ---------------- Dashboard ---------------- */
async function loadDashboard() {
  let s;
  try { s = await api('/stats'); } catch (e) { return toast(e.message, true); }

  const kpis = [
    { label: 'Viajes totales', value: s.totalPedidos, foot: `${s.pedidosHoy} hoy`, c: 'var(--signal)' },
    { label: 'Pendientes', value: s.porEstado.pendiente, foot: 'esperando conductor', c: 'var(--amber)' },
    { label: 'Conductores activos', value: s.conductores.disponible, foot: `${s.conductores.total} en la flota`, c: 'var(--mint)' },
    { label: 'ETA promedio', value: s.etaPromedio != null ? `${s.etaPromedio}′` : '—', foot: 'minutos declarados', c: 'var(--sky)' },
  ];
  $('#kpi-row').innerHTML = kpis.map((k) => `
    <div class="kpi" style="--kpi-c:${k.c}">
      <div class="k-label">${k.label}</div>
      <div class="k-value">${esc(k.value)}</div>
      <div class="k-foot">${esc(k.foot)}</div>
    </div>`).join('');

  $('#chart-serie').innerHTML = barChart(s.serie);
  $('#chart-estados').innerHTML = donut(s.porEstado);

  $('#top-conductores').innerHTML = s.topConductores.length ? s.topConductores.map((c, i) => `
    <div class="rank-row">
      <span class="rank-pos">${i + 1}</span>
      ${c.fotoUrl ? `<img class="rank-photo" src="${esc(c.fotoUrl)}" alt="">` : `<div class="rank-photo"></div>`}
      <div class="rank-name">${esc(c.fullName)}<small>Unidad #${esc(c.unit || '—')}</small></div>
      <span class="rank-count">${c.viajes}</span>
    </div>`).join('') : emptyState('Aún no hay viajes asignados', 'Cuando un conductor acepte, aparecerá aquí.');

  $('#recientes').innerHTML = s.recientes.length ? s.recientes.map((p) => `
    <div class="feed-row">
      <span class="feed-code">#${esc(p.pedidoCode)}</span>
      <div class="feed-main"><b>${esc(p.clienteNombre || 'Cliente')}</b><small>${esc(p.ubicDescripcion || 'Sin dirección')}</small></div>
      ${badge(p.estado)}
    </div>`).join('') : emptyState('Sin actividad todavía', 'Los pedidos entrantes se listarán aquí.');
}

function emptyState(title, sub) { return `<div class="empty"><b>${esc(title)}</b>${esc(sub)}</div>`; }

/* Gráfico de barras SVG (7 días) */
function barChart(serie) {
  const W = 100, H = 46, max = Math.max(1, ...serie.map((d) => d.total));
  const n = serie.length, gap = 2.4, bw = (W - gap * (n - 1)) / n;
  const bars = serie.map((d, i) => {
    const h = (d.total / max) * (H - 12);
    const x = i * (bw + gap), y = (H - 8) - h;
    return `<g class="bar-col">
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(h, .6).toFixed(2)}" rx="1.2" fill="var(--signal)"/>
      <text x="${(x + bw / 2).toFixed(2)}" y="${(y - 1.5).toFixed(2)}" text-anchor="middle" font-size="3.2" fill="var(--muted)" font-family="var(--font-mono)">${d.total || ''}</text>
      <text x="${(x + bw / 2).toFixed(2)}" y="${(H - 2).toFixed(2)}" text-anchor="middle" font-size="3" fill="var(--muted)">${esc(d.label)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" style="height:200px">${bars}</svg>`;
}

/* Donut SVG de estados */
function donut(porEstado) {
  const items = [
    { k: 'finalizado', c: 'var(--mint)' }, { k: 'aceptado', c: 'var(--sky)' },
    { k: 'pendiente', c: 'var(--amber)' }, { k: 'cancelado', c: 'var(--red)' },
    { k: 'no_atendido', c: '#C88BFF' },
  ].map((x) => ({ ...x, v: porEstado[x.k] || 0 }));
  const total = items.reduce((a, b) => a + b.v, 0);
  const R = 15.9155, C = 2 * Math.PI * R; let off = 0;
  const segs = total ? items.filter((i) => i.v).map((i) => {
    const frac = i.v / total, len = frac * C;
    const s = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${i.c}" stroke-width="6"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 21 21)"/>`;
    off += len; return s;
  }).join('') : `<circle r="${R}" cx="21" cy="21" fill="none" stroke="var(--line)" stroke-width="6"/>`;
  const legend = items.map((i) => `<div class="leg"><i style="background:${i.c}"></i>${i.k} <b>${i.v}</b></div>`).join('');
  return `
    <svg viewBox="0 0 42 42" width="150" height="150">${segs}
      <text x="21" y="20" text-anchor="middle" font-size="7" font-weight="700" fill="var(--text)" font-family="var(--font-display)">${total}</text>
      <text x="21" y="26" text-anchor="middle" font-size="3.4" fill="var(--muted)">viajes</text>
    </svg>
    <div class="donut-legend">${legend}</div>`;
}

/* ---------------- Conductores ---------------- */
$('#cond-filtros').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#cond-filtros .chip').forEach((c) => c.classList.remove('is-active'));
  b.classList.add('is-active'); state.condFiltro = b.dataset.estado; loadConductores();
});

async function loadConductores() {
  let lista;
  try { lista = await api(`/conductores${state.condFiltro ? `?estado=${state.condFiltro}` : ''}`); }
  catch (e) { return toast(e.message, true); }
  const grid = $('#cond-grid');
  if (!lista.length) { grid.innerHTML = emptyState('No hay conductores', 'Agrega tu primera unidad con “+ Nuevo conductor”.'); return; }
  grid.innerHTML = lista.map((c) => `
    <div class="cond-card" data-id="${esc(c.phoneFull)}">
      <div class="cond-top">
        ${c.fotoUrl ? `<img src="${esc(c.fotoUrl)}" alt="Unidad ${esc(c.unit || '')}">` : `<div class="no-photo">🛵</div>`}
        <div class="unit-tag"><small>Unidad</small><b>${esc(c.unit || '—')}</b></div>
      </div>
      <div class="cond-body">
        <div class="cond-name">${esc(c.fullName)}</div>
        <div class="cond-meta">
          <span>📞 <b>${esc(c.phoneFull)}</b></span>
          <span>🏍️ Placa <b>${esc(c.plate || '—')}</b></span>
        </div>
        <div class="cond-actions">
          <select class="estado-select" data-estado>
            ${['disponible', 'ocupado', 'inactivo'].map((e2) => `<option value="${e2}" ${c.estado === e2 ? 'selected' : ''}>${e2}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" data-edit>Editar</button>
          <button class="btn btn-ghost btn-sm" data-del title="Eliminar">🗑</button>
        </div>
        <div class="cond-actions cond-grupo">
          <button class="btn btn-ghost btn-sm" data-grupo-add>➕ Agregar al grupo</button>
          <button class="btn btn-ghost btn-sm" data-grupo-del title="Quitar del grupo">➖ Quitar</button>
        </div>
      </div>
    </div>`).join('');
}

$('#cond-grid').addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-estado]'); if (!sel) return;
  const id = e.target.closest('.cond-card').dataset.id;
  try { await api(`/conductores/${id}/estado`, { method: 'PATCH', body: { estado: sel.value } }); toast('Estado actualizado'); }
  catch (ex) { toast(ex.message, true); }
});
$('#cond-grid').addEventListener('click', async (e) => {
  const card = e.target.closest('.cond-card'); if (!card) return;
  const id = card.dataset.id;
  if (e.target.closest('[data-del]')) {
    if (!confirm('¿Eliminar este conductor?')) return;
    try { await api(`/conductores/${id}`, { method: 'DELETE' }); toast('Conductor eliminado'); loadConductores(); }
    catch (ex) { toast(ex.message, true); }
  }
  if (e.target.closest('[data-grupo-add]')) {
    const btn = e.target.closest('[data-grupo-add]'); btn.disabled = true;
    try { await api(`/conductores/${id}/grupo`, { method: 'POST' }); toast('Conductor agregado al grupo'); }
    catch (ex) { toast(ex.message, true); }
    finally { btn.disabled = false; }
    return;
  }
  if (e.target.closest('[data-grupo-del]')) {
    if (!confirm('¿Quitar a este conductor del grupo de WhatsApp?')) return;
    const btn = e.target.closest('[data-grupo-del]'); btn.disabled = true;
    try { await api(`/conductores/${id}/grupo`, { method: 'DELETE' }); toast('Conductor quitado del grupo'); }
    catch (ex) { toast(ex.message, true); }
    finally { btn.disabled = false; }
    return;
  }
  if (e.target.closest('[data-edit]')) {
    const c = { phoneFull: id };
    const name = card.querySelector('.cond-name').textContent;
    const unit = card.querySelector('.unit-tag b').textContent;
    const plate = card.querySelectorAll('.cond-meta b')[1].textContent;
    const estado = card.querySelector('[data-estado]').value;
    openModal({ phoneFull: id, fullName: name, unit: unit === '—' ? '' : unit, plate: plate === '—' ? '' : plate, estado,
      fotoUrl: card.querySelector('.cond-top img')?.getAttribute('src') || '' });
  }
});

/* ---------------- Modal conductor ---------------- */
const modal = $('#modal'), condForm = $('#cond-form');
function openModal(c = null) {
  condForm.reset(); $('#cond-error').hidden = true;
  const editing = !!c;
  $('#modal-title').textContent = editing ? 'Editar conductor' : 'Nuevo conductor';
  condForm._editId.value = editing ? c.phoneFull : '';
  condForm.phoneFull.value = c?.phoneFull || '';
  condForm.phoneFull.readOnly = false; // se puede cambiar el número
  $('#modal-grupo').hidden = !editing;  // acciones de grupo solo al editar
  condForm.fullName.value = c?.fullName || '';
  condForm.unit.value = c?.unit || '';
  condForm.plate.value = c?.plate || '';
  condForm.estado.value = c?.estado || 'disponible';
  const prev = $('#foto-preview');
  prev.innerHTML = c?.fotoUrl ? `<img src="${esc(c.fotoUrl)}">` : '<span>Sin foto</span>';
  modal.hidden = false;
}
$('#btn-nuevo').addEventListener('click', () => openModal());

// Acciones de grupo dentro del modal (operan sobre el conductor que se edita).
async function accionGrupoModal(metodo, okMsg) {
  const id = condForm._editId.value;
  if (!id) return;
  try { await api(`/conductores/${id}/grupo`, { method: metodo }); toast(okMsg); }
  catch (ex) { const e = $('#cond-error'); e.textContent = ex.message; e.hidden = false; }
}
$('[data-modal-grupo-add]').addEventListener('click', () => accionGrupoModal('POST', 'Conductor agregado al grupo'));
$('[data-modal-grupo-del]').addEventListener('click', () => {
  if (confirm('¿Quitar a este conductor del grupo de WhatsApp?')) accionGrupoModal('DELETE', 'Conductor quitado del grupo');
});
$('[data-modal-grupo-link]').addEventListener('click', async () => {
  const e = $('#cond-error'); e.hidden = true;
  try {
    const r = await api('/conductores/grupo/invite-link');
    let copiado = false;
    try { await navigator.clipboard.writeText(r.link); copiado = true; } catch {}
    toast(copiado ? 'Enlace copiado ✅ Pégalo al conductor' : r.link);
  } catch (ex) { e.textContent = ex.message; e.hidden = false; }
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => (modal.hidden = true)));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
$('#foto-input').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  $('#foto-preview').innerHTML = `<img src="${URL.createObjectURL(file)}">`;
});

condForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#cond-error'); err.hidden = true;
  const btn = $('#cond-save'); btn.disabled = true;
  try {
    const editId = condForm._editId.value;
    const fd = new FormData();
    fd.append('phoneFull', condForm.phoneFull.value.replace(/\D/g, ''));
    fd.append('fullName', condForm.fullName.value.trim());
    fd.append('unit', condForm.unit.value.trim());
    fd.append('plate', condForm.plate.value.trim());
    fd.append('estado', condForm.estado.value);
    if (condForm.foto.files[0]) fd.append('foto', condForm.foto.files[0]);
    if (editId) await api(`/conductores/${editId}`, { method: 'PUT', body: fd });
    else await api('/conductores', { method: 'POST', body: fd });
    modal.hidden = true; toast(editId ? 'Conductor actualizado' : 'Conductor registrado'); loadConductores();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  finally { btn.disabled = false; }
});

/* ---------------- Viajes ---------------- */
$('#viaje-filtros').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#viaje-filtros .chip').forEach((c) => c.classList.remove('is-active'));
  b.classList.add('is-active'); state.viajeFiltro = b.dataset.estado; loadViajes();
});
async function loadViajes() {
  let lista;
  try { lista = await api(`/pedidos${state.viajeFiltro ? `?estado=${state.viajeFiltro}` : ''}`); }
  catch (e) { return toast(e.message, true); }
  const body = $('#viajes-body');
  if (!lista.length) { body.innerHTML = `<tr><td colspan="7">${emptyState('Sin viajes', 'No hay pedidos para este filtro.')}</td></tr>`; return; }
  body.innerHTML = lista.map((p) => {
    const cd = p.conductorData || {};
    return `<tr>
      <td class="mono">#${esc(p.pedidoCode)}</td>
      <td>${esc(p.clienteNombre || 'Cliente')}<br><small class="mono" style="color:var(--muted)">${esc(p.clienteTelefono)}</small></td>
      <td>${esc(p.ubicDescripcion || '—')} ${p.ubicMapsUrl ? `<a class="maps" href="${esc(p.ubicMapsUrl)}" target="_blank" rel="noopener">🗺️</a>` : ''}</td>
      <td>${cd.fullName ? `${esc(cd.fullName)} <small class="mono" style="color:var(--muted)">#${esc(cd.unit || '—')}</small>` : '—'}</td>
      <td class="mono">${p.minutosEta != null ? p.minutosEta + '′' : '—'}</td>
      <td>${badge(p.estado)}</td>
      <td class="mono" style="color:var(--muted)">${fechaCorta(p.creadoEn)}</td>
    </tr>`;
  }).join('');
}

/* ---------------- Sectores (mapa) ---------------- */
const CONCEPCION = { lat: -16.1375, lng: -62.0206, zoom: 14 };
const SECTOR_COLORS = ['#2B6CB0', '#DD6B20', '#38A169', '#E53E3E', '#805AD5', '#3182CE', '#D69E2E', '#00B5D8', '#D53F8C', '#65A30D', '#B83280', '#C05621'];
let mapa = null, capaSectores = null, sectores = [];

function puntoEnPoligono(lat, lng, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat;
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) dentro = !dentro;
  }
  return dentro;
}
function seSuperpone(nuevo, excluirId) {
  for (const s of sectores) {
    if (excluirId && s.id === excluirId) continue;
    const g = s.coordenadas || [];
    if (nuevo.some((p) => puntoEnPoligono(p.lat, p.lng, g)) || g.some((p) => puntoEnPoligono(p.lat, p.lng, nuevo))) {
      return s.nombreSector;
    }
  }
  return null;
}

function initMapa() {
  mapa = L.map('mapa').setView([CONCEPCION.lat, CONCEPCION.lng], CONCEPCION.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(mapa);

  const dibujados = new L.FeatureGroup();
  mapa.addLayer(dibujados);
  const control = new L.Control.Draw({
    draw: {
      polygon: { allowIntersection: false, showArea: true, metric: true,
        shapeOptions: { color: '#000000', fillColor: '#2B3E93', fillOpacity: 0.3 } },
      polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
    },
    edit: { featureGroup: dibujados, edit: false, remove: false },
  });
  mapa.addControl(control);

  mapa.on(L.Draw.Event.CREATED, async (e) => {
    const coords = e.layer.getLatLngs()[0].map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    dibujados.removeLayer(e.layer);
    const sup = seSuperpone(coords);
    if (sup) { alert(`El polígono se superpone con el sector "${sup}". No se guardó.`); return; }
    const nombre = prompt('Nombre del sector:');
    if (!nombre || !nombre.trim()) return;
    try { await api('/sectores', { method: 'POST', body: { nombreSector: nombre.trim(), coordenadas: coords } }); toast('Sector guardado'); await cargarSectores(); }
    catch (ex) { toast(ex.message, true); }
  });
}

async function cargarSectores() {
  try { sectores = await api('/sectores'); } catch (e) { return toast(e.message, true); }
  dibujarSectores();
  renderListaSectores();
}

function dibujarSectores() {
  if (capaSectores) mapa.removeLayer(capaSectores);
  capaSectores = L.featureGroup().addTo(mapa);
  sectores.forEach((s, i) => {
    const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
    const coords = (s.coordenadas || []).map((c) => [c.lat, c.lng]);
    const poly = L.polygon(coords, { color, fillColor: color, fillOpacity: 0.35 }).addTo(capaSectores);
    poly.bindPopup(`<div class="poly-pop"><input class="polygon-name-input" value="${esc(s.nombreSector)}"/><button class="poly-save">Guardar</button></div>`);
    poly.on('popupopen', () => {
      const cont = poly.getPopup().getElement();
      const input = cont.querySelector('.polygon-name-input');
      const doSave = async () => {
        const val = input.value.trim(); if (!val) return;
        try { await api(`/sectores/${s.id}`, { method: 'PUT', body: { nombreSector: val } }); s.nombreSector = val; renderListaSectores(); poly.closePopup(); toast('Nombre actualizado'); }
        catch (ex) { toast(ex.message, true); }
      };
      cont.querySelector('.poly-save').addEventListener('click', doSave);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSave(); });
      setTimeout(() => input.focus(), 50);
    });
    poly.on('contextmenu', () => eliminarSector(s.id, s.nombreSector));
  });
}

async function eliminarSector(id, nombre) {
  if (!confirm(`¿Eliminar el sector "${nombre}"?`)) return;
  try { await api(`/sectores/${id}`, { method: 'DELETE' }); sectores = sectores.filter((x) => x.id !== id); dibujarSectores(); renderListaSectores(); toast('Sector eliminado'); }
  catch (ex) { toast(ex.message, true); }
}

function renderListaSectores() {
  const q = ($('#sector-buscar').value || '').toLowerCase();
  const lista = sectores.filter((s) => s.nombreSector.toLowerCase().includes(q));
  const cont = $('#sector-lista');
  if (!lista.length) { cont.innerHTML = emptyState('Sin sectores', 'Dibuja un polígono en el mapa para crear uno.'); return; }
  cont.innerHTML = lista.map((s) => `
    <div class="sector-item">
      <button class="sector-nombre" data-focus="${esc(s.id)}">${esc(s.nombreSector)}</button>
      <button class="icon-btn" data-del-sector="${esc(s.id)}" title="Eliminar">🗑</button>
    </div>`).join('');
}

$('#sector-buscar').addEventListener('input', renderListaSectores);
$('#sector-lista').addEventListener('click', (e) => {
  const f = e.target.closest('[data-focus]');
  const d = e.target.closest('[data-del-sector]');
  if (f) {
    const s = sectores.find((x) => x.id === f.dataset.focus);
    if (s && s.coordenadas?.length) {
      const b = L.latLngBounds(s.coordenadas.map((c) => [c.lat, c.lng]));
      mapa.flyToBounds(b, { padding: [40, 40], maxZoom: 17, duration: 0.6 });
    }
  }
  if (d) { const s = sectores.find((x) => x.id === d.dataset.delSector); eliminarSector(d.dataset.delSector, s?.nombreSector || ''); }
});

async function loadSectores() {
  if (!mapa) initMapa();
  setTimeout(() => mapa.invalidateSize(), 120);
  await cargarSectores();
}

/* ---------------- Init ---------------- */
boot();
