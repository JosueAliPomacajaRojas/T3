import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// 1. ESCENA, CÁMARA, ILUMINACIÓN Y RENDERER
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182430);
scene.fog = new THREE.Fog(0x182430, 45, 190);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.95));

const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
dirLight.position.set(35, 60, 25);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 160;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 70;
dirLight.shadow.camera.bottom = -70;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// 2. SISTEMA DE AUDIO COMPACTO 
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function sonar(freqStart, freqEnd, dur, gainVal = 0.5, tipo = 'sine') {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
  g.gain.setValueAtTime(gainVal, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur);
}

function playSound(tipo) {
  if (tipo === 'shotgun') sonar(150, 30, 0.32, 0.9, 'sawtooth');
  else if (tipo === 'rifle') sonar(380, 45, 0.16, 0.7, 'triangle');
  else if (tipo === 'empty') sonar(900, 300, 0.05, 0.2, 'sine');
  else if (tipo === 'zombie-alert') sonar(120, 65, 0.4, 0.25, 'sawtooth');
  else if (tipo === 'zombie-hurt') sonar(170, 50, 0.2, 0.35, 'triangle');
  else if (tipo === 'zombie-die') sonar(110, 25, 0.45, 0.45, 'sawtooth');
  else if (tipo === 'pickup') sonar(520, 880, 0.16, 0.35, 'sine');
}

// 3. MAPA URBANO: PISTAS, CASAS DE COLORES Y OBSTÁCULOS 

const zExtraccion = 210.0;
const obstaculos = [];

// Suelo general
const sueloMat = new THREE.MeshStandardMaterial({ color: 0x1a211c, roughness: 0.95 });
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(180, 280).rotateX(-Math.PI / 2), sueloMat);
suelo.position.set(-8, -0.05, 105);
suelo.receiveShadow = true;
scene.add(suelo);

// Materiales viales
const pistaMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.85 });
const callejonMat = new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.9 });
const lineaAmarillaMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const lineaBlancaMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function crearPista(x, z, ancho, largo, esCallejon = false) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo).rotateX(-Math.PI / 2), esCallejon ? callejonMat : pistaMat);
  mesh.position.set(x, 0.01, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Trazado de vías (Tramo inicial, bifurcación en Avenida y Callejón, Plaza y Extracción)
crearPista(0, 20, 14, 60);            // Inicio (Z: -10 a 50)
crearPista(7, 95, 13, 90);            // Ruta A: Avenida derecha (Z: 50 a 140)
crearPista(-20, 95, 11, 90, true);    // Ruta B: Callejón izquierdo (Z: 50 a 140)
crearPista(-10.5, 52, 23, 16, true);  // Cruce de entrada al callejón (plano horizontal)
crearPista(-10.5, 138, 23, 16, true); // Cruce de salida a la plaza (plano horizontal)
crearPista(-4, 162, 34, 45);          // Gran Plaza central (Z: 140 a 185)
crearPista(0, 205, 14, 40);           // Tramo final (Z: 185 a 225)

// Líneas viales y pasos peatonales
function crearLinea(x, z, largo) {
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, largo).rotateX(-Math.PI / 2), lineaAmarillaMat);
  l.position.set(x, 0.02, z);
  scene.add(l);
}
crearLinea(-0.15, 20, 55); crearLinea(0.15, 20, 55);
crearLinea(6.85, 95, 85); crearLinea(7.15, 95, 85);

function crearPasoCebra(xCenter, z, ancho) {
  for (let x = xCenter - ancho / 2 + 1.2; x <= xCenter + ancho / 2 - 1.2; x += 1.3) {
    const zebra = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.8).rotateX(-Math.PI / 2), lineaBlancaMat);
    zebra.position.set(x, 0.02, z);
    scene.add(zebra);
  }
}
[{ x: 0, z: 18, w: 12 }, { x: 7, z: 65, w: 11 }, { x: -20, z: 75, w: 9 }, { x: -4, z: 148, w: 28 }, { x: 0, z: 195, w: 12 }]
  .forEach(p => crearPasoCebra(p.x, p.z, p.w));

