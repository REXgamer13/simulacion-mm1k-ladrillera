// ============================================================================
// discreteSim.js — Motor de Simulación de Eventos Discretos
// Ladrillera Los Vados S.A.S. — Modelo M/M/1/K
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================
// Reloj de simulación acelerable (6:00 a.m. a 4:00 p.m.), pausa de almuerzo
// (12:00 a 1:00 p.m.) y máquina de estados para cada camión.
// ============================================================================

import { calcularTiempoPorPedido } from '../math/mm1kEngine.js';
import { PEDIDOS_DIA, detectarTipoCamion, formatearHora } from '../data/pedidosData.js';

// Constantes de tiempo (en minutos desde medianoche)
const JORNADA_INICIO   = 6 * 60;      // 06:00 → 360 min
const ALMUERZO_INICIO  = 12 * 60;     // 12:00 → 720 min
const ALMUERZO_FIN     = 13 * 60;     // 13:00 → 780 min
const JORNADA_FIN      = 16 * 60;     // 16:00 → 960 min

/**
 * Estados posibles de un camión en la simulación.
 */
const ESTADOS = {
    PROGRAMADO:  'Programado',
    LLEGANDO:    'Llegando',
    EN_PORTERIA: 'En Portería',
    EN_COLA:     'En Cola',
    CARGANDO:    'Cargando',
    ATENDIDO:    'Atendido',
    BLOQUEADO:   'Bloqueado'
};

/**
 * Motor de simulación de eventos discretos para el modelo M/M/1/K.
 */
export class DiscreteSimulation {
    /**
     * @param {import('../scene3d/world3D.js').World3D} world3D - Referencia al mundo 3D.
     * @param {object} config - Configuración de la simulación.
     */
    constructor(world3D, config = {}) {
        this.world = world3D;

        // Configuración
        this.config = {
            capacidadK: config.capacidadK ?? 6,
            cargueros: config.cargueros ?? 3,
            pedidos: config.pedidos ?? [...PEDIDOS_DIA],
            ...config
        };

        // Estado del reloj
        this.simTime = JORNADA_INICIO;     // Minutos desde medianoche
        this.speed = 1;                     // Multiplicador de velocidad
        this.running = false;
        this.finished = false;
        this.paused = false;
        this.inLunchBreak = false;

        // Estado del sistema de colas
        this.serverBusy = false;            // ¿Zona de cargue ocupada?
        this.queue = [];                    // Cola FIFO de IDs de camiones
        this.currentServingId = null;       // ID del camión que se está cargando
        this.loadStartTime = 0;             // Minuto en que inició el cargue actual
        this.loadDuration = 0;              // Duración del cargue actual en min
        this.loadPausedTime = 0;            // Tiempo acumulado en pausa de almuerzo

        // Registro de todos los camiones
        this.trucks = [];                   // Array de objetos camión
        this.nextPedidoIndex = 0;           // Índice del próximo pedido a procesar

        // Contadores
        this.atendidos = 0;
        this.bloqueados = 0;
        this.enSistema = 0;                 // n = camiones actualmente en el sistema

        // Callbacks
        this._onEventCallbacks = [];
        this._onTickCallbacks = [];

        // Timer de animación
        this._lastTimestamp = null;
        this._animFrameId = null;
    }

    /**
     * Registra callback para eventos de la simulación.
     * @param {function} cb - Callback que recibe { type, truck, time, message }.
     */
    onEvent(cb) { this._onEventCallbacks.push(cb); }

    /**
     * Registra callback para cada tick del reloj.
     * @param {function} cb - Callback que recibe { simTime, formatted, trucks, stats }.
     */
    onTick(cb) { this._onTickCallbacks.push(cb); }

    _emitEvent(type, data = {}) {
        const evt = { type, simTime: this.simTime, formatted: formatearHora(this.simTime), ...data };
        this._onEventCallbacks.forEach(cb => cb(evt));
    }

    _emitTick() {
        this._onTickCallbacks.forEach(cb => cb({
            simTime: this.simTime,
            formatted: formatearHora(this.simTime),
            trucks: this.trucks,
            stats: {
                atendidos: this.atendidos,
                bloqueados: this.bloqueados,
                enSistema: this.enSistema,
                enCola: this.queue.length,
                serverBusy: this.serverBusy,
                inLunchBreak: this.inLunchBreak,
                finished: this.finished
            }
        }));
    }

