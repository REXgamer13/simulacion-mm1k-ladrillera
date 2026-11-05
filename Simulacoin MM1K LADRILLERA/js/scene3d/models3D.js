// ============================================================================
// models3D.js — Modelos 3D Procedurales con Three.js
// Ladrillera Los Vados S.A.S. — Simulación M/M/1/K
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================
// Crea geometrías procedurales para: 4 tipos de camiones, cargueros humanos
// con casco, estibas de bloques de ladrillo, portería, semáforo y talanquera.
// ============================================================================

import * as THREE from 'three';

// --- Materiales reutilizables ---
const MAT = {
    asfalto:     new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 }),
    concreto:    new THREE.MeshStandardMaterial({ color: 0xBDBDBD, roughness: 0.8 }),
    metal:       new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.6, roughness: 0.3 }),
    metalOscuro: new THREE.MeshStandardMaterial({ color: 0x455A64, metalness: 0.7, roughness: 0.3 }),
    llanta:      new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.95 }),
    vidrio:      new THREE.MeshStandardMaterial({ color: 0x80DEEA, transparent: true, opacity: 0.45, metalness: 0.3 }),
    ladrillo:    new THREE.MeshStandardMaterial({ color: 0xC75B39, roughness: 0.85 }),
    ladrilloOsc: new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.85 }),
    piel:        new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.7 }),
    casco:       new THREE.MeshStandardMaterial({ color: 0xFFD600, roughness: 0.5 }),
    ropa:        new THREE.MeshStandardMaterial({ color: 0x1565C0, roughness: 0.7 }),
    pantalon:    new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.7 }),
    blanco:      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 }),
    rojoLuz:     new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xFF1744, emissiveIntensity: 0 }),
    verdeLuz:    new THREE.MeshStandardMaterial({ color: 0x00E676, emissive: 0x00E676, emissiveIntensity: 0 }),
    amarilloLuz: new THREE.MeshStandardMaterial({ color: 0xFFEA00, emissive: 0xFFEA00, emissiveIntensity: 0 }),
    madera:      new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.8 }),
    cesped:      new THREE.MeshStandardMaterial({ color: 0x558B2F, roughness: 0.95 }),
    tierra:      new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.95 }),
    techo:       new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7 }),
    barrera:     new THREE.MeshStandardMaterial({ color: 0xFF6F00, roughness: 0.5 }),
    barreraRojo: new THREE.MeshStandardMaterial({ color: 0xD32F2F, roughness: 0.5 }),
};

/**
 * Crea una rueda (llanta) 3D.
 */
function crearRueda(radio = 0.35) {
    const g = new THREE.Group();
    const llanta = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 0.25, 16), MAT.llanta);
    llanta.rotation.z = Math.PI / 2;
    g.add(llanta);
    const rin = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.45, radio * 0.45, 0.26, 8), MAT.metal);
    rin.rotation.z = Math.PI / 2;
    g.add(rin);
    return g;
}

/**
 * Crea un camión 3D procedural según el tipo.
 * @param {'TURBO'|'SENCILLO'|'DOBLE_TROQUE'|'TRACTOMULA'} tipo
 * @returns {THREE.Group} Grupo del camión con propiedad userData.cargaGroup para llenar bloques.
 */
