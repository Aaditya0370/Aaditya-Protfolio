import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PROJECTS, PortfolioProject, ShaderMode } from '../data/portfolioData';
import {
  createGearGeometry,
  createGeodesicCage,
  createTurbineCrownGeometry,
  createVaultWingGeometry,
  createVernierRingGeometry,
} from './proceduralGeometries';
import {
  createBrushedMetalRoughnessMap,
  createContactShadowTexture,
  createContactTextTexture,
  createHeroTextTexture,
  createProjectBackTexture,
  createProjectScreenTexture,
  createProjectsHeaderTexture,
  createShaderLabTextTexture,
  createSolarPanelTexture,
  createSystemsTextTexture,
} from './proceduralTextures';
import {
  createHologramConduitMaterial,
  createIridescentPrismMaterial,
  createPrismDustMaterial,
  createShaderLabMaterial,
  createVoidBackdropMaterial,
  createWaveFloorMaterial,
} from './shaders';

export type HitAction =
  | { type: 'discipline'; index: number }
  | { type: 'monolith'; index: number }
  | { type: 'shaderMode'; mode: ShaderMode }
  | { type: 'shaderFreq'; delta: number }
  | { type: 'shaderAmp'; delta: number }
  | { type: 'copyEmail' }
  | { type: 'openUrl'; url: string }
  | { type: 'scrollToTop' }
  | { type: 'toggleSound' };

export interface ProjectMonolithHandle {
  project: PortfolioProject;
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  gearRing: THREE.Mesh;
  cage: THREE.Group;
  frontScreenMat: THREE.MeshStandardMaterial;
  backScreenMat: THREE.MeshStandardMaterial;
  baseY: number;
  baseRotY: number;
  targetRotY: number;
  flipped: boolean;
  phase: number;
}

export type ChamberKey = 'hero' | 'systems' | 'projects' | 'shaderLab' | 'horizon';

export interface SatelliteHandle {
  group: THREE.Group;
  gyroRing: THREE.Mesh;
  wings: THREE.Group;
  basePos: THREE.Vector3;
  phase: number;
  orbitAmp: number;
  speed: number;
}

export interface PortfolioSceneObjects {
  cameraCurve: THREE.CatmullRomCurve3;
  lookAtCurve: THREE.CatmullRomCurve3;
  heroCoreGroup: THREE.Group;
  heroKineticParts: THREE.Object3D[];
  heroPinions: THREE.Mesh[];
  heroTextMesh: THREE.Mesh;
  prismCoreMaterial: THREE.ShaderMaterial;
  hologramMaterials: THREE.ShaderMaterial[];
  chamberHoloMaterials: Record<ChamberKey, THREE.ShaderMaterial[]>;
  chamberLights: Record<ChamberKey, THREE.PointLight>;
  systemsGroup: THREE.Group;
  systemsBlades: THREE.Object3D[];
  systemsCage: THREE.Group;
  systemsTextMesh: THREE.Mesh;
  neuralPackets: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; speed: number; offset: number }[];
  projectsHeaderMesh: THREE.Mesh;
  monoliths: ProjectMonolithHandle[];
  shaderLabGroup: THREE.Group;
  shaderManifold: THREE.Mesh;
  shaderLabMaterial: THREE.ShaderMaterial;
  shaderDysonParts: THREE.Object3D[];
  shaderTextMesh: THREE.Mesh;
  horizonGroup: THREE.Group;
  horizonParts: THREE.Object3D[];
  contactTextMesh: THREE.Mesh;
  satellites: SatelliteHandle[];
  gateways: THREE.Group[];
  prismDustMaterial: THREE.ShaderMaterial;
  waveFloorMaterial: THREE.ShaderMaterial;
  voidBackdropMaterial: THREE.ShaderMaterial;
  starfield: THREE.InstancedMesh;
  hitTargets: THREE.Mesh[];
  redrawHeroText: () => void;
  redrawSystemsText: () => void;
  redrawShaderText: () => void;
  redrawContactText: () => void;
  redrawAllStaticText: () => void;
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] };
}

export interface SceneInteractiveState {
  getDisciplineIdx: () => number;
  getShaderState: () => { mode: ShaderMode; freq: number; amp: number };
  getEmailCopied: () => boolean;
  getSoundMuted: () => boolean;
}