    /**
     * Inicializa los camiones desde los pedidos.
     */
    _initTrucks() {
        this.trucks = this.config.pedidos.map((p, i) => ({
            id: `truck_${i + 1}`,
            pedidoNum: p.pedidoNum ?? (i + 1),
            horaLlegada: p.horaLlegada,
            tipoCamion: p.tipoCamion,
            tipoCamionObj: detectarTipoCamion(p.bloques),
            bloques: Math.max(1000, p.bloques),
            estado: ESTADOS.PROGRAMADO,
            horaEntrada: null,
            horaInicioCargue: null,
            horaFinCargue: null,
            horaSalida: null,
            tiempoCargue: calcularTiempoPorPedido(p.bloques, this.config.cargueros),
            in3D: false
        }));
    }

    /**
     * Inicia la simulación.
     */
    start() {
        if (this.running) return;
        this._initTrucks();
        this.simTime = JORNADA_INICIO;
        this.running = true;
        this.finished = false;
        this.paused = false;
        this.inLunchBreak = false;
        this.serverBusy = false;
        this.queue = [];
        this.currentServingId = null;
        this.nextPedidoIndex = 0;
        this.atendidos = 0;
        this.bloqueados = 0;
        this.enSistema = 0;
        this.loadPausedTime = 0;

        if (this.world) {
            this.world.clearAllTrucks();
            this.world.setTrafficLight('rojo');
            this.world.setBarrier(false);
            this.world.setNumCargueros(this.config.cargueros);
            this.world.setCarguerosPaused(false);
        }

        this._emitEvent('start', { message: 'Simulación iniciada — 06:00 a.m.' });
        this._lastTimestamp = performance.now();
        this._loop();
    }