export function crearCamion(tipo) {
    const truck = new THREE.Group();
    truck.userData.tipo = tipo;

    // Dimensiones según tipo
    const dims = {
        TURBO:        { cabL: 1.8, cabW: 1.6, cabH: 1.6, platL: 2.8, platW: 1.5, platH: 0.25, wallH: 1.0, baseY: 0.45, wheelR: 0.32, color: 0x2196F3 },
        SENCILLO:     { cabL: 2.0, cabW: 1.7, cabH: 1.8, platL: 3.8, platW: 1.6, platH: 0.25, wallH: 1.1, baseY: 0.5,  wheelR: 0.38, color: 0x4CAF50 },
        DOBLE_TROQUE: { cabL: 2.2, cabW: 1.8, cabH: 1.9, platL: 5.5, platW: 1.7, platH: 0.25, wallH: 1.2, baseY: 0.55, wheelR: 0.42, color: 0xFF9800 },
        TRACTOMULA:   { cabL: 2.4, cabW: 1.9, cabH: 2.1, platL: 7.5, platW: 1.8, platH: 0.25, wallH: 1.3, baseY: 0.6,  wheelR: 0.45, color: 0x9C27B0 }
    };
    const d = dims[tipo] || dims.SENCILLO;
    const matCab = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.5, metalness: 0.2 });

    // --- Cabina ---
    const cabina = new THREE.Mesh(new THREE.BoxGeometry(d.cabL, d.cabH, d.cabW), matCab);
    cabina.position.set(d.platL / 2 + d.cabL / 2, d.baseY + d.cabH / 2, 0);
    cabina.castShadow = true;
    truck.add(cabina);

    // Parabrisas
    const vidrio = new THREE.Mesh(
        new THREE.PlaneGeometry(d.cabW * 0.8, d.cabH * 0.45),
        MAT.vidrio
    );
    vidrio.position.set(d.platL / 2 + d.cabL + 0.01, d.baseY + d.cabH * 0.7, 0);
    vidrio.rotation.y = -Math.PI / 2;
    truck.add(vidrio);

    // --- Platón (carrocería) ---
    // Piso del platón
    const piso = new THREE.Mesh(new THREE.BoxGeometry(d.platL, d.platH, d.platW), MAT.metalOscuro);
    piso.position.set(0, d.baseY, 0);
    piso.castShadow = true;
    truck.add(piso);

    // Paredes laterales
    const wallThick = 0.08;
    const wallMat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.6, metalness: 0.15 });
    // Izquierda
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(d.platL, d.wallH, wallThick), wallMat);
    wallL.position.set(0, d.baseY + d.platH / 2 + d.wallH / 2, d.platW / 2);
    wallL.castShadow = true;
    truck.add(wallL);
    // Derecha
    const wallR = wallL.clone();
    wallR.position.z = -d.platW / 2;
    truck.add(wallR);
    // Trasera
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(wallThick, d.wallH, d.platW), wallMat);
    wallBack.position.set(-d.platL / 2, d.baseY + d.platH / 2 + d.wallH / 2, 0);
    truck.add(wallBack);

    // --- Grupo de carga (aquí se agregan bloques durante la simulación) ---
    const cargaGroup = new THREE.Group();
    cargaGroup.position.set(0, d.baseY + d.platH / 2, 0);
    cargaGroup.userData.platL = d.platL;
    cargaGroup.userData.platW = d.platW;
    cargaGroup.userData.wallH = d.wallH;
    truck.add(cargaGroup);
    truck.userData.cargaGroup = cargaGroup;

    // --- Chasis ---
    const chasis = new THREE.Mesh(
        new THREE.BoxGeometry(d.platL + d.cabL + 0.3, 0.12, d.cabW * 0.5),
        MAT.metalOscuro
    );
    chasis.position.set(d.cabL / 2, d.baseY - d.platH / 2 - 0.06, 0);
    truck.add(chasis);

    // --- Ruedas ---
    const wheelPositions = [];
    // Delanteras (bajo cabina)
    const frontX = d.platL / 2 + d.cabL * 0.6;
    wheelPositions.push({ x: frontX, z: d.cabW / 2 + 0.05 });
    wheelPositions.push({ x: frontX, z: -(d.cabW / 2 + 0.05) });
    // Traseras
    const rearX = -d.platL / 2 + 0.6;
    wheelPositions.push({ x: rearX, z: d.platW / 2 + 0.05 });
    wheelPositions.push({ x: rearX, z: -(d.platW / 2 + 0.05) });
    // Doble troque y tractomula: eje extra
    if (tipo === 'DOBLE_TROQUE' || tipo === 'TRACTOMULA') {
        const rearX2 = rearX + 1.0;
        wheelPositions.push({ x: rearX2, z: d.platW / 2 + 0.05 });
        wheelPositions.push({ x: rearX2, z: -(d.platW / 2 + 0.05) });
    }
    // Tractomula: eje adicional
    if (tipo === 'TRACTOMULA') {
        const midX = 0;
        wheelPositions.push({ x: midX, z: d.platW / 2 + 0.05 });
        wheelPositions.push({ x: midX, z: -(d.platW / 2 + 0.05) });
    }

    wheelPositions.forEach(wp => {
        const w = crearRueda(d.wheelR);
        w.position.set(wp.x, d.wheelR, wp.z);
        truck.add(w);
    });

    // Centrar truck para que el frente mire hacia +X
    truck.userData.length = d.platL + d.cabL;
    truck.userData.width = d.cabW + 0.3;
    truck.userData.dims = d;

    return truck;
}

/**
 * Actualiza visualmente la carga del camión (0% a 100%).
 * @param {THREE.Group} truckGroup - El grupo del camión.
 * @param {number} porcentaje - Progreso de 0 a 1.
 */