// Casas y Edificios
const paletaCasas = [0xf59e0b, 0x2563eb, 0xd9432d, 0x10b981, 0xf97316, 0x8b5cf6, 0x06b6d4, 0xf43f5e, 0x64748b];
const matZocalo = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
const matTejado = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
const matPuerta = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75 });
const matVentana = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfbbf24, emissiveIntensity: 0.45, roughness: 0.3 });
const geoPuerta = new THREE.PlaneGeometry(1.2, 2.3);
const geoVentana = new THREE.PlaneGeometry(1.2, 1.4);

function crearCasa(x, z, w, h, d, color, esOeste = false) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
  cuerpo.position.y = h / 2;
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  g.add(cuerpo);

  const zocalo = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.65, d + 0.15), matZocalo);
  zocalo.position.y = 0.325;
  const cornisa = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5), matTejado);
  cornisa.position.y = h + 0.25;
  g.add(zocalo, cornisa);

  const sign = esOeste ? -1 : 1;
  const puerta = new THREE.Mesh(geoPuerta, matPuerta);
  puerta.position.set((w / 2 + 0.02) * sign, 1.15, 0);
  puerta.rotation.y = sign * Math.PI / 2;
  g.add(puerta);

  for (let y = 3; y < h; y += 2.8) {
    for (const oz of [-d * 0.25, d * 0.25]) {
      const win = new THREE.Mesh(geoVentana, matVentana);
      win.position.set((w / 2 + 0.02) * sign, y, oz);
      win.rotation.y = sign * Math.PI / 2;
      g.add(win);
    }
  }

  g.position.set(x, 0, z);
  scene.add(g);
  obstaculos.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d)));
}

// Manzana central divisoria (X = -6.5, Z = 60 a 130)
crearCasa(-6.5, 70, 7.5, 9.5, 15, paletaCasas[0], true);
crearCasa(-6.5, 95, 7.5, 11.5, 17, paletaCasas[1], false);
crearCasa(-6.5, 120, 7.5, 9.0, 15, paletaCasas[3], true);

// Casas en la vereda derecha
let cIdx = 0;
for (let z = 10; z < 215; z += 17) {
  crearCasa(18.5, z, 9.5, 8.5 + (cIdx % 3) * 2, 14.5, paletaCasas[cIdx % paletaCasas.length], true);
  cIdx++;
}

// Casas en la vereda izquierda y zona inicial
for (let z = 50; z < 155; z += 17) {
  crearCasa(-30.5, z, 9.5, 8.0 + (cIdx % 4) * 1.8, 14.5, paletaCasas[(cIdx + 2) % paletaCasas.length], false);
  cIdx++;
}
crearCasa(-13, 10, 8, 9.0, 13, paletaCasas[2], false);
crearCasa(-13, 28, 8, 10.5, 13, paletaCasas[4], false);

// Árboles, arbustos y coches
const troncoGeo = new THREE.CylinderGeometry(0.2, 0.28, 3.2, 6);
const copaGeo = new THREE.DodecahedronGeometry(1.35);
const troncoMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
const hojasMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
const arbustoGeo = new THREE.DodecahedronGeometry(0.7);
const arbustoMat = new THREE.MeshStandardMaterial({ color: 0x22c55e });

function crearArbol(x, z) {
  const tg = new THREE.Group();
  const tr = new THREE.Mesh(troncoGeo, troncoMat); tr.position.y = 1.6; tr.castShadow = true;
  const cp = new THREE.Mesh(copaGeo, hojasMat); cp.position.y = 3.6; cp.castShadow = true;
  tg.add(tr, cp);
  tg.position.set(x, 0, z);
  scene.add(tg);
  obstaculos.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 2, z), new THREE.Vector3(1, 4, 1)));
}

for (let z = 62; z < 135; z += 18) {
  crearArbol(-15.0, z);
  const b1 = new THREE.Mesh(arbustoGeo, arbustoMat); b1.position.set(-25.0, 0.55, z + 6); scene.add(b1);
  crearArbol(13.5, z);
  const b2 = new THREE.Mesh(arbustoGeo, arbustoMat); b2.position.set(13.5, 0.55, z + 7); scene.add(b2);
}
crearArbol(-8, 16); crearArbol(8, 25); crearArbol(-17, 165); crearArbol(9, 175);

// Obstáculos urbanos: Barricadas militares y vehículos accidentados
const matBarricada = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
const matFranjaAvis = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

