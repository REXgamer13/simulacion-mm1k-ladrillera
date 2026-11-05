// ============================================================================
// mm1kEngine.js — Motor Matemático Puro del Modelo M/M/1/K
// Ladrillera Los Vados S.A.S.
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================
// Este módulo contiene ÚNICAMENTE las funciones matemáticas del modelo de colas
// M/M/1/K y la ecuación de tiempo de servicio T_s(Q_i, m) obtenida en campo.
// No tiene dependencias externas ni de DOM.
// ============================================================================

/**
 * Calcula el tiempo de cargue (servicio) para un pedido individual.
 * 
 * Ecuación base medida con m = 3 cargueros en campo:
 *   T_s(Q_i) = 0.04 * Q_i - 10   (en minutos)
 * 
 * Escalamiento por número de cargueros (m):
 *   T_s(Q_i, m) = (3 / m) * (0.04 * Q_i - 10)   (en minutos)
 * 
 * Ejemplo: m = 5 cargueros → T_s = (3/5) * (0.04 * Q_i - 10) = 0.024 * Q_i - 6
 * 
 * VALIDACIÓN ESTRICTA: Q_i mínimo = 1000 bloques para evitar tiempos negativos.
 * 
 * @param {number} bloques - Cantidad de bloques galleta solicitados (Q_i).
 * @param {number} cargueros - Número de cargueros en la cuadrilla (m).
 * @returns {number} Tiempo de cargue en minutos.
 */
export function calcularTiempoPorPedido(bloques, cargueros) {
    // Validación estricta: mínimo 1000 bloques
    const Q = Math.max(1000, bloques);
    // Validación: mínimo 1 carguero
    const m = Math.max(1, cargueros);
    // Ecuación base con 3 cargueros, escalada por m
    const Ts = (3 / m) * (0.04 * Q - 10);
    return Math.max(0, Ts); // Nunca negativo
}

/**
 * Calcula el tiempo promedio de servicio T_s para un conjunto de pedidos.
 * 
 * @param {Array<{bloques: number}>} pedidos - Lista de pedidos con campo 'bloques'.
 * @param {number} cargueros - Número de cargueros (m).
 * @returns {number} Tiempo promedio de servicio en minutos.
 */
export function calcularTsPromedio(pedidos, cargueros) {
    if (!pedidos || pedidos.length === 0) return 0;
    const suma = pedidos.reduce((acc, p) => {
        return acc + calcularTiempoPorPedido(p.bloques, cargueros);
    }, 0);
    return suma / pedidos.length;
}

/**
 * Calcula TODAS las variables de estado estable del modelo M/M/1/K.
 * 
 * Parámetros de entrada:
 * @param {object} params
 * @param {number} params.totalLlegadas  - Total de camiones que llegan en el día.
 * @param {number} params.horasEfectivas - Jornada laboral efectiva en horas (H_ef).
 * @param {number} params.tiempoServicioMin - Tiempo medio de servicio en minutos (T_s).
 * @param {number} params.capacidadK     - Capacidad máxima del sistema (K).
 * 
 * @returns {object} Objeto con todas las variables calculadas del modelo M/M/1/K.
 */