export function actualizarCargaCamion(truckGroup, porcentaje) {
    const cg = truckGroup.userData.cargaGroup;
    if (!cg) return;
    // Limpiar carga anterior
    while (cg.children.length > 0) cg.remove(cg.children[0]);

    const p = Math.min(1, Math.max(0, porcentaje));
    if (p <= 0) return;

    const platL = cg.userData.platL * 0.9;
    const platW = cg.userData.platW * 0.85;
    const wallH = cg.userData.wallH;

    // Bloque visual de carga (crece con el porcentaje)
    const h = wallH * p;
    const carga = new THREE.Mesh(
        new THREE.BoxGeometry(platL, h, platW),
        p < 1 ? MAT.ladrillo : MAT.ladrilloOsc
    );
    carga.position.y = h / 2;
    carga.castShadow = true;
    cg.add(carga);

    // Líneas de ladrillos (textura visual)
    if (h > 0.15) {
        const lines = Math.floor(h / 0.12);
        for (let i = 1; i < lines && i < 10; i++) {
            const line = new THREE.Mesh(
                new THREE.BoxGeometry(platL + 0.01, 0.01, platW + 0.01),
                MAT.ladrilloOsc
            );
            line.position.y = i * 0.12;
            cg.add(line);
        }
    }
}

/**
 * Crea un carguero humanoide 3D con casco de seguridad.
 * @returns {THREE.Group}
 */
export function crearCarguero() {
    const g = new THREE.Group();

    // Piernas
    const piernaL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), MAT.pantalon);
    piernaL.position.set(0, 0.325, 0.12);
    piernaL.castShadow = true;
    g.add(piernaL);

    const piernaR = piernaL.clone();
    piernaR.position.z = -0.12;
    g.add(piernaR);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.45), MAT.ropa);
    torso.position.set(0, 0.925, 0);
    torso.castShadow = true;
    g.add(torso);

    // Brazos
    const brazoL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), MAT.ropa);
    brazoL.position.set(0, 0.95, 0.32);
    g.add(brazoL);
    const brazoR = brazoL.clone();
    brazoR.position.z = -0.32;
    g.add(brazoR);

    // Manos
    const manoL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), MAT.piel);
    manoL.position.set(0, 0.68, 0.32);
    g.add(manoL);
    const manoR = manoL.clone();
    manoR.position.z = -0.32;
    g.add(manoR);

    // Cabeza
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), MAT.piel);
    cabeza.position.set(0, 1.38, 0);
    g.add(cabeza);

    // Casco amarillo
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.casco);
    casco.position.set(0, 1.42, 0);
    g.add(casco);
    // Visera del casco
    const visera = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.38), MAT.casco);
    visera.position.set(0.15, 1.38, 0);
    g.add(visera);

    // Zapatos
    const zapL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), MAT.llanta);
    zapL.position.set(0.03, 0.04, 0.12);
    g.add(zapL);
    const zapR = zapL.clone();
    zapR.position.z = -0.12;
    g.add(zapR);

    g.userData.type = 'carguero';
    return g;
}

/**
 * Crea una estiba (pallet) de bloques de ladrillo para la zona de acopio.
 * @param {number} capas - Número de capas de ladrillos (1-5).
 * @returns {THREE.Group}
 */
export function crearEstibaLadrillos(capas = 4) {
    const g = new THREE.Group();

    // Pallet de madera
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.8), MAT.madera);
    base.position.y = 0.05;
    base.castShadow = true;
    g.add(base);

    // Ladrillos apilados
    const brickW = 0.28, brickH = 0.12, brickD = 0.18;
    for (let capa = 0; capa < capas; capa++) {
        const y = 0.1 + brickH / 2 + capa * brickH;
        const offset = (capa % 2) * 0.14;
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 3; row++) {
                const brick = new THREE.Mesh(
                    new THREE.BoxGeometry(brickW, brickH, brickD),
                    (col + row + capa) % 3 === 0 ? MAT.ladrilloOsc : MAT.ladrillo
                );
                brick.position.set(
                    -0.42 + col * (brickW + 0.02) + offset,
                    y,
                    -0.3 + row * (brickD + 0.02)
                );
                brick.castShadow = true;
                g.add(brick);
            }
        }
    }

    return g;
}

/**
 * Crea la portería de entrada con caseta.
 * @returns {THREE.Group}
 */