function crearBarricada(x, z, ancho, rot = 0) {
  const bg = new THREE.Group();
  const muro = new THREE.Mesh(new THREE.BoxGeometry(ancho, 1.2, 0.7), matBarricada);
  muro.position.y = 0.6;
  muro.castShadow = true;
  bg.add(muro);

  const franja = new THREE.Mesh(new THREE.BoxGeometry(ancho * 0.85, 0.18, 0.72), matFranjaAvis);
  franja.position.y = 0.8;
  bg.add(franja);

  bg.position.set(x, 0, z);
  bg.rotation.y = rot;
  scene.add(bg);
  obstaculos.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.7, z), new THREE.Vector3(ancho, 1.4, 0.8)));
}

function crearVehiculo(x, z, rot, color) {
  const cg = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.85, 4.4), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }));
  b.position.y = 0.55; b.castShadow = true;
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.75, 2.3), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 }));
  c.position.set(0, 1.25, -0.2); c.castShadow = true;
  cg.add(b, c);
  cg.position.set(x, 0, z);
  cg.rotation.y = rot;
  scene.add(cg);
  obstaculos.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1, z), new THREE.Vector3(2.5, 2, 4.5)));
}

// 1. Tramo Inicial (Z: 30): Barricada y coche bloqueando el centro de la calle
crearVehiculo(2.5, 30, 0.35, 0xdc2626);
crearBarricada(-2.0, 30, 4.5);

// 2. Ruta A: Avenida Principal (Z: 50 a 140) - Chicanes en zigzag más difíciles
crearVehiculo(4.2, 72, 0.45, 0x1e293b);
crearBarricada(9.5, 72, 4.5);
crearBarricada(4.0, 96, 5.0);
crearVehiculo(8.8, 98, -0.4, 0xeab308);
crearVehiculo(4.5, 120, 0.6, 0x475569);
crearBarricada(10.0, 120, 4.0);

// 3. Ruta B: Callejón Alternativo (Z: 50 a 140) - Pasos estrechos y contención
crearBarricada(-22.0, 68, 5.0);
crearVehiculo(-17.0, 70, -0.2, 0x2563eb);
crearVehiculo(-22.5, 92, 0.5, 0xd97706);
crearBarricada(-16.5, 92, 4.5);
crearBarricada(-20.0, 115, 6.0);

// 4. Gran Plaza Central (Z: 140 a 185) - Puesto de control militar con barricadas
crearBarricada(-8.0, 158, 8.0);
crearBarricada(4.0, 158, 8.0);
crearVehiculo(-2.0, 162, 0.8, 0x16a34a);

// Iluminación nocturna suave y Zona de Extracción 
for (const p of [{ x: 8, z: 70 }, { x: -18, z: 100 }]) {
  const l = new THREE.PointLight(0xfff176, 1.8, 25);
  l.position.set(p.x, 5.0, p.z);
  scene.add(l);
}

const helipad = new THREE.Mesh(
  new THREE.RingGeometry(2.5, 5.5, 28).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x16a34a, side: THREE.DoubleSide, roughness: 0.5 })
);
helipad.position.set(0, 0.04, zExtraccion);
scene.add(helipad);

const beaconGreen = new THREE.PointLight(0x22c55e, 4.5, 25);
beaconGreen.position.set(0, 3.5, zExtraccion);
scene.add(beaconGreen);

// 4. SISTEMA DE ARMAS GLB 

const weaponHolder = new THREE.Group();
camera.add(weaponHolder);

const armas = {
  1: { id: 1, nombre: 'Escopeta Táctica', municion: 8, maxMunicion: 16, cooldown: 0.65, mesh: null, basePos: new THREE.Vector3(0.24, -0.28, -0.48), baseRot: new THREE.Euler(0, Math.PI / 2, 0), recoil: 0.12 },
  2: { id: 2, nombre: 'Rifle de Asalto M16', municion: 30, maxMunicion: 60, cooldown: 0.18, mesh: null, basePos: new THREE.Vector3(0.22, -0.26, -0.45), baseRot: new THREE.Euler(0, Math.PI / 2, 0), recoil: 0.05 }
};
let armaActivaId = 1;
let ultimoDisparo = 0;
let retrocesoZ = 0;