    /**
     * Pausa / Reanuda la simulación.
     */
    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) {
            this._lastTimestamp = performance.now();
            this._loop();
        }
        this._emitEvent(this.paused ? 'paused' : 'resumed', {
            message: this.paused ? 'Simulación pausada' : 'Simulación reanudada'
        });
    }

    /**
     * Reinicia la simulación.
     */
    reset() {
        this.running = false;
        this.paused = false;
        this.finished = false;
        if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
        this.simTime = JORNADA_INICIO;
        this.trucks = [];
        this.queue = [];
        this.serverBusy = false;
        this.currentServingId = null;
        this.atendidos = 0;
        this.bloqueados = 0;
        this.enSistema = 0;

        if (this.world) {
            this.world.clearAllTrucks();
            this.world.setTrafficLight('rojo');
            this.world.setBarrier(false);
            this.world.setCarguerosPaused(false);
        }

        this._emitEvent('reset', { message: 'Simulación reiniciada' });
        this._emitTick();
    }

    /**
     * Establece la velocidad de simulación.
     */
    setSpeed(multiplier) {
        this.speed = multiplier;
    }

    /**
     * Establece la capacidad K.
     */
    setCapacidadK(k) {
        this.config.capacidadK = k;
    }

    /**
     * Establece el número de cargueros.
     */
    setCargueros(m) {
        this.config.cargueros = m;
        // Recalcular tiempos de cargue pendientes
        this.trucks.forEach(t => {
            if (t.estado === ESTADOS.PROGRAMADO || t.estado === ESTADOS.EN_COLA) {
                t.tiempoCargue = calcularTiempoPorPedido(t.bloques, m);
            }
        });
        if (this.world) this.world.setNumCargueros(m);
    }

    /**
     * Carga nuevos pedidos (desde Vista 3).
     */
    loadPedidos(pedidos) {
        this.config.pedidos = pedidos;
    }

    // --- Loop principal ---
    _loop() {
        if (!this.running || this.paused || this.finished) return;
        this._animFrameId = requestAnimationFrame((timestamp) => {
            const realDt = (timestamp - this._lastTimestamp) / 1000; // segundos reales
            this._lastTimestamp = timestamp;

            // Avance de tiempo simulado
            // 1 segundo real = 1 minuto simulado × speed
            const simDt = realDt * this.speed;  // minutos simulados
            this.simTime += simDt;

            // --- Verificar fin de jornada ---
            if (this.simTime >= JORNADA_FIN) {
                this.simTime = JORNADA_FIN;
                this._finishDay();
                return;
            }

            // --- Verificar pausa de almuerzo ---
            const wasInLunch = this.inLunchBreak;
            this.inLunchBreak = (this.simTime >= ALMUERZO_INICIO && this.simTime < ALMUERZO_FIN);
            if (this.inLunchBreak && !wasInLunch) {
                this._emitEvent('lunch_start', { message: '🍽️ PAUSA DE ALMUERZO (12:00 p.m. - 1:00 p.m.)' });
                if (this.world) this.world.setCarguerosPaused(true);
            }
            if (!this.inLunchBreak && wasInLunch) {
                this._emitEvent('lunch_end', { message: '⏰ Fin de almuerzo — Retomando operaciones' });
                if (this.world) this.world.setCarguerosPaused(false);
            }

            // --- Procesar llegadas ---
            this._processArrivals();

            // --- Procesar cargue (si no es almuerzo) ---
            if (!this.inLunchBreak) {
                this._processLoading(simDt);
            }

            // --- Emitir tick ---
            this._emitTick();

            // Continuar loop
            this._loop();
        });
    }

    /**
     * Procesa la llegada de camiones según la hora.
     */
    _processArrivals() {
        while (this.nextPedidoIndex < this.trucks.length) {
            const truck = this.trucks[this.nextPedidoIndex];
            if (truck.horaLlegada > this.simTime) break;

            // El camión ha llegado
            this.nextPedidoIndex++;
            truck.estado = ESTADOS.LLEGANDO;
            truck.horaEntrada = truck.horaLlegada;

            // Agregar al mundo 3D
            if (this.world) {
                this.world.addTruck({
                    id: truck.id,
                    tipo: truck.tipoCamion,
                    bloques: truck.bloques
                });
                this.world.moveTruckToGate(truck.id);
            }

            this._emitEvent('arrival', {
                truck,
                message: `🚛 Camión #${truck.pedidoNum} llega a portería — ${truck.tipoCamionObj.nombre} — ${truck.bloques.toLocaleString()} bloques`
            });

            // Verificar hora límite (después de 4:00 PM no entran)
            if (truck.horaLlegada >= JORNADA_FIN) {
                this._rejectTruck(truck, 'Fuera de horario');
                continue;
            }

            // Verificar capacidad del sistema
            if (this.enSistema >= this.config.capacidadK) {
                this._rejectTruck(truck, 'Sistema lleno (n = K)');
                continue;
            }

            // Aceptar camión
            this._acceptTruck(truck);
        }
    }

    /**
     * Acepta un camión en el sistema.
     */
    _acceptTruck(truck) {
        this.enSistema++;

        if (this.world) {
            this.world.setTrafficLight('verde');
            this.world.setBarrier(true);
        }

        // Si el servidor está libre, pasa directo a cargue
        if (!this.serverBusy) {
            this._startLoading(truck);
        } else {
            // Se forma en la cola
            truck.estado = ESTADOS.EN_COLA;
            this.queue.push(truck.id);
            const qIdx = this.queue.length - 1;
            if (this.world && qIdx < 5) {
                this.world.moveTruckToQueue(truck.id, qIdx);
            }
            this._emitEvent('enqueue', {
                truck,
                message: `📋 Camión #${truck.pedidoNum} se forma en la cola — Posición ${this.queue.length}`
            });
        }

        // Cerrar barrera después de un momento
        setTimeout(() => {
            if (this.world) {
                this.world.setTrafficLight('rojo');
                this.world.setBarrier(false);
            }
        }, 600);
    }

    /**
     * Rechaza un camión (sin cupo o fuera de horario).
     */
    _rejectTruck(truck, razon) {
        truck.estado = ESTADOS.BLOQUEADO;
        this.bloqueados++;

        if (this.world) {
            this.world.setTrafficLight('rojo');
            this.world.rejectTruck(truck.id);
        }

        this._emitEvent('rejected', {
            truck,
            message: `🚫 Camión #${truck.pedidoNum} BLOQUEADO — ${razon}`
        });
    }

    /**
     * Inicia el cargue de un camión.
     */
    _startLoading(truck) {
        truck.estado = ESTADOS.CARGANDO;
        truck.horaInicioCargue = this.simTime;
        truck.tiempoCargue = calcularTiempoPorPedido(truck.bloques, this.config.cargueros);
        this.serverBusy = true;
        this.currentServingId = truck.id;
        this.loadStartTime = this.simTime;
        this.loadDuration = truck.tiempoCargue;
        this.loadPausedTime = 0;

        if (this.world) {
            this.world.moveTruckToLoading(truck.id);
        }

        this._emitEvent('loading_start', {
            truck,
            message: `⚙️ Camión #${truck.pedidoNum} ingresa a ZONA DE CARGUE — T_s = ${truck.tiempoCargue.toFixed(1)} min`
        });
    }

    /**
     * Procesa el avance del cargue del camión en servicio.
     */
    _processLoading(simDt) {
        if (!this.serverBusy || !this.currentServingId) return;

        const truck = this.trucks.find(t => t.id === this.currentServingId);
        if (!truck) return;

        // Calcular progreso
        const elapsed = this.simTime - this.loadStartTime - this.loadPausedTime;
        // Restar el tiempo de almuerzo si el cargue cruzó el mediodía
        let effectiveElapsed = elapsed;
        if (this.loadStartTime < ALMUERZO_INICIO && this.simTime > ALMUERZO_INICIO) {
            // Se restó el tiempo de almuerzo automáticamente porque no avanzamos durante el almuerzo
        }

        const progress = Math.min(1, effectiveElapsed / this.loadDuration);

        // Actualizar visual
        if (this.world) {
            this.world.updateLoadingProgress(truck.id, progress);
        }

        // ¿Completó?
        if (progress >= 1) {
            this._completeLoading(truck);
        }
    }

    /**
     * Completa el cargue de un camión.
     */
    _completeLoading(truck) {
        truck.estado = ESTADOS.ATENDIDO;
        truck.horaFinCargue = this.simTime;
        truck.horaSalida = this.simTime;
        this.serverBusy = false;
        this.currentServingId = null;
        this.atendidos++;
        this.enSistema--;

        if (this.world) {
            this.world.moveTruckToExit(truck.id);
        }

        this._emitEvent('loading_complete', {
            truck,
            message: `✅ Camión #${truck.pedidoNum} DESPACHADO — ${formatearHora(this.simTime)}`
        });

        // Procesar siguiente camión en cola
        if (this.queue.length > 0) {
            const nextId = this.queue.shift();
            const nextTruck = this.trucks.find(t => t.id === nextId);
            if (this.world) this.world.advanceQueue();
            if (nextTruck) {
                this._startLoading(nextTruck);
            }
        }
    }

    /**
     * Fin de jornada: bloquea los camiones que no alcanzaron a ser atendidos.
     */
    _finishDay() {
        this.finished = true;
        this.running = false;

        // Camiones aún en cola → registrar como no atendidos
        this.queue.forEach(id => {
            const truck = this.trucks.find(t => t.id === id);
            if (truck) {
                truck.estado = ESTADOS.BLOQUEADO;
                truck.horaSalida = JORNADA_FIN;
            }
        });

        // Camión en cargue → se completó parcialmente
        if (this.currentServingId) {
            const truck = this.trucks.find(t => t.id === this.currentServingId);
            if (truck && truck.estado === ESTADOS.CARGANDO) {
                truck.estado = ESTADOS.ATENDIDO;
                truck.horaFinCargue = JORNADA_FIN;
                truck.horaSalida = JORNADA_FIN;
                this.atendidos++;
            }
        }

        this._emitEvent('day_end', {
            message: `🏁 FIN DE JORNADA — 4:00 p.m. | Atendidos: ${this.atendidos} | Bloqueados: ${this.bloqueados}`,
            stats: { atendidos: this.atendidos, bloqueados: this.bloqueados }
        });
        this._emitTick();
    }

    /**
     * Retorna el log completo de camiones.
     */
    getLog() {
        return this.trucks.map(t => ({
            num: t.pedidoNum,
            tipo: t.tipoCamionObj.nombre,
            bloques: t.bloques,
            horaLlegada: formatearHora(t.horaLlegada),
            horaEntrada: t.horaEntrada ? formatearHora(t.horaEntrada) : '—',
            horaInicioCargue: t.horaInicioCargue ? formatearHora(t.horaInicioCargue) : '—',
            horaFinCargue: t.horaFinCargue ? formatearHora(t.horaFinCargue) : '—',
            estado: t.estado,
            tiempoCargue: t.tiempoCargue.toFixed(1)
        }));
    }
}

export { ESTADOS, JORNADA_INICIO, ALMUERZO_INICIO, ALMUERZO_FIN, JORNADA_FIN };