export function buildPortfolioScene(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  interactiveState: SceneInteractiveState
): PortfolioSceneObjects {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const hitTargets: THREE.Mesh[] = [];
  const hologramMaterials: THREE.ShaderMaterial[] = [];
  const chamberHoloMaterials: Record<ChamberKey, THREE.ShaderMaterial[]> = {
    hero: [],
    systems: [],
    projects: [],
    shaderLab: [],
    horizon: [],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const hitProxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));
  const addHitProxy = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    action: HitAction
  ) => {
    const proxy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), hitProxyMat);
    proxy.position.set(x, y, z);
    proxy.layers.set(1);
    proxy.userData.hitAction = action;
    parent.add(proxy);
    hitTargets.push(proxy);
    return proxy;
  };

  // 1. Deep Textured Obsidian Atmosphere & Studio IBL
  scene.background = new THREE.Color('#020305');
  scene.fog = new THREE.FogExp2('#020305', 0.0115);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTex = trackTex(pmrem.fromScene(roomEnv, 0.04).texture);
  scene.environment = envTex;
  scene.environmentIntensity = 0.36;
  roomEnv.dispose();
  pmrem.dispose();

  // 2. Calibrated Low-Glare Obsidian Lighting Rig (<= 3 shadow casters)
  const hemiLight = new THREE.HemisphereLight('#38BDF8', '#03281E', 0.34);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#DCE6F2', 0.98);
  keyLight.position.set(18, 30, 20);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    keyLight.shadow.camera.left = -24;
    keyLight.shadow.camera.right = 24;
    keyLight.shadow.camera.top = 24;
    keyLight.shadow.camera.bottom = -24;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const emeraldLight = new THREE.PointLight('#10B981', 7.5, 52, 1.4);
  emeraldLight.position.set(6, 4, 3);
  scene.add(emeraldLight);

  const violetLight = new THREE.PointLight('#A855F7', 6.5, 58, 1.4);
  violetLight.position.set(-3.2, 5.5, -33);
  scene.add(violetLight);

  const amberRimLight = new THREE.PointLight('#F59E0B', 5.5, 62, 1.4);
  amberRimLight.position.set(0, 6, -78);
  scene.add(amberRimLight);

  const cyanLabLight = new THREE.PointLight('#06B6D4', 7.5, 56, 1.4);
  cyanLabLight.position.set(6.5, 5.5, -124);
  scene.add(cyanLabLight);

  const horizonLight = new THREE.PointLight('#818CF8', 6.0, 62, 1.4);
  horizonLight.position.set(0, 5.5, -165);
  scene.add(horizonLight);

  // 1b. Serpentine 11-Point S-Curve Camera & Level-Stop Look-At Splines
  const cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 1.35, 12.6),    // 0.00: WP 0 Hero Overview
    new THREE.Vector3(5.8, 3.0, -4.5),     // 0.10: WP 1 Sweep Right Climb
    new THREE.Vector3(6.4, 1.5, -21.5),    // 0.19: WP 2 Systems Focal Point
    new THREE.Vector3(-2.5, 2.2, -39.5),   // 0.29: WP 3 Sweep Left into Vault
    new THREE.Vector3(-6.2, 1.6, -47.0),   // 0.34: WP 4 Monolith 01
    new THREE.Vector3(5.6, 1.8, -61.5),    // 0.44: WP 5 Monolith 02
    new THREE.Vector3(-5.8, 1.5, -76.0),   // 0.54: WP 6 Monolith 03
    new THREE.Vector3(5.8, 1.9, -90.5),    // 0.64: WP 7 Monolith 04
    new THREE.Vector3(-3.2, 1.5, -114.0),  // 0.77: WP 8 Shader Lab Focal Point
    new THREE.Vector3(5.6, 3.1, -139.0),   // 0.91: WP 9 Final Banking Turn Right
    new THREE.Vector3(0.0, 1.6, -155.0),   // 1.00: WP 10 Horizon Contact
  ]);

  const lookAtCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 1.35, 0.0),    // WP 0
    new THREE.Vector3(4.5, 2.0, -17.0),    // WP 1
    new THREE.Vector3(1.4, 1.5, -33.5),    // WP 2
    new THREE.Vector3(-3.3, 2.2, -50.0),   // WP 3
    new THREE.Vector3(-4.2, 1.6, -56.8),   // WP 4
    new THREE.Vector3(3.8, 1.8, -71.3),    // WP 5
    new THREE.Vector3(-3.8, 1.5, -85.8),   // WP 6
    new THREE.Vector3(3.8, 1.9, -100.3),   // WP 7
    new THREE.Vector3(0.0, 1.5, -126.0),   // WP 8
    new THREE.Vector3(2.2, 2.1, -153.0),   // WP 9
    new THREE.Vector3(0.0, 1.6, -167.5),   // WP 10
  ]);

  const getScreenAlignedPose = (
    scrollStop: number,
    distance: number,
    lateralOffset = 0,
    verticalOffset = 0
  ) => {
    const cam = cameraCurve.getPointAt(scrollStop);
    const look = lookAtCurve.getPointAt(scrollStop);
    const flatFwd = new THREE.Vector3(look.x - cam.x, 0, look.z - cam.z).normalize();
    // cross(flatFwd, UP) points right on screen
    const right = new THREE.Vector3(-flatFwd.z, 0, flatFwd.x).normalize();
    const pos = cam
      .clone()
      .addScaledVector(flatFwd, distance)
      .addScaledVector(right, lateralOffset);
    pos.y = cam.y + verticalOffset;
    const rotY = Math.atan2(-flatFwd.x, -flatFwd.z);
    const faceTarget = pos.clone().addScaledVector(flatFwd, -10);
    return { pos, rotY, faceTarget, cam, look };
  };

  // Bright pure-white color (< 1.16 bloom threshold) for sharp, zero-halo 3D typography
  const pureTextColor = new THREE.Color(1.13, 1.13, 1.13);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const brushedMap = trackTex(createBrushedMetalRoughnessMap());
  const shadowTex = trackTex(createContactShadowTexture());

  // Multi-Metal & Iridescent Physical Materials (calibrated roughness >= 0.25 delta)
  const obsidianCarbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#07090F',
      metalness: 0.75,
      roughness: 0.48,
      roughnessMap: brushedMap,
    })
  );
  const iridescentTitaniumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#D8E2EE',
      metalness: 0.92,
      roughness: 0.16,
      iridescence: 1.0,
      iridescenceIOR: 1.58,
      iridescenceThicknessRange: [180, 680],
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
    })
  );
  const champagneGoldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#F0C082',
      metalness: 0.95,
      roughness: 0.18,
      anisotropy: 0.85,
      clearcoat: 0.35,
    })
  );
  const roseCopperMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#E07A5F',
      metalness: 0.9,
      roughness: 0.24,
      iridescence: 0.65,
      iridescenceThicknessRange: [220, 520],
    })
  );
  const prismaticAlloyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#2563EB',
      emissive: '#0B1B3B',
      emissiveIntensity: 0.45,
      metalness: 0.82,
      roughness: 0.15,
      iridescence: 1.0,
      iridescenceIOR: 1.75,
      iridescenceThicknessRange: [260, 780],
      clearcoat: 0.8,
    })
  );
  const emeraldAnodizedMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#059669',
      emissive: '#042F2E',
      emissiveIntensity: 0.4,
      metalness: 0.78,
      roughness: 0.22,
      iridescence: 0.9,
      iridescenceThicknessRange: [300, 640],
    })
  );
  const whiteEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  const geodesicLineMat = trackMat(
    new THREE.LineBasicMaterial({ color: '#E2E8F0', transparent: true, opacity: 0.28 })
  );
  const geodesicCyanLineMat = trackMat(
    new THREE.LineBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.32 })
  );
  const shadowPlaneMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    })
  );

  // Custom GLSL Iridescent & Holographic Shaders
  const prismCoreMaterial = trackMat(createIridescentPrismMaterial());
  const createTrackedHoloMat = (phase: number, chamber: ChamberKey) => {
    const m = trackMat(createHologramConduitMaterial(phase));
    hologramMaterials.push(m);
    chamberHoloMaterials[chamber].push(m);
    return m;
  };

  // 2b. Simplex Noise + Iridescent Nebula + Grain Void Backdrop Quad
  const voidBackdropMaterial = trackMat(createVoidBackdropMaterial());
  const voidBackdropMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2, 2)),
    voidBackdropMaterial
  );
  voidBackdropMesh.frustumCulled = false;
  voidBackdropMesh.renderOrder = -1000;
  scene.add(voidBackdropMesh);

  // 3. Endless Topographic Spectral Wave Floor (wide enough for S-curve turns)
  const waveFloorGeo = trackGeo(new THREE.PlaneGeometry(340, 380, 120, 130));
  waveFloorGeo.rotateX(-Math.PI / 2);
  const waveFloorMaterial = trackMat(createWaveFloorMaterial());
  const waveFloor = new THREE.Mesh(waveFloorGeo, waveFloorMaterial);
  waveFloor.position.set(0, -5.4, -84);
  scene.add(waveFloor);

  // 4. Instanced Full-Spectrum Chromatic Prism Starfield (1,250 facets across wide S-corridor)
  const starCount = 1250;
  const starGeo = trackGeo(new THREE.OctahedronGeometry(0.088, 0));
  const starMat = trackMat(
    new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.52 })
  );
  const starfield = new THREE.InstancedMesh(starGeo, starMat, starCount);
  const dummy = new THREE.Object3D();
  const tempColor = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * 124,
      (Math.random() - 0.3) * 46,
      20 - Math.random() * 235
    );
    dummy.scale.setScalar(0.45 + Math.random() * 1.45);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    starfield.setMatrixAt(i, dummy.matrix);

    if (i % 4 === 0) {
      tempColor.set('#CBD5E1');
    } else {
      tempColor.setHSL((i * 0.6180339887) % 1.0, 0.72, 0.48);
    }
    starfield.setColorAt(i, tempColor);
  }
  starfield.instanceMatrix.needsUpdate = true;
  if (starfield.instanceColor) starfield.instanceColor.needsUpdate = true;
  starfield.computeBoundingSphere();
  scene.add(starfield);

  // 4b. 1,600 Drifting Chromatic Bokeh Dust Motes across the S-curve corridor
  const dustCount = 1600;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustPhases = new Float32Array(dustCount);
  const dustScales = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 48;
    dustPositions[i * 3 + 1] = -4.0 + Math.random() * 16.0;
    dustPositions[i * 3 + 2] = 14.0 - Math.random() * 200.0;
    dustPhases[i] = Math.random() * Math.PI * 2;
    dustScales[i] = 0.5 + Math.random() * 1.65;
  }
  const dustGeo = trackGeo(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(dustPhases, 1));
  dustGeo.setAttribute('aScale', new THREE.Float32BufferAttribute(dustScales, 1));
  const prismDustMaterial = trackMat(createPrismDustMaterial());
  const prismDustPoints = new THREE.Points(dustGeo, prismDustMaterial);
  prismDustPoints.frustumCulled = false;
  scene.add(prismDustPoints);

  // =========================================================================
  // CHAMBER 0: KINETIC ASTROLABE & GEODESIC CHRONOMETER (Right) + 3D HERO TEXT (Left)
  // =========================================================================
  const heroObjPose = getScreenAlignedPose(0.0, 12.6, 3.7, -0.45);
  const heroCoreGroup = new THREE.Group();
  heroCoreGroup.position.copy(heroObjPose.pos);
  heroCoreGroup.userData.baseY = heroObjPose.pos.y;
  scene.add(heroCoreGroup);

  const heroKineticParts: THREE.Object3D[] = [];
  const heroPinions: THREE.Mesh[] = [];

  // Part 1: Outer Extruded Turbine Stator Crown
  const turbineCrown = new THREE.Mesh(
    trackGeo(createTurbineCrownGeometry(18, 3.05, 3.85, 0.28)),
    obsidianCarbonMat
  );
  turbineCrown.castShadow = !isSoftwareGl;
  heroCoreGroup.add(turbineCrown);
  heroKineticParts.push(turbineCrown);

  // Part 2: Counter-rotating Iridescent Titanium Planetary Ring Gear
  const outerGear = new THREE.Mesh(
    trackGeo(createGearGeometry(42, 2.48, 2.78, 2.98, 0.2, 8)),
    iridescentTitaniumMat
  );
  outerGear.rotation.x = Math.PI * 0.14;
  heroCoreGroup.add(outerGear);
  heroKineticParts.push(outerGear);

  // Parts 3-5: 3 Meshing Champagne-Gold & Rose-Copper Pinion Gears orbiting inside
  const pinionGeo = trackGeo(createGearGeometry(14, 0.14, 0.42, 0.54, 0.22, 0));
  for (let p = 0; p < 3; p++) {
    const a = (p / 3) * Math.PI * 2;
    const pinion = new THREE.Mesh(pinionGeo, p === 0 ? champagneGoldMat : p === 1 ? roseCopperMat : emeraldAnodizedMat);
    pinion.position.set(Math.cos(a) * 1.98, Math.sin(a) * 1.98, 0);
    outerGear.add(pinion);
    heroPinions.push(pinion);
  }

  // Part 6: Articulated Geodesic Lattice Cage (edges + 42 faceted nodes)
  const heroCage = createGeodesicCage(2.22, 1, geodesicLineMat, champagneGoldMat, trackGeo);
  heroCoreGroup.add(heroCage);
  heroKineticParts.push(heroCage);

  // Part 7: Inner Inclined Sapphire Prismatic Gear Collar
  const innerGear = new THREE.Mesh(
    trackGeo(createGearGeometry(28, 1.32, 1.56, 1.72, 0.16, 6)),
    prismaticAlloyMat
  );
  innerGear.rotation.set(Math.PI * 0.36, Math.PI * 0.22, 0);
  heroCoreGroup.add(innerGear);
  heroKineticParts.push(innerGear);

  // Part 8 & 9: Twin Holographic Trefoil Energy Conduits
  const holoHeroMat1 = createTrackedHoloMat(0.0, 'hero');
  const holoHeroMat2 = createTrackedHoloMat(0.5, 'hero');
  for (let c = 0; c < 2; c++) {
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 48; s++) {
      const t = (s / 48) * Math.PI * 2;
      const r = 2.65 + Math.cos(t * 3) * 0.45;
      pts.push(
        new THREE.Vector3(
          Math.cos(t) * r,
          Math.sin(t) * r * (c === 0 ? 0.72 : 1.0),
          Math.sin(t * 2) * 0.85 * (c === 0 ? 1 : -1)
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const conduit = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(curve, 96, 0.028, 8, true)),
      c === 0 ? holoHeroMat1 : holoHeroMat2
    );
    conduit.rotation.y = c * 0.6;
    heroCoreGroup.add(conduit);
    heroKineticParts.push(conduit);
  }

  // Part 10: Central Iridescent Prism Crystal Core + Precision Champagne Vernier Scale Ring
  const heroCrystal = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.96, 2)),
    prismCoreMaterial
  );
  heroCoreGroup.add(heroCrystal);
  heroKineticParts.push(heroCrystal);

  const heroVernierRing = new THREE.Mesh(
    trackGeo(createVernierRingGeometry(48, 4.04, 4.36, 0.12)),
    champagneGoldMat
  );
  heroVernierRing.rotation.set(0.28, -0.35, 0);
  heroCoreGroup.add(heroVernierRing);
  heroKineticParts.push(heroVernierRing);

  const heroShadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(8.5, 8.5)), shadowPlaneMat);
  heroShadow.rotation.x = -Math.PI / 2;
  heroShadow.position.set(heroCoreGroup.position.x, -5.15, heroCoreGroup.position.z);
  scene.add(heroShadow);

  const heroTextData = createHeroTextTexture(maxAniso, interactiveState.getSoundMuted);
  trackTex(heroTextData.texture);
  const heroTextPose = getScreenAlignedPose(0.0, 11.2, -2.95, 0.0);
  const heroTextMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(9.0, 5.9)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: heroTextData.texture,
        color: pureTextColor,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );
  heroTextMesh.position.copy(heroTextPose.pos);
  heroTextMesh.rotation.y = heroTextPose.rotY;
  scene.add(heroTextMesh);

  addHitProxy(heroTextMesh, 2.6, 0.6, 0.3, 2.55, -2.48, 0, { type: 'toggleSound' });

  // =========================================================================
  // CHAMBER 1: GEODESIC COMPUTE SPIRE (Left) + 3D INTERACTIVE CODE WALL (Right)
  // =========================================================================
  const systemsObjPose = getScreenAlignedPose(0.19, 13.0, -3.9, -0.4);
  const systemsGroup = new THREE.Group();
  systemsGroup.position.copy(systemsObjPose.pos);
  scene.add(systemsGroup);
  violetLight.position.set(systemsObjPose.pos.x, 5.5, systemsObjPose.pos.z + 1.5);

  const systemsBlades: THREE.Object3D[] = [];
  const tierMaterials = [
    obsidianCarbonMat,
    iridescentTitaniumMat,
    prismaticAlloyMat,
    champagneGoldMat,
    emeraldAnodizedMat,
  ];
  for (let i = 0; i < 5; i++) {
    const scale = 1 - Math.abs(i - 2) * 0.16;
    const tierGroup = new THREE.Group();
    tierGroup.position.y = (i - 2) * 1.28;

    const rotor = new THREE.Mesh(
      trackGeo(createTurbineCrownGeometry(12, 0.65 * scale, 2.55 * scale, 0.16)),
      tierMaterials[i]
    );
    rotor.rotation.x = Math.PI / 2;
    tierGroup.add(rotor);

    const collarGear = new THREE.Mesh(
      trackGeo(createGearGeometry(24, 0.4 * scale, 0.68 * scale, 0.82 * scale, 0.24, 0)),
      i % 2 === 0 ? champagneGoldMat : roseCopperMat
    );
    collarGear.rotation.x = Math.PI / 2;
    tierGroup.add(collarGear);

    systemsGroup.add(tierGroup);
    systemsBlades.push(tierGroup);
  }

  // Central machined titanium drive shaft
  systemsGroup.add(
    new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.42, 7.2, 20)),
      iridescentTitaniumMat
    )
  );

  // Surrounding Geodesic Spire Truss Cage + Precision Outer Vernier Scale Ring
  const systemsCage = createGeodesicCage(
    3.65,
    1,
    geodesicCyanLineMat,
    roseCopperMat,
    trackGeo
  );
  systemsGroup.add(systemsCage);

  const systemsVernierRing = new THREE.Mesh(
    trackGeo(createVernierRingGeometry(40, 3.86, 4.18, 0.12)),
    iridescentTitaniumMat
  );
  systemsVernierRing.rotation.x = Math.PI / 2;
  systemsGroup.add(systemsVernierRing);
  systemsBlades.push(systemsVernierRing);

  // Grounding obsidian plinth & 3 structural anchor pylons into the wave floor
  const spirePlinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.1, 2.2, 0.55, 12)),
    obsidianCarbonMat
  );
  spirePlinth.position.y = -6.15;
  systemsGroup.add(spirePlinth);

  const spirePylonGeo = trackGeo(new THREE.BoxGeometry(0.26, 6.2, 0.42));
  for (let p = 0; p < 3; p++) {
    const a = (p / 3) * Math.PI * 2;
    const pylon = new THREE.Mesh(spirePylonGeo, obsidianCarbonMat);
    pylon.position.set(Math.cos(a) * 1.95, -3.55, Math.sin(a) * 1.95);
    pylon.rotation.y = -a;
    pylon.rotation.z = 0.24;
    systemsGroup.add(pylon);
  }

  // 120 Instanced Chromatic Prism Data Nodes in helical orbit
  const nodeCount = 120;
  const nodeMesh = new THREE.InstancedMesh(
    trackGeo(new THREE.OctahedronGeometry(0.16, 0)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.6, roughness: 0.2 })),
    nodeCount
  );
  for (let i = 0; i < nodeCount; i++) {
    const t = i / nodeCount;
    const angle = t * Math.PI * 10;
    const radius = 3.25 + Math.sin(t * Math.PI * 4) * 0.65;
    dummy.position.set(Math.cos(angle) * radius, (t - 0.5) * 6.4, Math.sin(angle) * radius);
    dummy.rotation.set(angle, t * Math.PI, 0);
    dummy.scale.setScalar(0.75 + (i % 4) * 0.22);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);

    tempColor.setHSL((t * 1.4) % 1.0, 0.88, 0.58);
    nodeMesh.setColorAt(i, tempColor);
  }
  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
  nodeMesh.computeBoundingSphere();
  systemsGroup.add(nodeMesh);

  // 6 Holographic TubeGeometry Fiber Conduits + luminous packets
  const neuralPackets: {
    mesh: THREE.Mesh;
    curve: THREE.CatmullRomCurve3;
    speed: number;
    offset: number;
  }[] = [];
  const packetGeo = trackGeo(new THREE.OctahedronGeometry(0.12, 1));
  for (let b = 0; b < 6; b++) {
    const pts: THREE.Vector3[] = [];
    const baseAngle = (b / 6) * Math.PI * 2;
    for (let s = 0; s <= 14; s++) {
      const frac = s / 14;
      const a = baseAngle + frac * Math.PI * 2.5;
      const r = 2.75 + Math.sin(frac * Math.PI) * 1.15;
      pts.push(new THREE.Vector3(Math.cos(a) * r, (frac - 0.5) * 6.4, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    systemsGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(curve, 56, 0.032, 8, false)),
        createTrackedHoloMat(b * 0.22, 'systems')
      )
    );
    const packet = new THREE.Mesh(packetGeo, whiteEmissiveMat);
    systemsGroup.add(packet);
    neuralPackets.push({ mesh: packet, curve, speed: 0.2 + b * 0.035, offset: b * 0.16 });
  }

  // Interactive 3D Systems Text & Code Plane
  const systemsTextData = createSystemsTextTexture(maxAniso, interactiveState.getDisciplineIdx);
  trackTex(systemsTextData.texture);
  const systemsPlaneW = 9.0;
  const systemsPlaneH = 6.15;
  const systemsTextPose = getScreenAlignedPose(0.19, 11.4, 2.95, 0.0);
  const systemsTextMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(systemsPlaneW, systemsPlaneH)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: systemsTextData.texture,
        color: pureTextColor,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );
  systemsTextMesh.position.copy(systemsTextPose.pos);
  systemsTextMesh.rotation.y = systemsTextPose.rotY;
  scene.add(systemsTextMesh);

  for (let i = 0; i < 4; i++) {
    const colCenterX = -systemsPlaneW / 2 + 1.12 + i * 2.12;
    const tabY = systemsPlaneH / 2 - 1.28;
    addHitProxy(systemsTextMesh, 2.0, 0.65, 0.3, colCenterX, tabY, 0, {
      type: 'discipline',
      index: i,
    });
  }

  // =========================================================================
  // CHAMBER 2: ARTICULATED HOLOGRAPHIC VAULT MONOLITHS
  // =========================================================================
  const projectsHeaderData = createProjectsHeaderTexture(maxAniso);
  trackTex(projectsHeaderData.texture);
  const projectsHdrPose = getScreenAlignedPose(0.285, 10.6, 0.0, 1.35);
  const projectsHeaderMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(11.4, 2.6)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: projectsHeaderData.texture,
        color: pureTextColor,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );
  projectsHeaderMesh.position.copy(projectsHdrPose.pos);
  projectsHeaderMesh.rotation.y = projectsHdrPose.rotY;
  scene.add(projectsHeaderMesh);

  const monoliths: ProjectMonolithHandle[] = [];

  const vaultChassisGeo = trackGeo(createVaultWingGeometry(6.35, 4.18, 0.34));
  const vaultChassisEdgesGeo = trackGeo(new THREE.EdgesGeometry(vaultChassisGeo, 24));
  const screenGeo = trackGeo(new THREE.PlaneGeometry(5.6, 3.5));
  const pistonRailGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 4.35, 12));
  const bracketGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.45, 0.56));
  const vaultGearGeo = trackGeo(createGearGeometry(32, 2.35, 2.65, 2.82, 0.14, 8));

  const monolithTrimMats = [
    iridescentTitaniumMat,
    champagneGoldMat,
    roseCopperMat,
    prismaticAlloyMat,
  ];

  PROJECTS.forEach((project, idx) => {
    const group = new THREE.Group();
    const mPose = getScreenAlignedPose(project.scrollStop, 9.8, 0.0, 0.0);
    const pos = mPose.pos;
    const baseRotY = mPose.rotY;
    group.position.copy(pos);
    group.rotation.y = baseRotY;
    scene.add(group);

    // Chamfered Obsidian Vault Frame + crisp chamfer rim edge trace
    const chassis = new THREE.Mesh(vaultChassisGeo, obsidianCarbonMat);
    chassis.castShadow = !isSoftwareGl;
    group.add(chassis);
    group.add(new THREE.LineSegments(vaultChassisEdgesGeo, geodesicCyanLineMat));

    // Front face (Visual + Title)
    const frontTex = trackTex(
      createProjectScreenTexture(
        project.id,
        project.index,
        project.title,
        project.category,
        project.accentHex,
        project.secondaryHex,
        maxAniso
      )
    );
    const frontScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: frontTex,
        emissiveMap: frontTex,
        emissive: new THREE.Color('#FFFFFF'),
        emissiveIntensity: 0.54,
        roughness: 0.22,
        metalness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const frontScreen = new THREE.Mesh(screenGeo, frontScreenMat);
    frontScreen.position.z = 0.23;
    group.add(frontScreen);

    // Back face (Code + Architecture)
    const backTex = trackTex(createProjectBackTexture(project, maxAniso));
    const backScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: backTex,
        emissiveMap: backTex,
        emissive: new THREE.Color('#FFFFFF'),
        emissiveIntensity: 0.58,
        roughness: 0.22,
        metalness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const backScreen = new THREE.Mesh(screenGeo, backScreenMat);
    backScreen.position.z = -0.23;
    backScreen.rotation.y = Math.PI;
    group.add(backScreen);

    // Side Piston Rails & Corner Gimbal Brackets
    const trimMat = monolithTrimMats[idx % monolithTrimMats.length];
    const leftPiston = new THREE.Mesh(pistonRailGeo, trimMat);
    leftPiston.position.x = -3.28;
    group.add(leftPiston);

    const rightPiston = new THREE.Mesh(pistonRailGeo, iridescentTitaniumMat);
    rightPiston.position.x = 3.28;
    group.add(rightPiston);

    const cornerOffsets = [
      [-3.05, 1.95],
      [3.05, 1.95],
      [-3.05, -1.95],
      [3.05, -1.95],
    ];
    cornerOffsets.forEach(([cx, cy]) => {
      const bracket = new THREE.Mesh(bracketGeo, trimMat);
      bracket.position.set(cx, cy, 0);
      bracket.rotation.z = Math.PI / 4;
      group.add(bracket);
    });

    // Rear Kinetic Gear Ring + Geodesic Stabilizer Cage
    const gearRing = new THREE.Mesh(vaultGearGeo, trimMat);
    gearRing.position.z = -0.85;
    group.add(gearRing);

    const cage = createGeodesicCage(3.15, 0, geodesicLineMat, trimMat, trackGeo);
    cage.position.z = -0.85;
    group.add(cage);

    const hitProxy = addHitProxy(group, 6.6, 4.4, 1.1, 0, 0, 0, {
      type: 'monolith',
      index: idx,
    });

    monoliths.push({
      project,
      group,
      hitProxy,
      gearRing,
      cage,
      frontScreenMat,
      backScreenMat,
      baseY: pos.y,
      baseRotY,
      targetRotY: baseRotY,
      flipped: false,
      phase: idx * 1.3,
    });
  });

  // =========================================================================
  // CHAMBER 3: CHROMATIC RESONANCE DYSON ARRAY (Right) + 3D CONSOLE (Left)
  // =========================================================================
  const shaderObjPose = getScreenAlignedPose(0.77, 12.6, 3.85, 0.0);
  const shaderLabGroup = new THREE.Group();
  shaderLabGroup.position.copy(shaderObjPose.pos);
  scene.add(shaderLabGroup);
  cyanLabLight.position.set(shaderObjPose.pos.x + 2.5, 5.5, shaderObjPose.pos.z + 2.5);

  const shaderLabMaterial = trackMat(createShaderLabMaterial());
  const shaderManifold = new THREE.Mesh(
    trackGeo(new THREE.IcosahedronGeometry(2.35, 5)),
    shaderLabMaterial
  );
  shaderLabGroup.add(shaderManifold);

  const shaderDysonParts: THREE.Object3D[] = [];

  // Dyson Gear Collar 1
  const dysonGear = new THREE.Mesh(
    trackGeo(createGearGeometry(36, 3.15, 3.45, 3.68, 0.16, 8)),
    iridescentTitaniumMat
  );
  dysonGear.rotation.x = Math.PI * 0.25;
  shaderLabGroup.add(dysonGear);
  shaderDysonParts.push(dysonGear);

  // Dyson Turbine Ring 2
  const dysonTurbine = new THREE.Mesh(
    trackGeo(createTurbineCrownGeometry(16, 2.85, 3.35, 0.14)),
    champagneGoldMat
  );
  dysonTurbine.rotation.y = Math.PI * 0.35;
  shaderLabGroup.add(dysonTurbine);
  shaderDysonParts.push(dysonTurbine);

  // Dyson Geodesic Containment Sphere
  const dysonCage = createGeodesicCage(
    4.1,
    1,
    geodesicCyanLineMat,
    roseCopperMat,
    trackGeo
  );
  shaderLabGroup.add(dysonCage);
  shaderDysonParts.push(dysonCage);

  // Dyson Rose-Copper Precision Vernier Scale Ring + Grounding Tripod Plinth
  const dysonVernier = new THREE.Mesh(
    trackGeo(createVernierRingGeometry(44, 3.82, 4.12, 0.14)),
    roseCopperMat
  );
  dysonVernier.rotation.set(Math.PI * 0.16, Math.PI * 0.28, 0);
  shaderLabGroup.add(dysonVernier);
  shaderDysonParts.push(dysonVernier);

  const dysonBasePlinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.85, 1.85, 0.5, 12)),
    obsidianCarbonMat
  );
  dysonBasePlinth.position.y = -6.55;
  shaderLabGroup.add(dysonBasePlinth);

  const dysonLegGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.14, 4.2, 8));
  for (let l = 0; l < 3; l++) {
    const a = (l / 3) * Math.PI * 2 + 0.4;
    const leg = new THREE.Mesh(dysonLegGeo, obsidianCarbonMat);
    leg.position.set(Math.cos(a) * 1.4, -4.65, Math.sin(a) * 1.4);
    leg.rotation.z = Math.cos(a) * 0.24;
    leg.rotation.x = -Math.sin(a) * 0.24;
    shaderLabGroup.add(leg);
  }

  // Twin Holographic Dyson Meridian Rings
  for (let m = 0; m < 2; m++) {
    const meridian = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(4.45 + m * 0.32, 0.035, 12, 96)),
      createTrackedHoloMat(m * 0.48, 'shaderLab')
    );
    meridian.rotation.set(m * 0.9, m * 1.2, 0);
    shaderLabGroup.add(meridian);
    shaderDysonParts.push(meridian);
  }

  const shaderTextData = createShaderLabTextTexture(maxAniso, interactiveState.getShaderState);
  trackTex(shaderTextData.texture);
  const shaderPlaneW = 8.6;
  const shaderPlaneH = 6.0;
  const shaderTextPose = getScreenAlignedPose(0.77, 11.0, -2.9, 0.0);
  const shaderTextMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(shaderPlaneW, shaderPlaneH)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: shaderTextData.texture,
        color: pureTextColor,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );
  shaderTextMesh.position.copy(shaderTextPose.pos);
  shaderTextMesh.rotation.y = shaderTextPose.rotY;
  scene.add(shaderTextMesh);

  const modeOrder: ShaderMode[] = ['harmonic', 'turbulence', 'lattice', 'orbital'];
  modeOrder.forEach((mode, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const bx = -shaderPlaneW / 2 + 1.95 + col * 3.88;
    const by = shaderPlaneH / 2 - 2.32 - row * 0.46;
    addHitProxy(shaderTextMesh, 3.55, 0.44, 0.3, bx, by, 0, { type: 'shaderMode', mode });
  });

  const freqY = shaderPlaneH / 2 - 4.75;
  const ampY = shaderPlaneH / 2 - 5.26;
  addHitProxy(shaderTextMesh, 0.95, 0.44, 0.3, -0.75, freqY, 0, { type: 'shaderFreq', delta: -0.3 });
  addHitProxy(shaderTextMesh, 0.95, 0.44, 0.3, 0.36, freqY, 0, { type: 'shaderFreq', delta: 0.3 });
  addHitProxy(shaderTextMesh, 0.95, 0.44, 0.3, -0.75, ampY, 0, { type: 'shaderAmp', delta: -0.05 });
  addHitProxy(shaderTextMesh, 0.95, 0.44, 0.3, 0.36, ampY, 0, { type: 'shaderAmp', delta: 0.05 });

  // =========================================================================
  // CHAMBER 4: GRAND KINETIC CELESTIAL ORRERY & 3D CONTACT TYPOGRAPHY
  // =========================================================================
  const horizonObjPose = getScreenAlignedPose(0.99, 20.6, 0.0, 0.0);
  const horizonGroup = new THREE.Group();
  horizonGroup.position.copy(horizonObjPose.pos);
  scene.add(horizonGroup);
  horizonLight.position.set(horizonObjPose.pos.x, 5.5, horizonObjPose.pos.z + 9.0);

  const horizonParts: THREE.Object3D[] = [];

  const orreryOuterGear = new THREE.Mesh(
    trackGeo(createGearGeometry(60, 7.2, 7.75, 8.05, 0.22, 12)),
    iridescentTitaniumMat
  );
  horizonGroup.add(orreryOuterGear);
  horizonParts.push(orreryOuterGear);

  const orreryTurbine = new THREE.Mesh(
    trackGeo(createTurbineCrownGeometry(24, 5.4, 6.25, 0.18)),
    champagneGoldMat
  );
  orreryTurbine.rotation.x = Math.PI * 0.22;
  horizonGroup.add(orreryTurbine);
  horizonParts.push(orreryTurbine);

  const orreryGeodesic = createGeodesicCage(
    4.65,
    1,
    geodesicLineMat,
    roseCopperMat,
    trackGeo
  );
  horizonGroup.add(orreryGeodesic);
  horizonParts.push(orreryGeodesic);

  // Central Iridescent Prism Planetary Core inside Celestial Orrery
  const orreryCore = new THREE.Mesh(
    trackGeo(new THREE.IcosahedronGeometry(1.45, 3)),
    prismCoreMaterial
  );
  horizonGroup.add(orreryCore);
  horizonParts.push(orreryCore);

  const orreryVernier = new THREE.Mesh(
    trackGeo(createVernierRingGeometry(64, 6.45, 6.82, 0.16)),
    champagneGoldMat
  );
  orreryVernier.rotation.set(Math.PI * 0.14, -Math.PI * 0.18, 0);
  horizonGroup.add(orreryVernier);
  horizonParts.push(orreryVernier);

  const orreryHalo = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(6.8, 0.045, 14, 120)),
    createTrackedHoloMat(0.35, 'horizon')
  );
  orreryHalo.rotation.y = Math.PI * 0.25;
  horizonGroup.add(orreryHalo);
  horizonParts.push(orreryHalo);

  // Orbiting Prism Asteroids & Telemetry Relays on the Orrery (48 faceted bodies)
  const satCount = 48;
  const satMesh = new THREE.InstancedMesh(
    trackGeo(new THREE.OctahedronGeometry(0.24, 0)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.78, roughness: 0.14 })),
    satCount
  );
  for (let s = 0; s < satCount; s++) {
    const a = (s / satCount) * Math.PI * 2;
    const orbitR = 6.2 + (s % 4) * 0.42;
    dummy.position.set(
      Math.cos(a) * orbitR,
      Math.sin(a * 3) * 1.45,
      Math.sin(a) * orbitR
    );
    dummy.rotation.set(a, a * 0.5, a * 0.25);
    dummy.scale.setScalar(0.65 + (s % 4) * 0.24);
    dummy.updateMatrix();
    satMesh.setMatrixAt(s, dummy.matrix);
    tempColor.setHSL(s / satCount, 0.9, 0.6);
    satMesh.setColorAt(s, tempColor);
  }
  satMesh.instanceMatrix.needsUpdate = true;
  if (satMesh.instanceColor) satMesh.instanceColor.needsUpdate = true;
  satMesh.computeBoundingSphere();
  horizonGroup.add(satMesh);
  horizonParts.push(satMesh);

  const contactTextData = createContactTextTexture(maxAniso, interactiveState.getEmailCopied);
  trackTex(contactTextData.texture);
  const contactPlaneW = 10.6;
  const contactPlaneH = 5.75;
  const contactTextPose = getScreenAlignedPose(0.99, 10.8, 0.0, 0.0);
  const contactTextMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(contactPlaneW, contactPlaneH)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: contactTextData.texture,
        color: pureTextColor,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );
  contactTextMesh.position.copy(contactTextPose.pos);
  contactTextMesh.rotation.y = contactTextPose.rotY;
  scene.add(contactTextMesh);

  addHitProxy(contactTextMesh, 5.4, 0.9, 0.3, 0, -0.34, 0, { type: 'copyEmail' });
  addHitProxy(contactTextMesh, 2.3, 0.72, 0.3, -2.65, -1.5, 0, {
    type: 'openUrl',
    url: 'https://github.com',
  });
  addHitProxy(contactTextMesh, 2.3, 0.72, 0.3, 0, -1.5, 0, {
    type: 'openUrl',
    url: 'https://linkedin.com',
  });
  addHitProxy(contactTextMesh, 2.7, 0.72, 0.3, 2.65, -1.5, 0, { type: 'scrollToTop' });

  // =========================================================================
  // ORBITAL SATELLITES, RELAY DRONES & SWEEPING CORRIDOR CONDUITS
  // =========================================================================
  const satBusGeo = trackGeo(new THREE.OctahedronGeometry(0.44, 0));
  const satWingGeo = trackGeo(new THREE.BoxGeometry(1.75, 0.04, 0.58));
  const satStrutGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 4.1, 8));
  satStrutGeo.rotateZ(Math.PI / 2);
  const satGyroGeo = trackGeo(new THREE.TorusGeometry(0.86, 0.025, 8, 36));
  const satDishGeo = trackGeo(new THREE.ConeGeometry(0.32, 0.24, 14, 1, true));
  const satCoreBeaconGeo = trackGeo(new THREE.SphereGeometry(0.14, 10, 10));

  const satPlacements: [number, number, number, number][] = [
    [-9.5, 4.8, -8.5, 1.1],
    [11.8, 3.6, -12.0, 1.25],
    [-11.0, -1.4, -22.0, 0.95],
    [13.0, 5.4, -29.0, 1.15],
    [0.5, 7.2, -38.0, 1.3],
    [-13.5, 4.4, -52.0, 1.1],
    [13.5, 5.6, -64.0, 1.2],
    [-13.2, -0.8, -77.0, 0.95],
    [13.8, 4.6, -92.0, 1.25],
    [-12.5, 5.8, -106.0, 1.15],
    [11.5, 4.2, -118.0, 1.0],
    [-11.8, 4.8, -135.0, 1.3],
    [12.4, 5.8, -145.0, 1.2],
    [-9.2, 6.2, -158.0, 1.1],
    [10.2, -1.2, -162.0, 1.0],
    [0.0, 8.0, -138.0, 1.35],
  ];

  const satellites: SatelliteHandle[] = [];
  const satHoloMat = createTrackedHoloMat(0.2, 'projects');
  const solarPanelTex = trackTex(createSolarPanelTexture());
  solarPanelTex.anisotropy = Math.min(8, maxAniso);
  const solarWingMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#B8D8FF',
      map: solarPanelTex,
      metalness: 0.72,
      roughness: 0.18,
      iridescence: 1.0,
      iridescenceIOR: 1.65,
      iridescenceThicknessRange: [240, 720],
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    })
  );
  const satWingMats = [solarWingMat, prismaticAlloyMat, solarWingMat, iridescentTitaniumMat];

  satPlacements.forEach(([sx, sy, sz, scl], idx) => {
    const group = new THREE.Group();
    group.position.set(sx, sy, sz);
    group.scale.setScalar(scl);
    group.rotation.set(idx * 0.25, idx * 0.65, (idx % 2 === 0 ? 1 : -1) * 0.18);
    scene.add(group);

    // Obsidian faceted satellite chassis
    group.add(new THREE.Mesh(satBusGeo, obsidianCarbonMat));

    // Twin solar/radiator wing assembly
    const wings = new THREE.Group();
    wings.add(new THREE.Mesh(satStrutGeo, champagneGoldMat));

    const wingMat = satWingMats[idx % satWingMats.length];
    const leftWing = new THREE.Mesh(satWingGeo, wingMat);
    leftWing.position.x = -1.35;
    wings.add(leftWing);

    const rightWing = new THREE.Mesh(satWingGeo, wingMat);
    rightWing.position.x = 1.35;
    wings.add(rightWing);
    group.add(wings);

    // Spinning geodesic gyro ring
    const gyroRing = new THREE.Mesh(satGyroGeo, champagneGoldMat);
    gyroRing.rotation.x = Math.PI * 0.35;
    group.add(gyroRing);

    // Holographic telemetry dish + glowing core beacon
    const dish = new THREE.Mesh(satDishGeo, satHoloMat);
    dish.position.y = -0.52;
    dish.rotation.x = Math.PI;
    group.add(dish);

    const beacon = new THREE.Mesh(satCoreBeaconGeo, whiteEmissiveMat);
    beacon.position.y = 0.52;
    group.add(beacon);

    satellites.push({
      group,
      gyroRing,
      wings,
      basePos: new THREE.Vector3(sx, sy, sz),
      phase: idx * 0.85,
      orbitAmp: 0.45 + (idx % 3) * 0.22,
      speed: 0.42 + (idx % 4) * 0.14,
    });
  });

  // 3 Sweeping Holographic Orbital Conduits flanking the S-curve canyon
  for (let lane = 0; lane < 3; lane++) {
    const xSign = lane === 0 ? -1 : lane === 1 ? 1 : 0;
    const yBase = lane === 2 ? 7.8 : -2.2 + lane * 1.4;
    const lanePts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const z = 8 - k * 18.5;
      const sway = Math.sin(k * 0.95 + lane * 1.4) * 5.5 + xSign * 12.5;
      lanePts.push(new THREE.Vector3(sway, yBase + Math.cos(k * 0.8 + lane) * 1.8, z));
    }
    const laneCurve = new THREE.CatmullRomCurve3(lanePts);
    scene.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(laneCurve, 140, 0.032, 6, false)),
        createTrackedHoloMat(lane * 0.33, 'projects')
      )
    );
  }

  // 300 Instanced Relay Shards framing the serpentine canyon walls
  const shardCount = 300;
  const shardMesh = new THREE.InstancedMesh(
    trackGeo(new THREE.TetrahedronGeometry(0.18, 0)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.72, roughness: 0.22 })),
    shardCount
  );
  for (let i = 0; i < shardCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = 12 - (i / shardCount) * 195;
    const lateral = side * (9.5 + (i % 7) * 2.2) + Math.sin(z * 0.06) * 3.5;
    const elev = -3.2 + ((i * 1.7) % 11.5);
    dummy.position.set(lateral, elev, z);
    dummy.rotation.set(i * 0.3, i * 0.7, i * 0.2);
    dummy.scale.setScalar(0.6 + (i % 4) * 0.35);
    dummy.updateMatrix();
    shardMesh.setMatrixAt(i, dummy.matrix);
    tempColor.setHSL((i * 0.137) % 1.0, 0.78, 0.54);
    shardMesh.setColorAt(i, tempColor);
  }
  shardMesh.instanceMatrix.needsUpdate = true;
  if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  shardMesh.computeBoundingSphere();
  scene.add(shardMesh);

  // 4 Towering Open-Center Geodesic S-Curve Gateways framing the flight corridor
  const gateways: THREE.Group[] = [];
  const gatewayStatorGeo = trackGeo(createTurbineCrownGeometry(16, 7.6, 8.95, 0.34));
  const gatewayVernierGeo = trackGeo(createVernierRingGeometry(48, 7.15, 7.55, 0.18));
  const gatewayHoloGeo = trackGeo(new THREE.TorusGeometry(7.05, 0.04, 10, 96));
  const gatewayButtressGeo = trackGeo(new THREE.BoxGeometry(0.65, 9.5, 0.85));
  const gatewayTValues = [0.095, 0.275, 0.705, 0.895];
  const gatewayChambers: ChamberKey[] = ['hero', 'systems', 'shaderLab', 'horizon'];

  gatewayTValues.forEach((tVal, idx) => {
    const pos = cameraCurve.getPointAt(tVal);
    const tangent = cameraCurve.getTangentAt(tVal).normalize();
    const gw = new THREE.Group();
    gw.position.copy(pos);
    gw.lookAt(pos.clone().add(tangent));
    scene.add(gw);

    gw.add(new THREE.Mesh(gatewayStatorGeo, obsidianCarbonMat));
    gw.add(
      new THREE.Mesh(
        gatewayVernierGeo,
        idx % 2 === 0 ? iridescentTitaniumMat : champagneGoldMat
      )
    );
    gw.add(
      new THREE.Mesh(
        gatewayHoloGeo,
        createTrackedHoloMat(idx * 0.25, gatewayChambers[idx])
      )
    );

    // Twin vertical obsidian buttresses rooting the archway toward the wave floor
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(gatewayButtressGeo, obsidianCarbonMat);
      leg.position.set(side * 7.85, -4.6, 0);
      gw.add(leg);
    }
    gateways.push(gw);
  });

  const redrawAllStaticText = () => {
    heroTextData.redraw();
    systemsTextData.redraw();
    projectsHeaderData.redraw();
    shaderTextData.redraw();
    contactTextData.redraw();
  };

  return {
    cameraCurve,
    lookAtCurve,
    heroCoreGroup,
    heroKineticParts,
    heroPinions,
    heroTextMesh,
    prismCoreMaterial,
    hologramMaterials,
    chamberHoloMaterials,
    chamberLights: {
      hero: emeraldLight,
      systems: violetLight,
      projects: amberRimLight,
      shaderLab: cyanLabLight,
      horizon: horizonLight,
    },
    systemsGroup,
    systemsBlades,
    systemsCage,
    systemsTextMesh,
    neuralPackets,
    projectsHeaderMesh,
    monoliths,
    shaderLabGroup,
    shaderManifold,
    shaderLabMaterial,
    shaderDysonParts,
    shaderTextMesh,
    horizonGroup,
    horizonParts,
    contactTextMesh,
    satellites,
    gateways,
    prismDustMaterial,
    waveFloorMaterial,
    voidBackdropMaterial,
    starfield,
    hitTargets,
    redrawHeroText: heroTextData.redraw,
    redrawSystemsText: systemsTextData.redraw,
    redrawShaderText: shaderTextData.redraw,
    redrawContactText: contactTextData.redraw,
    redrawAllStaticText,
    disposables: { geometries, materials, textures },
  };
}