const flashLight = new THREE.PointLight(0xffcc00, 0, 8);
flashLight.position.set(0.24, -0.2, -0.9);
weaponHolder.add(flashLight);
let flashTimer = 0;

// 5. BALAS TRAZADORAS, SANGRE Y CAJAS DE MUNICIÓN 

const activeTracers = [];
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

function crearBalaTrazadora(startPos, endPos) {
  const dist = startPos.distanceTo(endPos);
  const geo = new THREE.CylinderGeometry(0.025, 0.025, dist, 5).rotateX(Math.PI / 2);
  const tracer = new THREE.Mesh(geo, tracerMat);
  tracer.position.copy(startPos).lerp(endPos, 0.5);
  tracer.lookAt(endPos);
  scene.add(tracer);
  activeTracers.push({ mesh: tracer, timer: 0.08 });
}

const bloodBursts = [];
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x990000 });
const bloodGeo = new THREE.SphereGeometry(0.065, 4, 4);

function crearSalpicaduraSangre(pos) {
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(bloodGeo, bloodMat);
    p.position.copy(pos);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4.0, Math.random() * 3.2 + 1.0, (Math.random() - 0.5) * 4.0);
    scene.add(p);
    bloodBursts.push({ mesh: p, vel, life: 0.4 });
  }
}

// Cajas de Munición
const texLoader = new THREE.TextureLoader();
const ammoTex = texLoader.load('models/ammo_texture.jpg');
const ammoMat = new THREE.MeshStandardMaterial({ map: ammoTex, roughness: 0.45, metalness: 0.25, emissive: 0xca8a04, emissiveIntensity: 0.15 });
const coleccionables = [];

function crearCajaMunicion(x, z) {
  const bg = new THREE.Group();
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.55), ammoMat);
  c.position.y = 0.25; c.castShadow = true;
  bg.add(c);
  bg.position.set(x, 0.2, z);
  scene.add(bg);
  coleccionables.push({ group: bg, x, z, recogido: false });
}
crearCajaMunicion(-4.0, 30);
crearCajaMunicion(8.0, 80);
crearCajaMunicion(-21.0, 95);
crearCajaMunicion(-3.0, 165);

// 6. CARGA DE MODELOS GLB: ARMAS Y ZOMBIS HUMANOS 

const gltfLoader = new GLTFLoader();
const zombieTex = texLoader.load('models/zombie_texture.jpg');
const zombis = [];
const shootableMeshes = [];

// Armas GLB
gltfLoader.load('models/shotgun.glb', (gltf) => {
  const m = gltf.scene; m.scale.set(0.42, 0.42, 0.42);
  m.position.copy(armas[1].basePos); m.rotation.copy(armas[1].baseRot);
  armas[1].mesh = m; weaponHolder.add(m);
  m.visible = (armaActivaId === 1);
});

gltfLoader.load('models/rifle.glb', (gltf) => {
  const m = gltf.scene; m.scale.set(0.38, 0.38, 0.38);
  m.position.copy(armas[2].basePos); m.rotation.copy(armas[2].baseRot);
  armas[2].mesh = m; weaponHolder.add(m);
  m.visible = (armaActivaId === 2);
});

// Farolas decorativas
gltfLoader.load('models/streetlight.glb', (gltf) => {
  for (const pos of [{ x: -7.5, z: 22 }, { x: 13.5, z: 65 }, { x: 13.5, z: 115 }, { x: -25.5, z: 70 }, { x: -25.5, z: 115 }, { x: -6.0, z: 155 }, { x: 7.5, z: 195 }]) {
    const lamp = gltf.scene.clone();
    lamp.scale.set(1.4, 1.4, 1.4); lamp.position.set(pos.x, 0, pos.z); lamp.rotation.y = Math.PI / 2;
    scene.add(lamp);
    obstaculos.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(pos.x, 3, pos.z), new THREE.Vector3(0.6, 6, 0.6)));
  }
});

