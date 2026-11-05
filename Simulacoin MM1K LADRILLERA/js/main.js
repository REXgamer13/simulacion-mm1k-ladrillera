// ============================================================================
// main.js — Controlador Principal de UI, Pestañas y Enlace con el Motor 3D
// Ladrillera Los Vados S.A.S. — Simulación M/M/1/K
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================

import { World3D } from './scene3d/world3D.js';
import { DiscreteSimulation, ESTADOS } from './simulation/discreteSim.js';
import {
    calcularVariablesMM1K, calcularTiempoPorPedido, calcularTsPromedio,
    CONFIG_SISTEMA_ACTUAL, CONFIG_5_CARGUEROS
} from './math/mm1kEngine.js';
import {
    PEDIDOS_DIA, CAMIONES_INSTRUMENTO, TIPOS_CAMION,
    detectarTipoCamion, formatearHora, horaAMin
} from './data/pedidosData.js';

// ===========================================================================
// INICIALIZACIÓN
// ===========================================================================
let world3D = null;
let sim = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initVista1();
    initVista2();
    initVista3();
    initVista4();
});

// ===========================================================================
// SISTEMA DE PESTAÑAS
// ===========================================================================
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const views = document.querySelectorAll('.view-container');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.view);
            if (target) target.classList.add('active');
            // Inicializar 3D solo al entrar a Vista 1
            if (tab.dataset.view === 'vista1' && !world3D) {
                initWorld3D();
            }
            // Resize 3D si ya existe
            if (world3D && tab.dataset.view === 'vista1') {
                window.dispatchEvent(new Event('resize'));
            }
        });
    });
}

// ===========================================================================
// VISTA 1: SIMULACIÓN 3D EN TIEMPO REAL
// ===========================================================================
function initVista1() {
    // Botones de control
    document.getElementById('btn-start').addEventListener('click', startSimulation);
    document.getElementById('btn-pause').addEventListener('click', () => sim && sim.togglePause());
    document.getElementById('btn-reset').addEventListener('click', resetSimulation);

    // Velocidades
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const spd = parseInt(btn.dataset.speed);
            if (sim) sim.setSpeed(spd);
        });
    });

    // Cámaras
    document.getElementById('cam-perspective').addEventListener('click', () => world3D?.switchCamera('perspectiva'));
    document.getElementById('cam-ortho').addEventListener('click', () => world3D?.switchCamera('ortografica'));
    document.getElementById('cam-loading').addEventListener('click', () => world3D?.switchCamera('cargue'));

    // Controles rápidos
    document.getElementById('sim-cargueros').addEventListener('change', (e) => {
        const m = parseInt(e.target.value);
        if (sim) sim.setCargueros(m);
    });
    document.getElementById('sim-capacidad').addEventListener('change', (e) => {
        const k = parseInt(e.target.value);
        if (sim) sim.setCapacidadK(k);
    });
}

function initWorld3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    world3D = new World3D(container);
    world3D.init();
}

function startSimulation() {
    if (!world3D) initWorld3D();
    const m = parseInt(document.getElementById('sim-cargueros').value) || 3;
    const k = parseInt(document.getElementById('sim-capacidad').value) || 6;

    sim = new DiscreteSimulation(world3D, {
        capacidadK: k,
        cargueros: m,
        pedidos: [...PEDIDOS_DIA]
    });

    // Escuchar ticks para actualizar HUD
    sim.onTick(updateHUD);

    // Escuchar eventos para bitácora
    sim.onEvent(addLogEntry);

    sim.start();
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-pause').disabled = false;
}

function resetSimulation() {
    if (sim) sim.reset();
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-pause').disabled = true;
    clearLog();
    updateHUD({
        simTime: 360, formatted: '6:00 a.m.',
        trucks: [], stats: { atendidos: 0, bloqueados: 0, enSistema: 0, enCola: 0, serverBusy: false, inLunchBreak: false, finished: false }
    });
}

