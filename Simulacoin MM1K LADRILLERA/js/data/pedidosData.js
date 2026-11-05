// ============================================================================
// pedidosData.js — Datos reales de los 20 pedidos (20/10/2026)
// Ladrillera Los Vados S.A.S. — Modelo M/M/1/K
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================

/**
 * Definición de los 4 tipos de camión con rangos de bloques y colores 3D.
 */
export const TIPOS_CAMION = {
    TURBO: {
        id: 'TURBO',
        nombre: 'Camión Turbo',
        bloquesMin: 1500,
        bloquesMax: 1800,
        color: 0x2196F3,       // Azul
        colorHex: '#2196F3',
        escala: { largo: 1.0, ancho: 0.9, alto: 0.9 },
        descripcion: 'Compacto (1.500–1.800 bloques)'
    },
    SENCILLO: {
        id: 'SENCILLO',
        nombre: 'Camión Sencillo',
        bloquesMin: 2000,
        bloquesMax: 2500,
        color: 0x4CAF50,       // Verde
        colorHex: '#4CAF50',
        escala: { largo: 1.3, ancho: 1.0, alto: 1.0 },
        descripcion: 'Mediano (2.000–2.500 bloques)'
    },
    DOBLE_TROQUE: {
        id: 'DOBLE_TROQUE',
        nombre: 'Doble Troque',
        bloquesMin: 3000,
        bloquesMax: 3500,
        color: 0xFF9800,       // Naranja
        colorHex: '#FF9800',
        escala: { largo: 1.8, ancho: 1.1, alto: 1.1 },
        descripcion: 'Largo doble eje (3.000–3.500 bloques)'
    },
    TRACTOMULA: {
        id: 'TRACTOMULA',
        nombre: 'Tractomula',
        bloquesMin: 5000,
        bloquesMax: 5000,
        color: 0x9C27B0,       // Morado/Rojo
        colorHex: '#9C27B0',
        escala: { largo: 2.4, ancho: 1.2, alto: 1.2 },
        descripcion: 'Articulado extralargo (5.000 bloques)'
    }
};

/**
 * Determina el tipo de camión según la cantidad de bloques solicitados.
 * @param {number} bloques - Cantidad de bloques galleta.
 * @returns {object} Tipo de camión correspondiente.
 */
export function detectarTipoCamion(bloques) {
    if (bloques <= 1800) return TIPOS_CAMION.TURBO;
    if (bloques <= 2500) return TIPOS_CAMION.SENCILLO;
    if (bloques <= 3500) return TIPOS_CAMION.DOBLE_TROQUE;
    return TIPOS_CAMION.TRACTOMULA;
}

/**
 * Los 6 camiones reales observados durante la visita empresarial (instrumento de campo).
 * Se usan como datos iniciales en la Vista 3 (Instrumento de Entrada de Datos).
 */
export const CAMIONES_INSTRUMENTO = [
    { camionNum: 1, tipoCamion: 'TURBO',        bloques: 1500, cargueros: 3, observacion: 'Visita empresarial' },
    { camionNum: 2, tipoCamion: 'SENCILLO',     bloques: 2500, cargueros: 3, observacion: 'Visita empresarial' },
    { camionNum: 3, tipoCamion: 'SENCILLO',     bloques: 2000, cargueros: 2, observacion: 'Medido con 2 cargueros → T_s = 90 min' },
    { camionNum: 4, tipoCamion: 'SENCILLO',     bloques: 2200, cargueros: 3, observacion: 'Visita empresarial' },
    { camionNum: 5, tipoCamion: 'SENCILLO',     bloques: 2500, cargueros: 3, observacion: 'Visita empresarial' },
    { camionNum: 6, tipoCamion: 'DOBLE_TROQUE', bloques: 3000, cargueros: 3, observacion: 'Visita empresarial' }
];