// Zombis con apariencia humana infectada (RF04, RF05, RF07)
gltfLoader.load('models/zombie.glb', (gltf) => {
  const template = gltf.scene;
  const clip = gltf.animations && gltf.animations.length > 0 ? gltf.animations[0] : null;

  template.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true;
      node.material = new THREE.MeshStandardMaterial({ map: zombieTex, roughness: 0.6, metalness: 0.05 });
    }
  });

  // Infectados distribuidos por la ciudad (RF05, RF11)
  const spawns = [
    // Calle inicial: alejados del punto de inicio (Z = 0) para que no persigan de primeras
    { x: -2.5, z: 36, range: 20, speed: 3.2 },
    { x: 3.0, z: 48, range: 22, speed: 3.4 },

    // Ruta A: Avenida derecha 
    { x: 5.5, z: 65, range: 34, speed: 3.8 },
    { x: 9.0, z: 82, range: 36, speed: 4.8 },
    { x: 4.5, z: 105, range: 36, speed: 4.0 },
    { x: 8.0, z: 125, range: 38, speed: 5.0 },

    // Ruta B: Callejón izquierdo alternativo
    { x: -18.0, z: 62, range: 32, speed: 3.6 },
    { x: -23.0, z: 80, range: 35, speed: 4.2 },
    { x: -17.5, z: 102, range: 36, speed: 4.8 },
    { x: -22.5, z: 120, range: 38, speed: 4.4 },

    // Plaza central
    { x: -10.0, z: 152, range: 40, speed: 4.2 },
    { x: 2.0, z: 162, range: 42, speed: 5.0 },
    { x: -5.0, z: 174, range: 42, speed: 5.2 },

    // Tramo final hacia la extracción
    { x: -2.5, z: 192, range: 45, speed: 5.2 },
    { x: 2.0, z: 202, range: 45, speed: 5.5 }
  ];

  spawns.forEach((cfg, idx) => {
    const clone = SkeletonUtils.clone(template);
    clone.scale.set(1.18, 1.18, 1.18);
    clone.position.set(cfg.x, 0, cfg.z);
    scene.add(clone);

    let mixer = null;
    if (clip) {
      mixer = new THREE.AnimationMixer(clone);
      mixer.clipAction(clip).play();
    }

    const zObj = {
      id: idx, mesh: clone, mixer,
      resistencia: 2, // Exactamente 2 impactos 
      estado: 'INACTIVO', rangoDeteccion: cfg.range, velocidad: cfg.speed,
      alertaSonada: false, caidaMuerte: 0, hitFlashTimer: 0, initX: cfg.x, initZ: cfg.z
    };

    clone.traverse(node => {
      if (node.isMesh) {
        node.userData = { zombi: zObj };
        shootableMeshes.push(node);
      }
    });

    zombis.push(zObj);
  });
});

// 7. CONTROLES DEL JUGADOR Y SISTEMA DE DISPARO 

let juegoActivo = false;
const teclas = { w: false, s: false, a: false, d: false };
const jugador = { pos: new THREE.Vector3(0, 1.75, 0), vel: new THREE.Vector3(), yaw: 0, pitch: 0, kills: 0, shots: 0 };

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') teclas.w = true;
  if (e.code === 'KeyS') teclas.s = true;
  if (e.code === 'KeyA') teclas.a = true;
  if (e.code === 'KeyD') teclas.d = true;
  if (e.code === 'Digit1') cambiarArma(1);
  if (e.code === 'Digit2') cambiarArma(2);
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') teclas.w = false;
  if (e.code === 'KeyS') teclas.s = false;
  if (e.code === 'KeyA') teclas.a = false;
  if (e.code === 'KeyD') teclas.d = false;
});

document.addEventListener('mousemove', (e) => {
  if (!juegoActivo) return;
  jugador.yaw -= e.movementX * 0.0022;
  jugador.pitch = Math.max(-1.45, Math.min(1.45, jugador.pitch - e.movementY * 0.0022));
});

renderer.domElement.addEventListener('click', () => {
  if (juegoActivo && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});

let clickSostenido = false;
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && !clickSostenido && juegoActivo) {
    clickSostenido = true;
    disparar();
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) clickSostenido = false;
});

function cambiarArma(id) {
  if (armaActivaId === id) return;
  armaActivaId = id;
  if (armas[1].mesh) armas[1].mesh.visible = (id === 1);
  if (armas[2].mesh) armas[2].mesh.visible = (id === 2);
  actualizarHUD();
}