function updateHUD(data) {
    const el = (id) => document.getElementById(id);
    el('hud-time').textContent = data.formatted;
    el('hud-atendidos').textContent = data.stats.atendidos;
    el('hud-bloqueados').textContent = data.stats.bloqueados;
    el('hud-en-sistema').textContent = data.stats.enSistema;
    el('hud-en-cola').textContent = data.stats.enCola;
    el('hud-servidor').textContent = data.stats.serverBusy ? 'Ocupado' : 'Libre';

    // Overlay de almuerzo
    const lunchEl = document.getElementById('lunch-overlay');
    if (lunchEl) lunchEl.style.display = data.stats.inLunchBreak ? 'block' : 'none';

    // Estado general
    const statusEl = el('hud-estado');
    if (data.stats.finished) {
        statusEl.textContent = '🏁 Jornada Finalizada';
        statusEl.style.color = '#FFD54F';
    } else if (data.stats.inLunchBreak) {
        statusEl.textContent = '🍽️ Almuerzo';
        statusEl.style.color = '#FF9800';
    } else {
        statusEl.textContent = '🟢 En operación';
        statusEl.style.color = '#4CAF50';
    }
}

function addLogEntry(evt) {
    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;
    const truck = evt.truck;
    const row = document.createElement('tr');

    let estadoBadge = '';
    if (truck) {
        const cls = {
            [ESTADOS.EN_COLA]: 'badge-cola',
            [ESTADOS.CARGANDO]: 'badge-cargando',
            [ESTADOS.ATENDIDO]: 'badge-atendido',
            [ESTADOS.BLOQUEADO]: 'badge-bloqueado',
        }[truck.estado] || 'badge-esperando';
        estadoBadge = `<span class="badge ${cls}">${truck.estado}</span>`;
    }

    row.innerHTML = `
        <td>${evt.formatted}</td>
        <td>${truck ? `#${truck.pedidoNum}` : '—'}</td>
        <td>${truck ? truck.tipoCamionObj.nombre : '—'}</td>
        <td>${truck ? truck.bloques.toLocaleString() : '—'}</td>
        <td>${estadoBadge || evt.type}</td>
    `;
    tbody.prepend(row);

    // Limitar filas
    while (tbody.children.length > 50) tbody.removeChild(tbody.lastChild);
}

function clearLog() {
    const tbody = document.getElementById('log-tbody');
    if (tbody) tbody.innerHTML = '';
}

// ===========================================================================
// VISTA 2: DASHBOARD INTERACTIVO M/M/1/K
// ===========================================================================
function initVista2() {
    // Valores por defecto (Sistema Actual)
    const el = (id) => document.getElementById(id);

    const setSliders = (cfg) => {
        el('v2-cargueros').value = cfg.cargueros;
        el('v2-cargueros-val').textContent = cfg.cargueros;
        el('v2-ts').value = cfg.tiempoServicioMin;
        el('v2-ts-val').textContent = cfg.tiempoServicioMin.toFixed(2);
        el('v2-llegadas').value = cfg.totalLlegadas;
        el('v2-llegadas-val').textContent = cfg.totalLlegadas;
        el('v2-hef').value = cfg.horasEfectivas;
        el('v2-hef-val').textContent = cfg.horasEfectivas;
        el('v2-k').value = cfg.capacidadK;
        el('v2-k-val').textContent = cfg.capacidadK;
    };

    setSliders(CONFIG_SISTEMA_ACTUAL);
    updateDashboardV2();

    // Sliders con actualización en vivo
    ['v2-cargueros', 'v2-ts', 'v2-llegadas', 'v2-hef', 'v2-k'].forEach(id => {
        el(id).addEventListener('input', () => {
            el(id + '-val').textContent = parseFloat(el(id).value).toFixed(id === 'v2-ts' ? 2 : 0);
            updateDashboardV2();
        });
    });

    // Botón: Sistema Actual (3 cargueros)
    el('btn-sistema-actual').addEventListener('click', () => {
        setSliders(CONFIG_SISTEMA_ACTUAL);
        updateDashboardV2();
    });

    // Botón: 5 Cargueros
    el('btn-5-cargueros').addEventListener('click', () => {
        setSliders(CONFIG_5_CARGUEROS);
        updateDashboardV2();
    });
}

function updateDashboardV2() {
    const el = (id) => document.getElementById(id);
    const totalLlegadas = parseFloat(el('v2-llegadas').value);
    const horasEfectivas = parseFloat(el('v2-hef').value);
    const tiempoServicioMin = parseFloat(el('v2-ts').value);
    const capacidadK = parseInt(el('v2-k').value);

    const vars = calcularVariablesMM1K({ totalLlegadas, horasEfectivas, tiempoServicioMin, capacidadK });

    // Tarjetas
    el('card-lambda').textContent = vars.lambda.toFixed(4);
    el('card-mu').textContent = vars.mu.toFixed(4);
    el('card-rho').textContent = vars.rho.toFixed(4);
    el('card-pk').textContent = (vars.P_K * 100).toFixed(2) + '%';
    el('card-lambdaef').textContent = vars.lambda_ef.toFixed(4);
    el('card-wq').textContent = vars.W_q_min.toFixed(1) + ' min';

    // Tabla de variables
    renderVariablesTable('v2-variables-tbody', vars, parseInt(el('v2-cargueros').value));

    // Gráfico de distribución
    drawDistributionChart('v2-chart-canvas', vars.distribucionPn);
}

// ===========================================================================
// VISTA 3: INSTRUMENTO DE ENTRADA DE DATOS
// ===========================================================================
let instrumentoPedidos = [];

function initVista3() {
    // Inicializar con los 6 camiones del instrumento
    instrumentoPedidos = CAMIONES_INSTRUMENTO.map((c, i) => ({
        camionNum: i + 1,
        tipoCamion: c.tipoCamion,
        bloques: c.bloques,
        cargueros: c.cargueros
    }));

    renderInstrumentoTable();
    updateInstrumentoDashboard();

    // Agregar camión
    document.getElementById('btn-agregar-camion').addEventListener('click', () => {
        const num = instrumentoPedidos.length + 1;
        instrumentoPedidos.push({
            camionNum: num,
            tipoCamion: 'SENCILLO',
            bloques: 2000,
            cargueros: 3
        });
        renderInstrumentoTable();
        updateInstrumentoDashboard();
    });

    // Cargar en simulación 3D
    document.getElementById('btn-cargar-sim3d').addEventListener('click', () => {
        // Convertir a formato de pedidos para la simulación
        const pedidos = instrumentoPedidos.map((p, i) => {
            const intervalo = 540 / (instrumentoPedidos.length + 1); // distribuir en la jornada
            let horaLlegadaMin = 360 + (i + 1) * intervalo; // 6:00 AM + offset
            // Saltar almuerzo
            if (horaLlegadaMin >= 720 && horaLlegadaMin < 780) {
                horaLlegadaMin += 60;
            }
            return {
                pedidoNum: i + 1,
                horaLlegada: horaLlegadaMin,
                tipoCamion: p.tipoCamion,
                bloques: Math.max(1000, p.bloques)
            };
        });

        if (sim) sim.loadPedidos(pedidos);

        // Cambiar a Vista 1
        document.querySelector('[data-view="vista1"]').click();
        alert('✅ Datos cargados. Presiona "Iniciar Simulación" para comenzar.');
    });
}

function renderInstrumentoTable() {
    const tbody = document.getElementById('instrumento-tbody');
    tbody.innerHTML = '';

    instrumentoPedidos.forEach((p, i) => {
        const ts = calcularTiempoPorPedido(p.bloques, p.cargueros);
        const tipo = detectarTipoCamion(p.bloques);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i + 1}</td>
            <td>
                <select class="form-select" data-idx="${i}" data-field="tipoCamion">
                    <option value="TURBO" ${p.tipoCamion === 'TURBO' ? 'selected' : ''}>Camión Turbo</option>
                    <option value="SENCILLO" ${p.tipoCamion === 'SENCILLO' ? 'selected' : ''}>Camión Sencillo</option>
                    <option value="DOBLE_TROQUE" ${p.tipoCamion === 'DOBLE_TROQUE' ? 'selected' : ''}>Doble Troque</option>
                    <option value="TRACTOMULA" ${p.tipoCamion === 'TRACTOMULA' ? 'selected' : ''}>Tractomula</option>
                </select>
            </td>
            <td><input type="number" class="form-input form-input-sm" min="1000" step="100" value="${p.bloques}" data-idx="${i}" data-field="bloques"></td>
            <td><input type="number" class="form-input form-input-sm" min="1" max="10" value="${p.cargueros}" data-idx="${i}" data-field="cargueros" style="width:60px"></td>
            <td style="font-family:var(--font-mono); font-weight:600">${ts.toFixed(1)} min</td>
            <td><button class="btn btn-danger btn-sm btn-delete" data-idx="${i}">✕</button></td>
        `;
        tbody.appendChild(row);
    });

    // Event listeners para inputs
    tbody.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            let val = e.target.value;
            if (field === 'bloques') val = Math.max(1000, parseInt(val) || 1000);
            if (field === 'cargueros') val = Math.max(1, parseInt(val) || 1);
            instrumentoPedidos[idx][field] = field === 'tipoCamion' ? val : parseInt(val);
            renderInstrumentoTable();
            updateInstrumentoDashboard();
        });
    });

    // Botones eliminar
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            instrumentoPedidos.splice(idx, 1);
            instrumentoPedidos.forEach((p, i) => p.camionNum = i + 1);
            renderInstrumentoTable();
            updateInstrumentoDashboard();
        });
    });
}

