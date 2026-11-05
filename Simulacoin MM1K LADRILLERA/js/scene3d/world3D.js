// ============================================================================
// world3D.js — Escena Three.js: Mundo 3D de Ladrillera Los Vados S.A.S.
// Simulación M/M/1/K
// Autor: Juan Sebastian Gelvez Botia — UDES Cúcuta
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    crearCamion, crearCarguero, crearEstibaLadrillos,
    crearPorteria, crearSemaforo, crearTalanquera,
    crearCasillaFila, actualizarCargaCamion, MAT
} from './models3D.js';

// --- Constantes de layout ---
const LAYOUT = {
    // Vía de acceso: camiones llegan desde -Z
    entryRoadStart: -65,
    entryRoadEnd: -15,
    // Portería en Z = -15
    gateZ: -15,
    // Patio de espera (cola FIFO): Z = -5 a Z = 25 (5 puestos separados 6 unidades)
    queueStartZ: -5,
    queueSpacing: 7,
    // Zona de cargue: Z = 38
    loadingZ: 38,
    // Zona de acopio: X = -12, Z = 38
    acopioX: -12,
    acopioZ: 38,
    // Vía de salida: Z = 48 en adelante
    exitStartZ: 50,
    exitEndZ: 80,
    // Vía de desvío/rechazo: sale hacia X positivo desde portería
    rejectX: 30,
    rejectZ: -18,
    // Ancho de carril
    roadW: 5.5,
};

/**
 * Clase principal del mundo 3D.
 */
export class World3D {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.renderer = null;
        this.cameraPerspective = null;
        this.cameraOrtho = null;
        this.cameraLoading = null;
        this.activeCamera = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        this.animating = false;
        this.frameId = null;

        // Objetos de la escena
        this.semaforo = null;
        this.talanquera = null;
        this.queueSlots = [];   // Posiciones 3D de los puestos de cola
        this.cargueros3D = [];  // Modelos 3D de cargueros
        this.acopioEstibas = [];