export function calcularVariablesMM1K({ totalLlegadas, horasEfectivas, tiempoServicioMin, capacidadK }) {
    // --- Parámetros de entrada ---
    const H_ef = horasEfectivas;                    // Jornada efectiva (horas)
    const K = capacidadK;                            // Capacidad máxima del sistema
    const c = 1;                                     // Número de servidores (siempre 1)
    const T_s_min = tiempoServicioMin;               // Tiempo medio de servicio (minutos)
    const T_s_h = T_s_min / 60;                      // Tiempo medio de servicio (horas)

    // --- 1. Tasa media de llegada λ ---
    const lambda = totalLlegadas / H_ef;             // camiones/hora

    // --- 2. Tiempo medio entre llegadas ---
    const T_a_h = 1 / lambda;                        // horas
    const T_a_min = T_a_h * 60;                      // minutos

    // --- 3. Tasa media de servicio μ ---
    const mu = 60 / T_s_min;                         // camiones/hora

    // --- 7. Factor de utilización / congestión ρ ---
    const rho = lambda / mu;                         // ρ = λ / μ

    // --- 8. Probabilidad de servidor vacío P_0 ---
    let P_0;
    if (Math.abs(rho - 1) < 1e-10) {
        // Caso especial: ρ = 1
        P_0 = 1 / (K + 1);
    } else {
        // Caso general: P_0 = (1 - ρ) / (1 - ρ^(K+1))
        P_0 = (1 - rho) / (1 - Math.pow(rho, K + 1));
    }

    // --- 9. Distribución de probabilidad P_n ---
    const distribucionPn = [];
    for (let n = 0; n <= K; n++) {
        let P_n;
        if (Math.abs(rho - 1) < 1e-10) {
            P_n = 1 / (K + 1);
        } else {
            P_n = P_0 * Math.pow(rho, n);
        }
        distribucionPn.push({
            n: n,
            P_n: P_n,
            porcentaje: P_n * 100
        });
    }

    // --- 10. Probabilidad de pérdida / bloqueo P_K ---
    const P_K = distribucionPn[K].P_n;               // P_K = P_0 * ρ^K

    // --- 11. Tasa efectiva de atención λ_ef ---
    const lambda_ef = lambda * (1 - P_K);            // camiones/hora

    // --- 12. Camiones atendidos en la jornada (Despacho) ---
    const despacho = lambda_ef * H_ef;

    // --- 13. Camiones promedio en el sistema L ---
    let L;
    if (Math.abs(rho - 1) < 1e-10) {
        L = K / 2;
    } else {
        L = (rho / (1 - rho)) - ((K + 1) * Math.pow(rho, K + 1)) / (1 - Math.pow(rho, K + 1));
    }

    // --- 14. Camiones promedio en la fila L_q ---
    const L_q = L - (1 - P_0);

    // --- 15. Tiempo promedio en el sistema W ---
    const W_h = lambda_ef > 0 ? L / lambda_ef : 0;  // horas
    const W_min = W_h * 60;                          // minutos

    // --- 16. Tiempo promedio de espera en la fila W_q ---
    const W_q_h = lambda_ef > 0 ? L_q / lambda_ef : 0; // horas
    const W_q_min = W_q_h * 60;                      // minutos

    return {
        // Parámetros de entrada
        totalLlegadas,
        H_ef,
        T_s_min,
        T_s_h,
        c,
        K,

        // Variables calculadas
        lambda,           // Tasa de llegada (cam/h)
        T_a_h,            // Tiempo medio entre llegadas (h)
        T_a_min,          // Tiempo medio entre llegadas (min)
        mu,               // Tasa de servicio (cam/h)
        rho,              // Factor de utilización ρ
        P_0,              // Probabilidad de servidor vacío
        distribucionPn,   // Array de {n, P_n, porcentaje}
        P_K,              // Probabilidad de pérdida/bloqueo
        lambda_ef,        // Tasa efectiva (cam/h)
        despacho,         // Camiones despachados en el día
        L,                // Camiones promedio en sistema
        L_q,              // Camiones promedio en fila
        W_h,              // Tiempo promedio en sistema (h)
        W_min,            // Tiempo promedio en sistema (min)
        W_q_h,            // Tiempo promedio en fila (h)
        W_q_min           // Tiempo promedio en fila (min)
    };
}

/**
 * Configuración por defecto del Sistema Actual (3 cargueros).
 */
export const CONFIG_SISTEMA_ACTUAL = {
    cargueros: 3,
    tiempoServicioMin: 84.67,    // 508 min / 6 camiones
    totalLlegadas: 20,
    horasEfectivas: 9,
    capacidadK: 6
};

/**
 * Configuración propuesta con 5 cargueros.
 */
export const CONFIG_5_CARGUEROS = {
    cargueros: 5,
    tiempoServicioMin: 45.82,    // Con 5 cargueros: promedio más bajo
    totalLlegadas: 20,
    horasEfectivas: 9,
    capacidadK: 6
};