export function crearPorteria() {
    const g = new THREE.Group();

    // Caseta de portería
    const paredes = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.5), MAT.concreto);
    paredes.position.set(-3.5, 1.1, 0);
    paredes.castShadow = true;
    g.add(paredes);

    // Techo de la caseta
    const techo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 3.0), MAT.techo);
    techo.position.set(-3.5, 2.28, 0);
    techo.castShadow = true;
    g.add(techo);

    // Ventana
    const ventana = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), MAT.vidrio);
    ventana.position.set(-2.49, 1.5, 0);
    ventana.rotation.y = Math.PI / 2;
    g.add(ventana);

    // Letrero "PORTERÍA"
    // (El texto se agrega dinámicamente con CSS2DRenderer o como sprite en world3D)

    return g;
}

/**
 * Crea un semáforo con luces controlables.
 * @returns {THREE.Group} Con métodos setColor('rojo'|'verde'|'amarillo').
 */
export function crearSemaforo() {
    const g = new THREE.Group();

    // Poste
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 8), MAT.metalOscuro);
    poste.position.set(0, 1.75, 0);
    g.add(poste);

    // Caja del semáforo
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.3), MAT.metalOscuro);
    caja.position.set(0, 3.8, 0);
    g.add(caja);

    // Luces
    const luzRoja = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), MAT.rojoLuz.clone());
    luzRoja.position.set(0.21, 4.1, 0);
    g.add(luzRoja);

    const luzAmarilla = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), MAT.amarilloLuz.clone());
    luzAmarilla.position.set(0.21, 3.8, 0);
    g.add(luzAmarilla);

    const luzVerde = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), MAT.verdeLuz.clone());
    luzVerde.position.set(0.21, 3.5, 0);
    g.add(luzVerde);

    // Método para cambiar el color
    g.userData.luces = { roja: luzRoja, amarilla: luzAmarilla, verde: luzVerde };
    g.userData.setColor = function(color) {
        luzRoja.material.emissiveIntensity = color === 'rojo' ? 1.5 : 0;
        luzAmarilla.material.emissiveIntensity = color === 'amarillo' ? 1.5 : 0;
        luzVerde.material.emissiveIntensity = color === 'verde' ? 1.5 : 0;
    };
    g.userData.setColor('rojo'); // Empieza en rojo

    return g;
}

/**
 * Crea la talanquera (barrera móvil) de la portería.
 * @returns {THREE.Group} Con método setOpen(bool).
 */
export function crearTalanquera() {
    const g = new THREE.Group();

    // Poste de soporte
    const soporte = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), MAT.metalOscuro);
    soporte.position.set(0, 0.6, 0);
    g.add(soporte);

    // Brazo pivotante
    const brazo = new THREE.Group();
    brazo.position.set(0, 1.15, 0);

    const barra = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.1, 0.12), MAT.barrera);
    barra.position.set(2.25, 0, 0);
    brazo.add(barra);

    // Franjas rojas
    for (let i = 0; i < 4; i++) {
        const franja = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.13), MAT.barreraRojo);
        franja.position.set(0.8 + i * 1.0, 0, 0);
        brazo.add(franja);
    }

    g.add(brazo);
    g.userData.brazo = brazo;
    g.userData.abierta = false;
    g.userData.targetAngle = 0;

    g.userData.setOpen = function(open) {
        g.userData.abierta = open;
        g.userData.targetAngle = open ? -Math.PI / 2 : 0;
    };

    // Actualización suave de ángulo (llamar en el loop de animación)
    g.userData.updateAnimation = function(dt) {
        const current = brazo.rotation.z;
        const target = g.userData.targetAngle;
        const diff = target - current;
        if (Math.abs(diff) > 0.01) {
            brazo.rotation.z += diff * Math.min(1, dt * 3);
        } else {
            brazo.rotation.z = target;
        }
    };

    return g;
}

/**
 * Crea una demarcación de casilla para la cola FIFO.
 * @param {number} index - Número de puesto (1 a K-1).
 * @returns {THREE.Group}
 */
export function crearCasillaFila(index) {
    const g = new THREE.Group();

    // Líneas de demarcación en el suelo
    const lineGeo = new THREE.PlaneGeometry(3.0, 0.08);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 });

    // Línea izquierda
    const lL = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5.5), lineMat);
    lL.rotation.x = -Math.PI / 2;
    lL.position.set(0, 0.01, 1.5);
    g.add(lL);

    // Línea derecha
    const lR = lL.clone();
    lR.position.z = -1.5;
    g.add(lR);

    // Número del puesto
    // (Los números se pueden agregar con sprites de texto en world3D)

    g.userData.index = index;
    g.userData.ocupada = false;

    return g;
}

export { MAT };