        // Estado
        this.trucksInScene = [];  // { id, mesh, state, targetPos }
        this.numCargueros = 3;
    }

    /**
     * Inicializa toda la escena 3D.
     */
    init() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 80, 200);

        // Cámaras
        this._setupCameras(w, h);

        // Iluminación
        this._setupLights();

        // Terreno y ambiente
        this._buildTerrain();

        // Vías
        this._buildRoads();

        // Portería, semáforo, talanquera
        this._buildGate();

        // Patio de espera (cola FIFO)
        this._buildQueueArea();

        // Zona de cargue
        this._buildLoadingZone();

        // Zona de acopio de ladrillos
        this._buildAcopio();

        // Cargueros iniciales
        this._spawnCargueros(this.numCargueros);

        // Controles de órbita
        this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 120;
        this.controls.target.set(0, 0, LAYOUT.loadingZ / 2);

        // Resize
        this._onResize = () => {
            const w2 = this.container.clientWidth;
            const h2 = this.container.clientHeight;
            this.renderer.setSize(w2, h2);
            this.cameraPerspective.aspect = w2 / h2;
            this.cameraPerspective.updateProjectionMatrix();
            const aspect = w2 / h2;
            const frustum = 40;
            this.cameraOrtho.left = -frustum * aspect;
            this.cameraOrtho.right = frustum * aspect;
            this.cameraOrtho.top = frustum;
            this.cameraOrtho.bottom = -frustum;
            this.cameraOrtho.updateProjectionMatrix();
            this.cameraLoading.aspect = w2 / h2;
            this.cameraLoading.updateProjectionMatrix();
        };
        window.addEventListener('resize', this._onResize);

        // Iniciar animación
        this.animating = true;
        this._animate();
    }

    // --- Cámaras ---
    _setupCameras(w, h) {
        // Perspectiva 3D
        this.cameraPerspective = new THREE.PerspectiveCamera(50, w / h, 0.5, 300);
        this.cameraPerspective.position.set(35, 30, 5);

        // Ortográfica superior
        const aspect = w / h;
        const frustum = 40;
        this.cameraOrtho = new THREE.OrthographicCamera(
            -frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200
        );
        this.cameraOrtho.position.set(0, 80, LAYOUT.loadingZ / 2);
        this.cameraOrtho.lookAt(0, 0, LAYOUT.loadingZ / 2);

        // Enfoque a zona de cargue
        this.cameraLoading = new THREE.PerspectiveCamera(45, w / h, 0.5, 150);
        this.cameraLoading.position.set(10, 8, LAYOUT.loadingZ + 12);

        this.activeCamera = this.cameraPerspective;
    }

    /**
     * Cambia la cámara activa.
     * @param {'perspectiva'|'ortografica'|'cargue'} tipo
     */
    switchCamera(tipo) {
        if (tipo === 'perspectiva') {
            this.activeCamera = this.cameraPerspective;
            this.controls.object = this.cameraPerspective;
        } else if (tipo === 'ortografica') {
            this.activeCamera = this.cameraOrtho;
            this.controls.object = this.cameraOrtho;
        } else if (tipo === 'cargue') {
            this.activeCamera = this.cameraLoading;
            this.controls.object = this.cameraLoading;
            this.controls.target.set(0, 2, LAYOUT.loadingZ);
        }
        this.controls.update();
    }

    // --- Iluminación ---
    _setupLights() {
        // Ambiente
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        // Hemisférica
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8D6E63, 0.4);
        this.scene.add(hemi);

        // Sol (direccional con sombras)
        const sun = new THREE.DirectionalLight(0xFFF8E1, 1.2);
        sun.position.set(30, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -40;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 120;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
    }

    // --- Terreno ---
    _buildTerrain() {
        // Piso de césped
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            MAT.cesped
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Textura sutil al suelo (grid)
        const gridHelper = new THREE.GridHelper(200, 80, 0x4E7A34, 0x4E7A34);
        gridHelper.material.opacity = 0.08;
        gridHelper.material.transparent = true;
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    // --- Vías ---
    _buildRoads() {
        // Vía de acceso principal (dirección Z, del sur a la portería)
        this._createRoadSegment(0, LAYOUT.entryRoadStart, 0, LAYOUT.gateZ, LAYOUT.roadW);

        // Vía interna: portería → cola → zona de cargue
        this._createRoadSegment(0, LAYOUT.gateZ, 0, LAYOUT.exitStartZ, LAYOUT.roadW);

        // Vía de salida
        this._createRoadSegment(0, LAYOUT.exitStartZ, 0, LAYOUT.exitEndZ, LAYOUT.roadW);

        // Vía de desvío/rechazo (curva hacia la derecha desde portería)
        this._createRoadSegment(0, LAYOUT.gateZ - 3, LAYOUT.rejectX, LAYOUT.rejectZ - 8, LAYOUT.roadW * 0.85);

        // Línea central amarilla en la vía principal
        const lineGeo = new THREE.PlaneGeometry(0.12, LAYOUT.exitEndZ - LAYOUT.entryRoadStart);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xFDD835, roughness: 0.5 });
        const centerLine = new THREE.Mesh(lineGeo, lineMat);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.set(0, 0.025, (LAYOUT.entryRoadStart + LAYOUT.exitEndZ) / 2);
        this.scene.add(centerLine);

        // Flecha de entrada
        this._createArrow(0, LAYOUT.entryRoadStart + 8, 0x4CAF50, Math.PI);
        // Flecha de salida
        this._createArrow(0, LAYOUT.exitEndZ - 5, 0x4CAF50, Math.PI);
        // Flecha de rechazo
        this._createArrow(LAYOUT.rejectX - 3, LAYOUT.rejectZ - 6, 0xE53935, -Math.PI / 4);

        // Letrero de entrada
        this._createSign('ENTRADA', -3.5, LAYOUT.entryRoadStart + 5, 0x2E7D32);
        // Letrero de salida
        this._createSign('SALIDA', -3.5, LAYOUT.exitEndZ - 8, 0x1565C0);
        // Letrero de rechazo
        this._createSign('DESVÍO', LAYOUT.rejectX - 8, LAYOUT.rejectZ - 5, 0xC62828);
    }

    _createRoadSegment(x1, z1, x2, z2, width) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(width, length),
            MAT.asfalto
        );
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = -angle;
        road.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
        road.receiveShadow = true;
        this.scene.add(road);

        // Bordes blancos
        const edgeMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.5 });
        [-1, 1].forEach(side => {
            const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.15, length), edgeMat);
            edge.rotation.x = -Math.PI / 2;
            edge.rotation.z = -angle;
            const perpX = -Math.sin(angle + Math.PI / 2) * (width / 2) * side;
            const perpZ = -Math.cos(angle + Math.PI / 2) * (width / 2) * side;
            edge.position.set((x1 + x2) / 2 + perpX, 0.02, (z1 + z2) / 2 + perpZ);
            this.scene.add(edge);
        });
    }

    _createArrow(x, z, color, rot) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.6);
        shape.lineTo(-0.4, 0);
        shape.lineTo(-0.15, 0);
        shape.lineTo(-0.15, -0.6);
        shape.lineTo(0.15, -0.6);
        shape.lineTo(0.15, 0);
        shape.lineTo(0.4, 0);
        shape.closePath();
        const arrowGeo = new THREE.ShapeGeometry(shape);
        const arrowMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.rotation.x = -Math.PI / 2;
        arrow.rotation.z = rot;
        arrow.position.set(x, 0.03, z);
        this.scene.add(arrow);
    }

    _createSign(text, x, z, color) {
        // Poste
        const poste = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6),
            MAT.metalOscuro
        );
        poste.position.set(x, 1.25, z);
        this.scene.add(poste);

        // Placa
        const placa = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.6, 0.06),
            new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
        );
        placa.position.set(x, 2.6, z);
        this.scene.add(placa);

        // Texto con canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 38px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const label = new THREE.Mesh(
            new THREE.PlaneGeometry(1.8, 0.45),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        label.position.set(x, 2.6, z + 0.04);
        this.scene.add(label);
    }

    // --- Portería ---
    _buildGate() {
        const porteria = crearPorteria();
        porteria.position.set(0, 0, LAYOUT.gateZ);
        this.scene.add(porteria);

        this.semaforo = crearSemaforo();
        this.semaforo.position.set(3.5, 0, LAYOUT.gateZ);
        this.scene.add(this.semaforo);

        this.talanquera = crearTalanquera();
        this.talanquera.position.set(-1.0, 0, LAYOUT.gateZ);
        this.talanquera.rotation.y = Math.PI / 2;
        this.scene.add(this.talanquera);

        // Letrero PORTERÍA
        this._createSign('PORTERÍA', -3.5, LAYOUT.gateZ + 2.5, 0xB71C1C);
    }

    // --- Patio de espera (Cola FIFO) ---
    _buildQueueArea() {
        this.queueSlots = [];
        for (let i = 0; i < 5; i++) {
            const z = LAYOUT.queueStartZ + i * LAYOUT.queueSpacing;
            const slot = crearCasillaFila(i + 1);
            slot.position.set(0, 0, z);
            this.scene.add(slot);
            this.queueSlots.push({ position: new THREE.Vector3(0, 0, z), occupied: false, index: i });
        }

        // Letrero de la cola
        this._createSign('COLA FIFO', -4, LAYOUT.queueStartZ + 10, 0xF57F17);
    }

    // --- Zona de cargue ---
    _buildLoadingZone() {
        // Plataforma de cargue elevada
        const plataforma = new THREE.Mesh(
            new THREE.BoxGeometry(8, 0.15, 8),
            MAT.concreto
        );
        plataforma.position.set(0, 0.075, LAYOUT.loadingZ);
        plataforma.receiveShadow = true;
        this.scene.add(plataforma);

        // Demarcación
        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 0.01, 8)),
            new THREE.LineBasicMaterial({ color: 0xFFD600, linewidth: 2 })
        );
        edges.position.set(0, 0.16, LAYOUT.loadingZ);
        this.scene.add(edges);

        // Letrero
        this._createSign('ZONA DE CARGUE', 0, LAYOUT.loadingZ + 5, 0xFF6F00);

        // Techo / cobertizo
        const techoG = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.12, 10),
            new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7, transparent: true, opacity: 0.6 })
        );
        techoG.position.set(0, 5.5, LAYOUT.loadingZ);
        this.scene.add(techoG);

        // Pilares del cobertizo
        const pilarGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8);
        [[-4.5, -4.5], [-4.5, 4.5], [4.5, -4.5], [4.5, 4.5]].forEach(([px, pz]) => {
            const pilar = new THREE.Mesh(pilarGeo, MAT.metal);
            pilar.position.set(px, 2.75, LAYOUT.loadingZ + pz);
            this.scene.add(pilar);
        });
    }

    // --- Zona de Acopio ---
    _buildAcopio() {
        // Plataforma de acopio
        const acopio = new THREE.Mesh(
            new THREE.BoxGeometry(12, 0.1, 10),
            MAT.tierra
        );
        acopio.position.set(LAYOUT.acopioX, 0.05, LAYOUT.acopioZ);
        acopio.receiveShadow = true;
        this.scene.add(acopio);

        // Estibas de ladrillos (varias filas)
        this.acopioEstibas = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                const estiba = crearEstibaLadrillos(3 + Math.floor(Math.random() * 3));
                estiba.position.set(
                    LAYOUT.acopioX - 4 + col * 2.8,
                    0.1,
                    LAYOUT.acopioZ - 3 + row * 3.0
                );
                this.scene.add(estiba);
                this.acopioEstibas.push(estiba);
            }
        }

        // Letrero
        this._createSign('ACOPIO LADRILLOS', LAYOUT.acopioX, LAYOUT.acopioZ + 6, 0xC75B39);
    }

    // --- Cargueros ---
    _spawnCargueros(count) {
        // Remover anteriores
        this.cargueros3D.forEach(c => this.scene.remove(c));
        this.cargueros3D = [];

        for (let i = 0; i < count; i++) {
            const carguero = crearCarguero();
            // Posición inicial: al lado de la zona de acopio
            const angle = (i / count) * Math.PI * 0.6 - Math.PI * 0.3;
            carguero.position.set(
                LAYOUT.acopioX + 5 + Math.cos(angle) * 2,
                0,
                LAYOUT.acopioZ + Math.sin(angle) * 2
            );
            carguero.userData.basePos = carguero.position.clone();
            carguero.userData.index = i;
            carguero.userData.animPhase = Math.random() * Math.PI * 2;
            this.scene.add(carguero);
            this.cargueros3D.push(carguero);
        }
    }

    /**
     * Actualiza el número de cargueros.
     */
    setNumCargueros(count) {
        this.numCargueros = count;
        this._spawnCargueros(count);
    }

    // --- Semáforo y Talanquera ---
    setTrafficLight(color) {
        if (this.semaforo) this.semaforo.userData.setColor(color);
    }

    setBarrier(open) {
        if (this.talanquera) this.talanquera.userData.setOpen(open);
    }

    // --- Gestión de camiones en la escena ---

    /**
     * Agrega un camión a la escena.
     * @param {object} truckData - { id, tipo, bloques, ... }
     * @returns {object} Referencia al camión en escena.
     */
    addTruck(truckData) {
        const mesh = crearCamion(truckData.tipo);
        mesh.rotation.y = Math.PI; // Mirando hacia +Z (frente de camión)
        mesh.position.set(0, 0, LAYOUT.entryRoadStart);
        mesh.userData.truckId = truckData.id;
        this.scene.add(mesh);
        const entry = {
            id: truckData.id,
            mesh: mesh,
            state: 'arriving',      // arriving | at_gate | in_queue | loading | exiting | rejected
            targetPos: new THREE.Vector3(0, 0, LAYOUT.gateZ - 5),
            bloques: truckData.bloques,
            queueIndex: -1,
            loadProgress: 0
        };
        this.trucksInScene.push(entry);
        return entry;
    }

    /**
     * Mueve un camión a la portería.
     */
    moveTruckToGate(truckId) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t) {
            t.state = 'at_gate';
            t.targetPos = new THREE.Vector3(0, 0, LAYOUT.gateZ - 3);
        }
    }

    /**
     * Mueve un camión a un puesto de la cola.
     */
    moveTruckToQueue(truckId, queueIndex) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t && this.queueSlots[queueIndex]) {
            t.state = 'in_queue';
            t.queueIndex = queueIndex;
            t.targetPos = this.queueSlots[queueIndex].position.clone();
            t.targetPos.y = 0;
        }
    }

    /**
     * Mueve un camión a la zona de cargue.
     */
    moveTruckToLoading(truckId) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t) {
            t.state = 'loading';
            t.targetPos = new THREE.Vector3(0, 0, LAYOUT.loadingZ);
            t.loadProgress = 0;
        }
    }

    /**
     * Actualiza el progreso de carga de un camión.
     */
    updateLoadingProgress(truckId, progress) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t) {
            t.loadProgress = progress;
            actualizarCargaCamion(t.mesh, progress);
        }
    }

    /**
     * Mueve un camión a la salida.
     */
    moveTruckToExit(truckId) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t) {
            t.state = 'exiting';
            t.targetPos = new THREE.Vector3(0, 0, LAYOUT.exitEndZ + 10);
        }
    }

    /**
     * Rechaza un camión (desvío).
     */
    rejectTruck(truckId) {
        const t = this.trucksInScene.find(t => t.id === truckId);
        if (t) {
            t.state = 'rejected';
            t.targetPos = new THREE.Vector3(LAYOUT.rejectX + 10, 0, LAYOUT.rejectZ - 15);
        }
    }

    /**
     * Remueve un camión de la escena.
     */
    removeTruck(truckId) {
        const idx = this.trucksInScene.findIndex(t => t.id === truckId);
        if (idx !== -1) {
            const t = this.trucksInScene[idx];
            this.scene.remove(t.mesh);
            // Dispose geometries/materials
            t.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
            this.trucksInScene.splice(idx, 1);
        }
    }

    /**
     * Avanza todos los camiones en cola una posición hacia arriba.
     */
    advanceQueue() {
        const inQueue = this.trucksInScene
            .filter(t => t.state === 'in_queue')
            .sort((a, b) => a.queueIndex - b.queueIndex);

        inQueue.forEach((t) => {
            if (t.queueIndex > 0) {
                t.queueIndex--;
                t.targetPos = this.queueSlots[t.queueIndex].position.clone();
                t.targetPos.y = 0;
            }
        });
    }

    /**
     * Pausa visual de cargueros (almuerzo).
     */
    setCarguerosPaused(paused) {
        this.cargueros3D.forEach(c => {
            c.userData.paused = paused;
        });
    }

    /**
     * Limpia todos los camiones de la escena.
     */
    clearAllTrucks() {
        [...this.trucksInScene].forEach(t => this.removeTruck(t.id));
    }

    // --- Loop de animación ---
    _animate() {
        if (!this.animating) return;
        this.frameId = requestAnimationFrame(() => this._animate());

        const dt = this.clock.getDelta();

        // Actualizar movimiento de camiones
        this.trucksInScene.forEach(t => {
            if (t.targetPos) {
                const dir = new THREE.Vector3().subVectors(t.targetPos, t.mesh.position);
                const dist = dir.length();
                if (dist > 0.15) {
                    dir.normalize();
                    const speed = t.state === 'rejected' ? 12 : 8;
                    t.mesh.position.add(dir.multiplyScalar(Math.min(speed * dt, dist)));

                    // Rotar camión hacia dirección de movimiento
                    if (t.state === 'rejected') {
                        const angle = Math.atan2(dir.x, dir.z);
                        t.mesh.rotation.y = angle + Math.PI;
                    }
                }
            }
        });

        // Remover camiones que salieron de escena
        this.trucksInScene.forEach(t => {
            if ((t.state === 'exiting' && t.mesh.position.z > LAYOUT.exitEndZ + 5) ||
                (t.state === 'rejected' && t.mesh.position.x > LAYOUT.rejectX + 5)) {
                this.removeTruck(t.id);
            }
        });

        // Animar cargueros (ida y vuelta entre acopio y zona de cargue)
        const loadingTruck = this.trucksInScene.find(t => t.state === 'loading');
        this.cargueros3D.forEach((c, i) => {
            if (c.userData.paused) return;
            if (loadingTruck) {
                c.userData.animPhase += dt * 1.5;
                const phase = c.userData.animPhase;
                const t = (Math.sin(phase + i * 1.2) + 1) / 2; // 0 a 1
                // Interpolar entre acopio y zona de cargue
                const startX = LAYOUT.acopioX + 4;
                const endX = 2.5;
                const spreadZ = (i - (this.numCargueros - 1) / 2) * 1.2;
                c.position.x = startX + (endX - startX) * t;
                c.position.z = LAYOUT.loadingZ + spreadZ;
                // Animación de caminar (rebote vertical)
                c.position.y = Math.abs(Math.sin(phase * 3 + i)) * 0.08;
            } else {
                // En reposo
                const bp = c.userData.basePos;
                c.position.lerp(bp, dt * 2);
            }
        });

        // Animar talanquera
        if (this.talanquera) this.talanquera.userData.updateAnimation(dt);

        // Actualizar controles
        this.controls.update();

        // Render
        this.renderer.render(this.scene, this.activeCamera);
    }

    /**
     * Libera todos los recursos.
     */
    dispose() {
        this.animating = false;
        if (this.frameId) cancelAnimationFrame(this.frameId);
        window.removeEventListener('resize', this._onResize);
        this.controls.dispose();
        this.renderer.dispose();
        if (this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
    }
}