/**
 * Los 20 pedidos completos del día 20/10/2026.
 * Llegadas distribuidas a lo largo de la jornada laboral (6:00 a.m. - 4:00 p.m.).
 * 
 * Formato de horaLlegada: minutos desde las 00:00 (ej: 6:05 AM = 365 min)
 * Función auxiliar: horaAMin(h, m) = h * 60 + m
 */
function horaAMin(h, m) {
    return h * 60 + m;
}

export const PEDIDOS_DIA = [
    // --- Mañana: 6:00 a.m. a 12:00 p.m. ---
    { pedidoNum:  1, horaLlegada: horaAMin(6,  5), tipoCamion: 'TURBO',        bloques: 1500 },
    { pedidoNum:  2, horaLlegada: horaAMin(6, 28), tipoCamion: 'SENCILLO',     bloques: 2500 },
    { pedidoNum:  3, horaLlegada: horaAMin(6, 52), tipoCamion: 'SENCILLO',     bloques: 2000 },
    { pedidoNum:  4, horaLlegada: horaAMin(7, 15), tipoCamion: 'SENCILLO',     bloques: 2200 },
    { pedidoNum:  5, horaLlegada: horaAMin(7, 40), tipoCamion: 'SENCILLO',     bloques: 2500 },
    { pedidoNum:  6, horaLlegada: horaAMin(8,  8), tipoCamion: 'DOBLE_TROQUE', bloques: 3000 },
    { pedidoNum:  7, horaLlegada: horaAMin(8, 30), tipoCamion: 'TURBO',        bloques: 1800 },
    { pedidoNum:  8, horaLlegada: horaAMin(8, 55), tipoCamion: 'SENCILLO',     bloques: 2300 },
    { pedidoNum:  9, horaLlegada: horaAMin(9, 20), tipoCamion: 'DOBLE_TROQUE', bloques: 3200 },
    { pedidoNum: 10, horaLlegada: horaAMin(9, 45), tipoCamion: 'TRACTOMULA',   bloques: 5000 },
    { pedidoNum: 11, horaLlegada: horaAMin(10,10), tipoCamion: 'SENCILLO',     bloques: 2000 },
    { pedidoNum: 12, horaLlegada: horaAMin(10,35), tipoCamion: 'TURBO',        bloques: 1600 },
    { pedidoNum: 13, horaLlegada: horaAMin(11, 0), tipoCamion: 'DOBLE_TROQUE', bloques: 3500 },
    { pedidoNum: 14, horaLlegada: horaAMin(11,25), tipoCamion: 'SENCILLO',     bloques: 2400 },
    { pedidoNum: 15, horaLlegada: horaAMin(11,50), tipoCamion: 'SENCILLO',     bloques: 2100 },
    // --- Tarde: 1:00 p.m. a 4:00 p.m. (después de almuerzo) ---
    { pedidoNum: 16, horaLlegada: horaAMin(13,15), tipoCamion: 'TRACTOMULA',   bloques: 5000 },
    { pedidoNum: 17, horaLlegada: horaAMin(13,45), tipoCamion: 'DOBLE_TROQUE', bloques: 3000 },
    { pedidoNum: 18, horaLlegada: horaAMin(14,10), tipoCamion: 'SENCILLO',     bloques: 2200 },
    { pedidoNum: 19, horaLlegada: horaAMin(14,50), tipoCamion: 'TURBO',        bloques: 1500 },
    { pedidoNum: 20, horaLlegada: horaAMin(15,30), tipoCamion: 'SENCILLO',     bloques: 2000 }
];

/**
 * Convierte minutos absolutos desde las 00:00 a formato "HH:MM a.m./p.m."
 * @param {number} totalMin - Minutos desde medianoche.
 * @returns {string} Hora formateada.
 */
export function formatearHora(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    const periodo = h >= 12 ? 'p.m.' : 'a.m.';
    const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${h12}:${String(m).padStart(2, '0')} ${periodo}`;
}

/**
 * Convierte hora (h, m) a minutos desde medianoche.
 */
export { horaAMin };