// Raycasting optimizado 
const raycaster = new THREE.Raycaster();
const _barrelPos = new THREE.Vector3();
const _screenCenter = new THREE.Vector2(0, 0);

function disparar() {
  const arma = armas[armaActivaId];
  const ahora = performance.now() / 1000;
  if (ahora - ultimoDisparo < arma.cooldown) return;

  if (arma.municion <= 0) {
    playSound('empty');
    return;
  }

  arma.municion--;
  ultimoDisparo = ahora;
  jugador.shots++;
  retrocesoZ = arma.recoil;
  playSound(arma.id === 1 ? 'shotgun' : 'rifle');
  flashLight.intensity = 4.5;
  flashTimer = 0.06;
  actualizarHUD();

  weaponHolder.getWorldPosition(_barrelPos);
  _barrelPos.add(new THREE.Vector3(0.24, -0.15, -0.6).applyQuaternion(camera.quaternion));

  raycaster.setFromCamera(_screenCenter, camera);
  const intersects = raycaster.intersectObjects(shootableMeshes, false);
  let targetPos;

  if (intersects.length > 0) {
    const hit = intersects[0];
    targetPos = hit.point;
    const hitZombi = hit.object.userData.zombi;

    if (hitZombi && hitZombi.estado !== 'MUERTO') {
      const hm = document.getElementById('hitmarker');
      hm.classList.add('active');
      setTimeout(() => hm.classList.remove('active'), 110);

      crearSalpicaduraSangre(hit.point);
      hitZombi.hitFlashTimer = 0.16;
      hitZombi.mesh.traverse(n => { if (n.isMesh) n.material.color.setHex(0xff1111); });

      // Empuje cinético hacia atrás con colisión para no atravesar muros
      const pushDir = raycaster.ray.direction.clone().setY(0).normalize();
      const pNextX = hitZombi.mesh.position.x + pushDir.x * 0.45;
      const pNextZ = hitZombi.mesh.position.z + pushDir.z * 0.45;
      let pChoca = false;
      for (let i = 0; i < obstaculos.length; i++) {
        const b = obstaculos[i];
        if (pNextX > b.min.x - 0.55 && pNextX < b.max.x + 0.55 &&
          pNextZ > b.min.z - 0.55 && pNextZ < b.max.z + 0.55) {
          pChoca = true;
          break;
        }
      }
      if (!pChoca) {
        hitZombi.mesh.position.x = pNextX;
        hitZombi.mesh.position.z = pNextZ;
      }

      hitZombi.resistencia--;
      if (hitZombi.resistencia <= 0) {
        hitZombi.estado = 'MUERTO';
        playSound('zombie-die');
        jugador.kills++;
      } else {
        hitZombi.estado = 'ACTIVO';
        playSound('zombie-hurt');
      }
    }
  } else {
    targetPos = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 65);
  }

  crearBalaTrazadora(_barrelPos, targetPos);
}

// 8. INTERFAZ Y REINICIO 

const hudAmmoVal = document.getElementById('hud-ammo-val');
const hudAmmoMax = document.getElementById('hud-ammo-max');
const hudWeaponName = document.getElementById('hud-weapon-name');
const tagW1 = document.getElementById('tag-w1');
const tagW2 = document.getElementById('tag-w2');
const hudDist = document.getElementById('hud-dist');
const notifyBox = document.getElementById('notify-box');

function actualizarHUD() {
  const a = armas[armaActivaId];
  hudAmmoVal.textContent = a.municion;
  hudAmmoMax.textContent = `/ ${a.maxMunicion}`;
  hudWeaponName.textContent = a.nombre;
  hudAmmoVal.classList.toggle('empty', a.municion === 0);
  tagW1.classList.toggle('active', armaActivaId === 1);
  tagW2.classList.toggle('active', armaActivaId === 2);
}

function mostrarNotificacion(txt) {
  notifyBox.textContent = txt;
  notifyBox.classList.add('show');
  setTimeout(() => notifyBox.classList.remove('show'), 1500);
}
actualizarHUD();

document.getElementById('btn-start').addEventListener('click', () => {
  initAudio();
  document.getElementById('start-screen').classList.add('hidden');
  try { renderer.domElement.requestPointerLock(); } catch (e) { }
  juegoActivo = true;
});