function updateInstrumentoDashboard() {
    if (instrumentoPedidos.length === 0) return;

    // Calcular T_s promedio basado en los pedidos ingresados
    // Usamos el primer carguero como referencia (o un promedio)
    const carguerosModa = instrumentoPedidos.reduce((acc, p) => {
        acc[p.cargueros] = (acc[p.cargueros] || 0) + 1;
        return acc;
    }, {});
    const carguerosPrincipal = parseInt(Object.keys(carguerosModa).sort((a, b) => carguerosModa[b] - carguerosModa[a])[0]);

    const tsProm = instrumentoPedidos.reduce((acc, p) =>
        acc + calcularTiempoPorPedido(p.bloques, p.cargueros), 0
    ) / instrumentoPedidos.length;

    const vars = calcularVariablesMM1K({
        totalLlegadas: instrumentoPedidos.length,
        horasEfectivas: 9,
        tiempoServicioMin: tsProm,
        capacidadK: Math.max(instrumentoPedidos.length, 6)
    });

    // Tarjetas
    const el = (id) => document.getElementById(id);
    el('v3-card-lambda').textContent = vars.lambda.toFixed(4);
    el('v3-card-mu').textContent = vars.mu.toFixed(4);
    el('v3-card-rho').textContent = vars.rho.toFixed(4);
    el('v3-card-pk').textContent = (vars.P_K * 100).toFixed(2) + '%';
    el('v3-card-lambdaef').textContent = vars.lambda_ef.toFixed(4);
    el('v3-card-wq').textContent = vars.W_q_min.toFixed(1) + ' min';

    // Tabla de variables
    renderVariablesTable('v3-variables-tbody', vars, carguerosPrincipal);

    // Gráfico
    drawDistributionChart('v3-chart-canvas', vars.distribucionPn);
}