document.getElementById('btn-restart-victory').addEventListener('click', reiniciar);
document.getElementById('btn-restart-gameover').addEventListener('click', reiniciar);

function reiniciar() {
  jugador.pos.set(0, 1.75, 0);
  jugador.vel.set(0, 0, 0);
  jugador.yaw = 0; jugador.pitch = 0; jugador.kills = 0; jugador.shots = 0;

  armas[1].municion = 8;
  armas[2].municion = 30;
  armaActivaId = 1;
  if (armas[1].mesh) armas[1].mesh.visible = true;
  if (armas[2].mesh) armas[2].mesh.visible = false;

  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('blood-overlay').className = '';

  zombis.forEach(z => {
    z.resistencia = 2;
    z.estado = 'INACTIVO';
    z.caidaMuerte = 0;
    z.alertaSonada = false;
    z.hitFlashTimer = 0;
    z.mesh.rotation.x = 0;
    z.mesh.position.set(z.initX, 0, z.initZ);
    z.mesh.traverse(n => { if (n.isMesh) n.material.color.setHex(0xffffff); });
  });

  coleccionables.forEach(c => {
    c.recogido = false;
    c.group.visible = true;
  });

  actualizarHUD();
  try { renderer.domElement.requestPointerLock(); } catch (e) { }
  juegoActivo = true;
}

// 9. BUCLE PRINCIPAL DE ANIMACIÓN Y FÍSICAS 