// ===========================================================================
// VISTA 4: FÓRMULAS MATEMÁTICAS EN EL CÓDIGO
// ===========================================================================
function initVista4() {
    // Se renderiza estáticamente en el HTML
}

// ===========================================================================
// FUNCIONES COMPARTIDAS
// ===========================================================================

/**
 * Renderiza la tabla completa de variables M/M/1/K.
 */
function renderVariablesTable(tbodyId, vars, cargueros) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = [
        ['Jornada efectiva (H_ef)', `${vars.H_ef} horas (${vars.H_ef * 60} min)`],
        ['N.º Cargueros (m)', cargueros],
        ['Total llegadas en el día', vars.totalLlegadas],
        ['Tasa de llegada (λ)', `${vars.lambda.toFixed(4)} cam/hora`],
        ['Tiempo medio entre llegadas (1/λ)', `${vars.T_a_h.toFixed(4)} h = ${vars.T_a_min.toFixed(1)} min`],
        ['Tasa de servicio (μ)', `${vars.mu.toFixed(4)} cam/hora`],
        ['Tiempo medio de servicio (1/μ)', `${vars.T_s_h.toFixed(4)} h = ${vars.T_s_min.toFixed(2)} min`],
        ['Servidores (c)', vars.c],
        ['Capacidad del sistema (K)', vars.K],
        ['Estados posibles (n)', `{0, 1, 2, ..., ${vars.K}}`],
        ['Factor de utilización (ρ = λ/μ)', vars.rho.toFixed(4)],
        ['P(servidor vacío) → P₀', `${vars.P_0.toFixed(6)} (${(vars.P_0 * 100).toFixed(4)}%)`],
        [`P(bloqueo) → P_K = P_${vars.K}`, `${vars.P_K.toFixed(6)} (${(vars.P_K * 100).toFixed(2)}%)`],
        ['Tasa efectiva (λ_ef)', `${vars.lambda_ef.toFixed(4)} cam/hora`],
        ['Despacho diario (λ_ef × H_ef)', `${vars.despacho.toFixed(2)} ≈ ${Math.round(vars.despacho)} camiones`],
        ['Camiones prom. en sistema (L)', `${vars.L.toFixed(2)} camiones`],
        ['Camiones prom. en fila (Lq)', `${vars.L_q.toFixed(2)} camiones`],
        ['Tiempo prom. en sistema (W)', `${vars.W_h.toFixed(2)} h = ${vars.W_min.toFixed(1)} min`],
        ['Tiempo prom. en fila (Wq)', `${vars.W_q_h.toFixed(2)} h = ${vars.W_q_min.toFixed(1)} min`],
    ];
    rows.forEach(([label, value]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${label}</td><td>${value}</td>`;
        tbody.appendChild(tr);
    });
}

/**
 * Dibuja gráfico de barras horizontales de distribución P_n.
 */
function drawDistributionChart(canvasId, distribucion) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Ajustar tamaño del canvas
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(300, rect.width - 32);
    const h = Math.max(200, distribucion.length * 40 + 60);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Polyfill de roundRect para navegadores que no lo soportan
    function drawRoundedRect(ctx, x, y, width, height, radius) {
        if (ctx.roundRect) {
            ctx.roundRect(x, y, width, height, radius);
        } else {
            const r = Math.min(radius, width / 2, height / 2);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.arcTo(x + width, y, x + width, y + r, r);
            ctx.lineTo(x + width, y + height - r);
            ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
            ctx.lineTo(x + r, y + height);
            ctx.arcTo(x, y + height, x, y + height - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        }
    }

    // Limpiar
    ctx.clearRect(0, 0, w, h);

    // Configuración del gráfico
    const padLeft = 60;
    const padRight = 80;
    const padTop = 15;
    const padBottom = 35;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const barH = Math.min(28, chartH / distribucion.length - 4);
    const maxVal = Math.max(...distribucion.map(d => d.porcentaje), 1);

    // Barras
    distribucion.forEach((d, i) => {
        const y = padTop + i * (chartH / distribucion.length) + (chartH / distribucion.length - barH) / 2;
        const barW = (d.porcentaje / maxVal) * chartW;

        // Gradiente
        const grad = ctx.createLinearGradient(padLeft, 0, padLeft + Math.max(barW, 2), 0);
        if (i === distribucion.length - 1) {
            grad.addColorStop(0, '#C62828');
            grad.addColorStop(1, '#E53935');
        } else if (i === 0) {
            grad.addColorStop(0, '#2E7D32');
            grad.addColorStop(1, '#4CAF50');
        } else {
            grad.addColorStop(0, '#B71C1C');
            grad.addColorStop(1, '#E57373');
        }

        // Barra
        ctx.fillStyle = grad;
        ctx.beginPath();
        drawRoundedRect(ctx, padLeft, y, Math.max(barW, 2), barH, 3);
        ctx.fill();

        // Etiqueta izquierda (n)
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`n = ${d.n}`, padLeft - 8, y + barH / 2);

        // Valor derecho
        ctx.fillStyle = '#555';
        ctx.font = '11px Cascadia Code, Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${d.porcentaje.toFixed(2)}%`, padLeft + barW + 6, y + barH / 2);
    });

    // Título del eje X
    ctx.fillStyle = '#666';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Probabilidad P(n) en %', w / 2, h - 8);
}

// ===========================================================================
// INICIALIZACIÓN GLOBAL
// ===========================================================================
// Exponer para uso desde HTML
window.app = { startSimulation, resetSimulation };