const clock = new THREE.Clock();
const _vFwd = new THREE.Vector3();
const _vSide = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _toPlayer = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  // Trazadores de bala
  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const tr = activeTracers[i];
    tr.timer -= dt;
    if (tr.timer <= 0) {
      scene.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      activeTracers.splice(i, 1);
    }
  }

  // Partículas de sangre
  for (let i = bloodBursts.length - 1; i >= 0; i--) {
    const b = bloodBursts[i];
    b.life -= dt;
    b.vel.y -= 9.8 * dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bloodBursts.splice(i, 1);
    }
  }

  // Coleccionables giratorios
  coleccionables.forEach(c => {
    if (!c.recogido) {
      c.group.rotation.y += dt * 1.8;
      const dx = jugador.pos.x - c.x;
      const dz = jugador.pos.z - c.z;
      if (dx * dx + dz * dz < 3.24) {
        c.recogido = true;
        c.group.visible = false;
        armas[1].municion = Math.min(armas[1].maxMunicion, armas[1].municion + 8);
        armas[2].municion = Math.min(armas[2].maxMunicion, armas[2].municion + 30);
        playSound('pickup');
        mostrarNotificacion('+ Munición Recogida (Escopeta y Rifle)');
        actualizarHUD();
      }
    }
  });

  if (juegoActivo) {
    // Movimiento del jugador
    _vFwd.set(-Math.sin(jugador.yaw), 0, -Math.cos(jugador.yaw));
    _vSide.set(Math.cos(jugador.yaw), 0, -Math.sin(jugador.yaw));
    _vDir.set(0, 0, 0);

    if (teclas.w) _vDir.add(_vFwd);
    if (teclas.s) _vDir.sub(_vFwd);
    if (teclas.d) _vDir.add(_vSide);
    if (teclas.a) _vDir.sub(_vSide);

    if (_vDir.lengthSq() > 0.001) {
      _vDir.normalize();
      const spd = 7.8; // Velocidad fija y constante de desplazamiento FPS
      jugador.vel.x += _vDir.x * spd * dt * 7.0;
      jugador.vel.z += _vDir.z * spd * dt * 7.0;
    }

    jugador.vel.x -= jugador.vel.x * 9.0 * dt;
    jugador.vel.z -= jugador.vel.z * 9.0 * dt;

    const nextX = jugador.pos.x + jugador.vel.x * dt;
    const nextZ = jugador.pos.z + jugador.vel.z * dt;

    // Colisiones con obstáculos
    let choca = false;
    for (let i = 0; i < obstaculos.length; i++) {
      const box = obstaculos[i];
      if (nextX > box.min.x - 0.55 && nextX < box.max.x + 0.55 &&
        nextZ > box.min.z - 0.55 && nextZ < box.max.z + 0.55) {
        choca = true;
        break;
      }
    }

    if (!choca) {
      jugador.pos.x = nextX;
      jugador.pos.z = nextZ;
    } else {
      jugador.vel.set(0, 0, 0);
    }

    jugador.pos.x = Math.max(-28.0, Math.min(15.0, jugador.pos.x));
    jugador.pos.z = Math.max(-5.0, Math.min(zExtraccion + 10, jugador.pos.z));

    camera.position.copy(jugador.pos);
    camera.rotation.set(0, 0, 0);
    camera.rotation.y = jugador.yaw;
    camera.rotation.x = jugador.pitch;

    // Arma activa y retroceso
    retrocesoZ = THREE.MathUtils.lerp(retrocesoZ, 0, 10.0 * dt);
    const activa = armas[armaActivaId];
    if (activa.mesh) {
      activa.mesh.position.set(activa.basePos.x, activa.basePos.y, activa.basePos.z + retrocesoZ);
      activa.mesh.rotation.copy(activa.baseRot);
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flashLight.intensity = 0;
    }

    // Comportamiento de Zombis 
    zombis.forEach(z => {
      if (z.mixer) z.mixer.update(dt);

      if (z.hitFlashTimer > 0) {
        z.hitFlashTimer -= dt;
        if (z.hitFlashTimer <= 0) {
          z.mesh.traverse(n => { if (n.isMesh) n.material.color.setHex(0xffffff); });
        }
      }

      if (z.estado === 'MUERTO') {
        if (z.caidaMuerte < 1.0) {
          z.caidaMuerte += dt;
          z.mesh.rotation.x = THREE.MathUtils.lerp(z.mesh.rotation.x, -Math.PI / 2, dt * 6);
          z.mesh.position.y = THREE.MathUtils.lerp(z.mesh.position.y, 0.1, dt * 4);
        }
        return;
      }

      const dx = jugador.pos.x - z.mesh.position.x;
      const dz = jugador.pos.z - z.mesh.position.z;
      const distSq = dx * dx + dz * dz;

      if (z.estado === 'INACTIVO' && distSq <= z.rangoDeteccion * z.rangoDeteccion) {
        z.estado = 'ACTIVO';
        if (!z.alertaSonada) {
          playSound('zombie-alert');
          z.alertaSonada = true;
        }
      }

      if (z.estado === 'ACTIVO') {
        _toPlayer.set(dx, 0, dz).normalize();
        z.mesh.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);

        // Desplazamiento con colisión por ejes 
        const stepX = _toPlayer.x * z.velocidad * dt;
        const stepZ = _toPlayer.z * z.velocidad * dt;
        const nextX = z.mesh.position.x + stepX;
        const nextZ = z.mesh.position.z + stepZ;
        const zR = 0.55;

        let colX = false;
        let colZ = false;
        for (let i = 0; i < obstaculos.length; i++) {
          const b = obstaculos[i];
          if (!colX && nextX > b.min.x - zR && nextX < b.max.x + zR &&
            z.mesh.position.z > b.min.z - zR && z.mesh.position.z < b.max.z + zR) {
            colX = true;
          }
          if (!colZ && z.mesh.position.x > b.min.x - zR && z.mesh.position.x < b.max.x + zR &&
            nextZ > b.min.z - zR && nextZ < b.max.z + zR) {
            colZ = true;
          }
          if (colX && colZ) break;
        }

        if (!colX) z.mesh.position.x = nextX;
        if (!colZ) z.mesh.position.z = nextZ;

        // Derrota al contacto 
        if (distSq <= 1.82) {
          juegoActivo = false;
          if (document.exitPointerLock) document.exitPointerLock();
          document.getElementById('blood-overlay').classList.add('dead');
          document.getElementById('game-over-screen').classList.remove('hidden');
        }
      }
    });

    hudDist.textContent = `${Math.max(0, Math.round(zExtraccion - jugador.pos.z))} m`;

    // Victoria al llegar a extracción 
    if (jugador.pos.z >= zExtraccion) {
      juegoActivo = false;
      if (document.exitPointerLock) document.exitPointerLock();
      document.getElementById('vic-stats').textContent = `Infectados abatidos: ${jugador.kills} | Disparos realizados: ${jugador.shots}`;
      document.getElementById('victory-screen').classList.remove('hidden');
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
