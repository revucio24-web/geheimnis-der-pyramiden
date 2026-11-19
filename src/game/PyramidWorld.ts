import * as THREE from 'three';
import { soundEngine } from './audio';
import {
  BrazierRef,
  MaterialLibrary,
  MummyRig,
  createAnubisStatueModel,
  createBrazierModel,
  createClayUrnModel,
  createCrackedWallModel,
  createMaterialLibrary,
  createMummyModel,
  createPendulumTrapModel,
  createPuzzlePillarModel,
  createSarcophagusModel,
  createSolarMirrorModel,
  createSpikeTrapModel,
  createStoneTabletModel,
  createTorchWeaponModel,
  createTreasureChestModel,
  createTreasureRelicModel,
} from './models';
import { ZONE_NAMES } from './story';
import { ProceduralTextureSet, createProceduralTextures } from './textures';
import { AABB, GamePhase, HieroglyphSymbol, HudSnapshot, ZoneId } from './types';

interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  getPrompt: () => string | null;
  onInteract: () => void;
}

interface TreasureItem {
  id: string;
  name: string;
  goldValue: number;
  healAmount: number;
  isFinalCrown?: boolean;
  isChest?: boolean;
  group: THREE.Group;
  floatingPart?: THREE.Group;
  lid?: THREE.Group;
  collected: boolean;
}

interface MummyEntity {
  id: string;
  isBoss: boolean;
  rig: MummyRig;
  homePos: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  stunTimer: number;
  attackCooldown: number;
  hurtTimer: number;
  alive: boolean;
  walkPhase: number;
  awakened: boolean;
}

interface SpikeTrapEntity {
  group: THREE.Group;
  spears: THREE.Group;
  position: THREE.Vector3;
  phaseOffset: number;
  extended: boolean;
}

interface PendulumTrapEntity {
  group: THREE.Group;
  pivot: THREE.Group;
  position: THREE.Vector3;
  phaseOffset: number;
  bladeWorldPos: THREE.Vector3;
}

interface FloorPlateEntity {
  symbol: HieroglyphSymbol;
  label: string;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  active: boolean;
}

interface ClayUrnEntity {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  collider: AABB;
  goldValue: number;
  healAmount: number;
  broken: boolean;
}

interface ParticleShard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

// Reusable scratch math objects (Zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

const PILLAR_SYMBOLS: [HieroglyphSymbol, HieroglyphSymbol, HieroglyphSymbol, HieroglyphSymbol] = [
  'falke',
  'skarabaeus',
  'ankh',
  'auge',
];
const PILLAR_NAMES: Record<HieroglyphSymbol, string> = {
  falke: 'Falke',
  skarabaeus: 'Skarabäus',
  ankh: 'Ankh',
  auge: 'Auge',
  lotus: 'Lotus',
  schlange: 'Schlange',
  sonne: 'Sonne',
};

export class PyramidWorld {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private mats: MaterialLibrary;
  private onHudUpdate: (hud: HudSnapshot) => void;

  private frameId = 0;
  private timer = new THREE.Timer();
  private disposed = false;
  private envTexture: THREE.Texture | null = null;

  // Game State
  private phase: GamePhase = 'title';
  private health = 100;
  private maxHealth = 100;
  private solarEnergy = 100;
  private maxSolarEnergy = 100;
  private gold = 0;
  private treasuresFound = 0;
  private totalTreasures = 0;
  private secretsFound = 0;
  private totalSecrets = 2;
  private puzzlesSolved = 0;
  private totalPuzzles = 3;
  private mummiesDefeated = 0;
  private elapsedSeconds = 0;
  private unlockedStories = new Set<string>(['prologue']);
  private activeStoryModalId: string | null = null;
  private bannerMessage: string | null = null;
  private bannerTimer = 0;
  private hurtFlash = 0;
  private invulnTimer = 0;
  private solarFlashTimer = 0;

  // Map Discovery & Checkpoints
  private visitedZones = new Set<ZoneId>(['forecourt']);
  private lastZoneId: ZoneId = 'forecourt';
  private checkpointPos: THREE.Vector3 | null = null;
  private checkpointYaw = 0;
  private checkpointZoneName: string | null = null;
  private unlockedCheckpoints = new Set<ZoneId>();

  // Player Physics & Controls
  private playerPos = new THREE.Vector3(0, 0, 18.5);
  private playerVelY = 0;
  private isGrounded = true;
  private yaw = 0;
  private pitch = -0.04;
  private keys = new Set<string>();
  private pointerLocked = false;
  private isDraggingLook = false;
  private dragDistance = 0;
  private lockRequestClick = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activeTouchId: number | null = null;
  private lookSensitivity = 1.0;
  private invertY = false;
  private stepDistAccum = 0;
  private walkBobPhase = 0;
  private cameraTremor = 0;
  private reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private torchSwingTimer = 0;
  private playerTorchLight: THREE.PointLight;
  private torchViewModel: { group: THREE.Group; flame: THREE.Mesh };
  private solarFlashLight: THREE.PointLight;

  // World Geometry & Dynamic Entities
  private colliders: AABB[] = [];
  private interactables: Interactable[] = [];
  private treasures: TreasureItem[] = [];
  private mummies: MummyEntity[] = [];
  private braziers: BrazierRef[] = [];
  private spikeTraps: SpikeTrapEntity[] = [];
  private pendulumTraps: PendulumTrapEntity[] = [];
  private clayUrns: ClayUrnEntity[] = [];
  private particlePool: ParticleShard[] = [];
  private dustPoints!: THREE.Points;

  // Boss Shockwave Attack Telegraph
  private bossWaveRing!: THREE.Mesh;
  private bossWaveCore!: THREE.Mesh;
  private bossWaveCooldown = 3.5;
  private bossWaveTelegraph = 0;
  private bossWaveActive = false;
  private bossWaveRadius = 0;
  private bossWaveHitThisCast = false;

  // Puzzle 1: 3 Rotating Pillars + Gate 1
  private puzzle1Drums: THREE.Group[] = [];
  private puzzle1States: [number, number, number] = [1, 2, 0]; // Target: [0, 1, 2] -> Falke, Skarabäus, Ankh
  private puzzle1Solved = false;
  private gate1Mesh!: THREE.Mesh;
  private gate1Collider!: AABB;

  // Secret Room 1 (Zone 2) & Secret Room 2 (Zone 3 Cracked Wall)
  private secretOpened = false;
  private secretDoorMesh!: THREE.Mesh;
  private secretDoorCollider!: AABB;
  private secret2Opened = false;
  private secret2WallGroup!: THREE.Group;
  private secret2Collider!: AABB;
  private secret2Pos = new THREE.Vector3(-14.2, 1.5, -56.5);

  // Puzzle 2: 4 Floor Plates + Bridge + Gate 2
  private floorPlates: FloorPlateEntity[] = [];
  private puzzle2Order: HieroglyphSymbol[] = ['lotus', 'schlange', 'sonne', 'falke'];
  private puzzle2Progress = 0;
  private puzzle2Solved = false;
  private plateTouchCooldown = 0;
  private bridgeMesh!: THREE.Mesh;
  private chasmBridgeCollider!: AABB;
  private gate2Mesh!: THREE.Mesh;
  private gate2Collider!: AABB;

  // Puzzle 3: 2 Solar Mirrors + Sanctum Prism + Barrier
  private mirrors: { yoke: THREE.Group; beam: THREE.Mesh; step: number; targetStep: number; targetAngle: number }[] = [];
  private puzzle3Solved = false;
  private sanctumPrism!: THREE.Object3D;
  private sanctumBarrierMesh!: THREE.Mesh;
  private sanctumBarrierCollider!: AABB;
  private crownRelicItem: TreasureItem | null = null;

  private lastHudEmit = 0;
  private playerRadius = 0.42;
  private eyeHeight = 1.68;

  constructor(
    container: HTMLElement,
    onHudUpdate: (hud: HudSnapshot) => void,
    isSoftwareGl: boolean,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = isSoftwareGl;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x16110c);
    this.scene.fog = new THREE.FogExp2(0x16110c, 0.028);

    this.camera = new THREE.PerspectiveCamera(
      68,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      140,
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // 3. Textures & PBR Materials
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.mats = createMaterialLibrary(this.textures, isSoftwareGl);

    // 4. Environment Reflection & 3-Point Warm/Cool Lighting Rig
    this.setupLightingAndEnv();

    // 5. Handheld Explorer Torch + Light
    this.playerTorchLight = new THREE.PointLight(0xff9f45, 7.5, 17, 1.45);
    this.playerTorchLight.position.set(0.28, -0.1, -0.35);
    this.camera.add(this.playerTorchLight);

    this.solarFlashLight = new THREE.PointLight(0xfff0b3, 0, 26, 1.2);
    this.camera.add(this.solarFlashLight);

    this.torchViewModel = createTorchWeaponModel(this.mats);
    this.torchViewModel.group.position.set(0.32, -0.28, -0.38);
    this.camera.add(this.torchViewModel.group);

    // 6. Build Entire Pyramid World + Particle Pool & Boss Telegraph
    this.buildWorld();
    this.initParticlePool();
    this.initBossShockwave();

    // 7. Pre-compile shaders on GPU
    if (!isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 8. Bind Events
    this.bindEvents();
    // Page-Visibility-aware timing: hidden tabs don't accumulate phantom delta.
    this.timer.connect(document);

    // 9. Start Loop
    this.syncCamera();
    this.emitHud(true);
    this.tick();
  }

  private setupLightingAndEnv(): void {
    // Procedural Studio Environment (RoomEnvironment)
    import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
      if (this.disposed) return;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envTexture = pmrem.fromScene(room, 0.04).texture;
      this.scene.environment = this.envTexture;
      room.dispose();
      pmrem.dispose();
    });

    // Warm/Cool Hemisphere fill
    const hemi = new THREE.HemisphereLight(0x6d8aa6, 0x3b2816, 0.72);
    this.scene.add(hemi);

    // Golden desert sun Key Light streaming into the forecourt & pyramid portal
    const sunKey = new THREE.DirectionalLight(0xffdfb0, 2.35);
    sunKey.position.set(16, 28, 26);
    sunKey.castShadow = !this.isSoftwareGl;
    sunKey.shadow.mapSize.set(2048, 2048);
    sunKey.shadow.camera.near = 2;
    sunKey.shadow.camera.far = 85;
    sunKey.shadow.camera.left = -26;
    sunKey.shadow.camera.right = 26;
    sunKey.shadow.camera.top = 26;
    sunKey.shadow.camera.bottom = -26;
    sunKey.shadow.bias = -0.0005;
    sunKey.shadow.normalBias = 0.02;
    this.scene.add(sunKey);

    // Cool Rim Light from north for silhouette depth
    const rim = new THREE.DirectionalLight(0x4b7499, 0.55);
    rim.position.set(-14, 18, -40);
    this.scene.add(rim);
  }

  private addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    collide = true,
    castShadow = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = castShadow;
    this.scene.add(mesh);

    if (collide) {
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        active: true,
      });
    }
    return mesh;
  }

  private addBrazier(x: number, z: number, withLight = true): void {
    const b = createBrazierModel(this.mats, withLight);
    b.group.position.set(x, 0, z);
    this.scene.add(b.group);
    this.braziers.push(b);
  }

  private addStoryTablet(id: string, x: number, z: number, rotY: number, promptLabel: string): void {
    const tablet = createStoneTabletModel(this.mats);
    tablet.position.set(x, 0, z);
    tablet.rotation.y = rotY;
    this.scene.add(tablet);

    this.colliders.push({
      minX: x - 0.55,
      maxX: x + 0.55,
      minZ: z - 0.35,
      maxZ: z + 0.35,
      active: true,
    });

    this.interactables.push({
      id: `tablet_${id}`,
      position: new THREE.Vector3(x, 1.1, z),
      radius: 3.1,
      getPrompt: () => `[E] ${promptLabel} lesen`,
      onInteract: () => {
        this.unlockedStories.add(id);
        this.activeStoryModalId = id;
        this.exitPointerLock();
        soundEngine.playPuzzleTurn();
        this.emitHud(true);
      },
    });
  }

  private addTreasure(
    id: string,
    name: string,
    kind: 'scarab' | 'chalice' | 'eye' | 'crown' | 'chest',
    x: number,
    z: number,
    goldValue: number,
    healAmount = 0,
    isFinalCrown = false,
  ): TreasureItem {
    this.totalTreasures += 1;

    let item: TreasureItem;
    if (kind === 'chest') {
      const { group, lid } = createTreasureChestModel(this.mats);
      group.position.set(x, 0, z);
      this.scene.add(group);
      item = {
        id,
        name,
        goldValue,
        healAmount,
        isChest: true,
        group,
        lid,
        collected: false,
      };
    } else {
      const { group, floatingPart } = createTreasureRelicModel(this.mats, kind);
      group.position.set(x, 0, z);
      this.scene.add(group);
      item = {
        id,
        name,
        goldValue,
        healAmount,
        isFinalCrown,
        group,
        floatingPart,
        collected: false,
      };
    }

    this.treasures.push(item);

    this.interactables.push({
      id: `treasure_${id}`,
      position: new THREE.Vector3(x, 1.1, z),
      radius: 2.9,
      getPrompt: () => {
        if (item.collected) return null;
        if (isFinalCrown && !this.puzzle3Solved) {
          return 'Sonnenbarriere aktiv — Richte beide Spiegel auf den Kristall!';
        }
        return item.isChest ? `[E] ${name} öffnen` : `[E] ${name} bergen`;
      },
      onInteract: () => {
        if (item.collected) return;
        if (isFinalCrown && !this.puzzle3Solved) {
          this.showBanner('Die goldene Barriere blockiert die Krone! Richte die beiden Sonnenspiegel aus.');
          return;
        }
        item.collected = true;
        this.treasuresFound += 1;
        this.gold += item.goldValue;
        if (item.healAmount > 0) {
          this.health = Math.min(this.maxHealth, this.health + item.healAmount);
        }
        if (item.floatingPart) {
          item.floatingPart.visible = false;
        }
        if (item.lid) {
          item.lid.rotation.x = -Math.PI * 0.55;
        }
        soundEngine.playTreasure();
        this.showBanner(
          `${name} geborgen (+${item.goldValue} Gold${item.healAmount ? `, +${item.healAmount} Lebenskraft` : ''})`,
        );

        if (isFinalCrown) {
          this.phase = 'victory';
          this.exitPointerLock();
        }
        this.emitHud(true);
      },
    });

    return item;
  }

  private buildWorld(): void {
    // --- OUTER DESERT & STEPPED PYRAMID EXTERIOR ---
    const desertFloor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.mats.sand);
    desertFloor.rotation.x = -Math.PI / 2;
    desertFloor.position.y = -0.02;
    desertFloor.receiveShadow = true;
    this.scene.add(desertFloor);

    // Forecourt Paved Walkway (x: -9..9, z: 10..26)
    const forecourtFloor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 17), this.mats.floorTile);
    forecourtFloor.position.set(0, -0.04, 18);
    forecourtFloor.receiveShadow = true;
    this.scene.add(forecourtFloor);

    // Natural perimeter sand dunes / rocky outcrops around the forecourt (no boxy void!)
    const rockAngles = 24;
    for (let i = 0; i < rockAngles; i++) {
      const a = (i / rockAngles) * Math.PI; // southern semicircle
      const dist = 28 + (i % 3) * 6;
      const rx = Math.cos(a) * dist;
      const rz = 12 + Math.sin(a) * dist;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.6 + (i % 4) * 1.1, 0),
        i % 2 === 0 ? this.mats.sandstone : this.mats.sand,
      );
      rock.position.set(rx, 0.6, rz);
      rock.scale.set(1.6, 0.75, 1.3);
      rock.rotation.y = i * 0.7;
      this.scene.add(rock);
    }

    // Forecourt boundary collisions (keep player inside forecourt/temple area)
    this.colliders.push({ minX: -10.8, maxX: -10.0, minZ: 10, maxZ: 27, active: true });
    this.colliders.push({ minX: 10.0, maxX: 10.8, minZ: 10, maxZ: 27, active: true });
    this.colliders.push({ minX: -10.8, maxX: 10.8, minZ: 26, maxZ: 27, active: true });
    // Seal the desert gaps beside the entrance pylons so the forecourt stays fully
    // enclosed — prevents out-of-bounds walking around the pyramid exterior.
    this.colliders.push({ minX: 10.4, maxX: 60, minZ: 9.2, maxZ: 10.8, active: true });
    this.colliders.push({ minX: -60, maxX: -10.4, minZ: 9.2, maxZ: 10.8, active: true });

    // Monumental Stepped Pyramid Facade rising above z = 10..-25
    this.addBox(0, 10.5, -6, 34, 8, 32, this.mats.sandstone, false, true);
    this.addBox(0, 17.5, -8, 25, 6, 24, this.mats.sandstone, false, true);
    this.addBox(0, 23, -10, 16, 5, 16, this.mats.sandstone, false, true);
    const pyramidion = new THREE.Mesh(new THREE.ConeGeometry(6.5, 5.5, 4), this.mats.brushedGold);
    pyramidion.position.set(0, 28.2, -10);
    pyramidion.rotation.y = Math.PI / 4;
    this.scene.add(pyramidion);

    // Entrance Pylons & Portal Frame at z = 10 (Doorway x: -2.4..2.4)
    this.addBox(-6.5, 3.25, 10, 8.2, 6.5, 1.2, this.mats.hieroglyphWall, true, true);
    this.addBox(6.5, 3.25, 10, 8.2, 6.5, 1.2, this.mats.hieroglyphWall, true, true);
    this.addBox(0, 5.6, 10, 5.2, 1.8, 1.4, this.mats.sandstone, false, true);

    // Twin Forecourt Obelisks
    for (const sx of [-5.2, 5.2]) {
      const ob = new THREE.Group();
      ob.position.set(sx, 0, 14.2);
      const obBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), this.mats.sandstone);
      obBase.position.y = 0.35;
      const obShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.54, 5.4, 4), this.mats.obsidian);
      obShaft.position.y = 3.4;
      obShaft.rotation.y = Math.PI / 4;
      obShaft.castShadow = true;
      const obTip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 4), this.mats.brushedGold);
      obTip.position.y = 6.5;
      obTip.rotation.y = Math.PI / 4;
      ob.add(obBase, obShaft, obTip);
      this.scene.add(ob);
      this.colliders.push({ minX: sx - 0.7, maxX: sx + 0.7, minZ: 13.5, maxZ: 14.9, active: true });
    }
    this.addBrazier(-3.2, 11.8, true);
    this.addBrazier(3.2, 11.8, true);
    this.addStoryTablet('prologue', 3.0, 15.5, -0.35, 'Expeditionstafel');

    // --- ZONE 1: VORHALLE DES RA (x: -9..9, z: -10..10, h: 6.5) ---
    this.addBox(0, -0.1, 0, 18.4, 0.2, 20.4, this.mats.floorTile, false);
    this.addBox(0, 6.6, 0, 18.4, 0.3, 20.4, this.mats.sandstone, false);
    this.addBox(-9.3, 3.25, 0, 0.6, 6.5, 20.4, this.mats.hieroglyphWall, true);
    this.addBox(9.3, 3.25, 0, 0.6, 6.5, 20.4, this.mats.hieroglyphWall, true);

    // North wall of Zone 1 with doorway gap x: -2.2..2.2
    this.addBox(-5.7, 3.25, -10, 7.0, 6.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(5.7, 3.25, -10, 7.0, 6.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(0, 5.5, -10, 4.6, 2.0, 0.8, this.mats.sandstone, false);

    // Gate 1 (sliding granite door)
    this.gate1Mesh = this.addBox(0, 2.25, -10, 4.4, 4.5, 0.55, this.mats.obsidian, false, true);
    this.gate1Collider = { minX: -2.2, maxX: 2.2, minZ: -10.35, maxZ: -9.65, active: true };
    this.colliders.push(this.gate1Collider);

    // 4 Pillars in Entrance Hall
    for (const [px, pz] of [
      [-5.8, 4.2],
      [5.8, 4.2],
      [-5.8, -1.5],
      [5.8, -1.5],
    ]) {
      this.addBox(px, 3.25, pz, 1.3, 6.5, 1.3, this.mats.sandstone, true, true);
    }
    this.addBrazier(-3.6, 6.8, false);
    this.addBrazier(3.6, 6.8, false);
    this.addBrazier(-3.6, -7.2, true);
    this.addBrazier(3.6, -7.2, false);

    // Stele der Ma'at (Riddle 1 Clue)
    this.addStoryTablet('stele_hall', 0, 2.8, 0, 'Stele der Ma’at');

    // Puzzle 1: 3 Rotating Hieroglyph Pillars
    const p1Xs = [-4.2, 0, 4.2];
    p1Xs.forEach((px, idx) => {
      const { group, drum } = createPuzzlePillarModel(this.mats, this.textures, PILLAR_SYMBOLS);
      group.position.set(px, 0, -4.5);
      drum.rotation.y = -this.puzzle1States[idx] * (Math.PI / 2);
      this.scene.add(group);
      this.puzzle1Drums.push(drum);

      this.colliders.push({ minX: px - 0.65, maxX: px + 0.65, minZ: -5.15, maxZ: -3.85, active: true });

      this.interactables.push({
        id: `pillar_${idx}`,
        position: new THREE.Vector3(px, 1.25, -4.5),
        radius: 2.8,
        getPrompt: () => {
          if (this.puzzle1Solved) return 'Siegel bereits gelöst';
          const currentSym = PILLAR_NAMES[PILLAR_SYMBOLS[this.puzzle1States[idx]]];
          return `[E] Säule ${idx + 1} drehen (Aktuell: ${currentSym})`;
        },
        onInteract: () => {
          if (this.puzzle1Solved) return;
          this.puzzle1States[idx] = (this.puzzle1States[idx] + 1) % 4;
          soundEngine.playPuzzleTurn();
          this.checkPuzzle1();
          this.emitHud(true);
        },
      });
    });

    // Zone 1 Treasures & Breakable Clay Urns
    this.addTreasure('scarab_hall', 'Goldener Sonnenskarabäus', 'scarab', -7.2, 6.2, 150);
    this.addTreasure('chest_hall', 'Truhe des Tempelschreibers', 'chest', 7.2, 6.2, 200, 15);
    this.addClayUrn('urn_hall_1', -6.8, -6.5, 35, 0);
    this.addClayUrn('urn_hall_2', 6.8, -6.5, 0, 15);

    // --- ZONE 2: PASSAGE DER PRÜFUNGEN (x: -3.2..3.2, z: -34..-10, h: 4.8) ---
    this.addBox(0, -0.1, -22, 6.6, 0.2, 24.4, this.mats.floorTile, false);
    this.addBox(0, 4.9, -22, 6.6, 0.3, 24.4, this.mats.sandstone, false);
    this.addBox(-3.45, 2.4, -22, 0.5, 4.8, 24.4, this.mats.hieroglyphWall, true);
    this.addClayUrn('urn_corridor_1', 2.2, -13.0, 40, 0);

    // East wall split for Secret Chamber doorway at z: -23.5 .. -20.5
    this.addBox(3.45, 2.4, -15.25, 0.5, 4.8, 10.5, this.mats.hieroglyphWall, true);
    this.addBox(3.45, 2.4, -28.75, 0.5, 4.8, 10.5, this.mats.hieroglyphWall, true);
    this.addBox(3.45, 4.1, -22, 0.5, 1.4, 3.0, this.mats.sandstone, false);

    // Secret False-Wall Door
    this.secretDoorMesh = this.addBox(3.35, 1.7, -22, 0.45, 3.4, 3.0, this.mats.sandstone, false);
    this.secretDoorCollider = { minX: 3.1, maxX: 3.7, minZ: -23.5, maxZ: -20.5, active: true };
    this.colliders.push(this.secretDoorCollider);

    // Secret Golden Scarab Switch on the East Wall at z = -17.5
    const switchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.36), this.mats.brushedGold);
    switchMesh.position.set(3.12, 1.38, -17.5);
    this.scene.add(switchMesh);
    this.interactables.push({
      id: 'secret_switch',
      position: new THREE.Vector3(3.12, 1.38, -17.5),
      radius: 2.6,
      getPrompt: () => (this.secretOpened ? null : '[E] Verborgenen Steinmechanismus drücken'),
      onInteract: () => {
        if (this.secretOpened) return;
        this.secretOpened = true;
        this.secretsFound += 1;
        this.secretDoorCollider.active = false;
        this.triggerTremor(0.32);
        soundEngine.playStoneSlide();
        soundEngine.playPuzzleSolved();
        this.showBanner('Geheimkammer des Wesirs entdeckt!');
        this.emitHud(true);
      },
    });

    // --- SECRET ALCOVE: GEHEIME SCHATZKAMMER DES WESIRS (x: 3.5..10.5, z: -26..-18) ---
    this.addBox(7.0, -0.1, -22, 7.2, 0.2, 8.2, this.mats.floorTile, false);
    this.addBox(7.0, 4.6, -22, 7.2, 0.3, 8.2, this.mats.sandstone, false);
    this.addBox(10.7, 2.25, -22, 0.5, 4.5, 8.4, this.mats.hieroglyphWall, true);
    this.addBox(7.0, 2.25, -17.8, 7.4, 4.5, 0.5, this.mats.hieroglyphWall, true);
    this.addBox(7.0, 2.25, -26.2, 7.4, 4.5, 0.5, this.mats.hieroglyphWall, true);
    this.addBrazier(9.2, -19.2, false);
    this.addStoryTablet('secret_vesir', 9.2, -24.6, 0, 'Geheime Tafel des Wesirs');
    this.addTreasure('eye_secret', 'Auge des Horus', 'eye', 6.5, -24.5, 300, 25);
    this.addTreasure('chest_secret', 'Goldtruhe des Wesirs', 'chest', 8.8, -21.8, 250, 20);

    // Traps in Corridor
    this.addSpikeTrap(0, -15, 0);
    this.addPendulumTrap(0, -19.5, 0);
    this.addSpikeTrap(0, -25.5, 1.6);
    this.addPendulumTrap(0, -30, 1.57);
    this.addBrazier(-2.3, -14, false);
    this.addBrazier(-2.3, -27, false);

    // --- ZONE 3: KATAKOMBEN DER WÄCHTER (x: -14..14, z: -62..-34, h: 7.5) ---
    // South wall with entrance gap x: -2.2..2.2
    this.addBox(-8.2, 3.75, -34, 12.0, 7.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(8.2, 3.75, -34, 12.0, 7.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(0, 6.2, -34, 4.8, 2.6, 0.8, this.mats.sandstone, false);

    // Side walls (West wall split around z: -58..-55 for Secret 2 Cracked Wall Alcove)
    this.addBox(-14.3, 3.75, -44.4, 0.6, 7.5, 21.2, this.mats.hieroglyphWall, true);
    this.addBox(-14.3, 3.75, -60.1, 0.6, 7.5, 4.2, this.mats.hieroglyphWall, true);
    this.addBox(-14.3, 5.45, -56.5, 0.6, 4.1, 3.0, this.mats.sandstone, false);
    this.addBox(14.3, 3.75, -48, 0.6, 7.5, 28.4, this.mats.hieroglyphWall, true);

    // Breakable Cracked Wall at (-14.2, 0, -56.5) + Secret Catacombs Alcove (x: -20.5..-14.3, z: -59.5..-53.5)
    this.secret2WallGroup = createCrackedWallModel(this.mats);
    this.secret2WallGroup.position.set(-14.2, 0, -56.5);
    this.secret2WallGroup.rotation.y = Math.PI / 2;
    this.scene.add(this.secret2WallGroup);
    this.secret2Collider = { minX: -14.6, maxX: -13.9, minZ: -58.0, maxZ: -55.0, active: true };
    this.colliders.push(this.secret2Collider);

    this.interactables.push({
      id: 'cracked_wall_hint',
      position: this.secret2Pos,
      radius: 3.0,
      getPrompt: () => (this.secret2Opened ? null : '[F / Klick] Rissige Mauer mit Fackel einschlagen'),
      onInteract: () => {
        if (!this.secret2Opened) {
          this.triggerTorchAttack();
        }
      },
    });

    // Secret Chamber 2 Interior
    this.addBox(-17.4, -0.1, -56.5, 6.4, 0.2, 6.2, this.mats.floorTile, false);
    this.addBox(-17.4, 4.6, -56.5, 6.4, 0.3, 6.2, this.mats.sandstone, false);
    this.addBox(-20.6, 2.25, -56.5, 0.5, 4.5, 6.4, this.mats.hieroglyphWall, true);
    this.addBox(-17.4, 2.25, -53.4, 6.4, 4.5, 0.5, this.mats.hieroglyphWall, true);
    this.addBox(-17.4, 2.25, -59.6, 6.4, 4.5, 0.5, this.mats.hieroglyphWall, true);
    this.addBrazier(-19.2, -54.8, false);
    this.addTreasure('amulet_catacombs_secret', 'Amulett des Anubis', 'scarab', -18.5, -56.5, 280, 30);

    // Ceiling
    this.addBox(0, 7.6, -48, 28.6, 0.3, 28.4, this.mats.sandstone, false);

    // South floor (z: -45 .. -34) & North floor (z: -62 .. -51), leaving Chasm at z: -51..-45
    this.addBox(0, -0.1, -39.5, 28.4, 0.2, 11.2, this.mats.floorTile, false);
    this.addBox(0, -0.1, -56.5, 28.4, 0.2, 11.2, this.mats.floorTile, false);
    // Deep dark chasm floor below
    this.addBox(0, -5.5, -48, 28.4, 0.2, 6.4, this.mats.obsidian, false);

    // Chasm collision walls (Left & Right permanent; Center bridge unblocked when Puzzle 2 solved)
    this.colliders.push({ minX: -14.2, maxX: -2.2, minZ: -51.1, maxZ: -44.9, active: true });
    this.colliders.push({ minX: 2.2, maxX: 14.2, minZ: -51.1, maxZ: -44.9, active: true });
    this.chasmBridgeCollider = { minX: -2.2, maxX: 2.2, minZ: -51.1, maxZ: -44.9, active: true };
    this.colliders.push(this.chasmBridgeCollider);

    // Golden Bridge of Osiris (starts sunk below chasm at y = -3.8, rises to y = -0.05)
    this.bridgeMesh = this.addBox(0, -3.8, -48, 4.4, 0.35, 6.4, this.mats.brushedGold, false, true);

    // North wall of Zone 3 with doorway x: -2.2..2.2
    this.addBox(-8.2, 3.75, -62, 12.0, 7.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(8.2, 3.75, -62, 12.0, 7.5, 0.8, this.mats.hieroglyphWall, true);
    this.addBox(0, 6.2, -62, 4.8, 2.6, 0.8, this.mats.sandstone, false);

    this.gate2Mesh = this.addBox(0, 2.35, -62, 4.4, 4.7, 0.55, this.mats.obsidian, false, true);
    this.gate2Collider = { minX: -2.2, maxX: 2.2, minZ: -62.35, maxZ: -61.65, active: true };
    this.colliders.push(this.gate2Collider);

    // Hypostyle Columns in Catacombs
    for (const [px, pz] of [
      [-9.5, -38.5],
      [9.5, -38.5],
      [-9.5, -56.5],
      [9.5, -56.5],
    ]) {
      this.addBox(px, 3.75, pz, 1.5, 7.5, 1.5, this.mats.sandstone, true, true);
    }
    this.addBrazier(-4.5, -44.2, true);
    this.addBrazier(4.5, -44.2, false);
    this.addBrazier(-4.5, -52.0, false);
    this.addBrazier(4.5, -52.0, true);

    // Hint Stele for Puzzle 2
    this.addStoryTablet('catacombs_hymn', -3.6, -37.0, 0.25, 'Stele der Katakomben');

    // Puzzle 2: 4 Illuminated Floor Plates at z = -41.5
    const plateSpecs: { sym: HieroglyphSymbol; label: string; x: number }[] = [
      { sym: 'sonne', label: 'Sonne', x: -7.5 },
      { sym: 'lotus', label: 'Lotus', x: -2.5 },
      { sym: 'falke', label: 'Falke', x: 2.5 },
      { sym: 'schlange', label: 'Schlange', x: 7.5 },
    ];
    plateSpecs.forEach((spec) => {
      const plateMat = new THREE.MeshStandardMaterial({
        map: this.textures.symbolTextures[spec.sym],
        roughness: 0.4,
        metalness: 0.2,
        emissive: new THREE.Color(0x000000),
      });
      const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 1.75), plateMat);
      plateMesh.position.set(spec.x, 0.05, -41.5);
      plateMesh.receiveShadow = true;
      this.scene.add(plateMesh);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x5c4728,
        emissive: 0x000000,
        roughness: 0.4,
        metalness: 0.7,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(spec.x, 0.09, -41.5);
      this.scene.add(ring);

      const plate: FloorPlateEntity = {
        symbol: spec.sym,
        label: spec.label,
        position: new THREE.Vector3(spec.x, 0.2, -41.5),
        mesh: plateMesh,
        ring,
        active: false,
      };
      this.floorPlates.push(plate);

      this.interactables.push({
        id: `plate_${spec.sym}`,
        position: plate.position,
        radius: 2.4,
        getPrompt: () => {
          if (this.puzzle2Solved) return null;
          return `[E] Bodensiegel „${spec.label}“ aktivieren`;
        },
        onInteract: () => {
          this.triggerFloorPlate(plate);
        },
      });
    });

    // Catacomb Treasures & Breakable Clay Urns
    this.addTreasure('chalice_cata', 'Kelch der Königin Neferkare', 'chalice', -12.0, -37.2, 220, 20);
    this.addTreasure('chest_cata', 'Opfertruhe des Osiris', 'chest', 11.8, -58.5, 250, 25);
    this.addClayUrn('urn_cata_1', -11.5, -42.5, 45, 15);
    this.addClayUrn('urn_cata_2', 11.5, -53.5, 50, 0);

    // 3 Catacomb Mummies
    this.spawnMummy('mummy_1', -8.0, -40.5, false);
    this.spawnMummy('mummy_2', 8.0, -40.5, false);
    this.spawnMummy('mummy_3', 0.0, -56.5, false);

    // --- ZONE 4: GRABKAMMER DES CHNUM-RE (x: -13..13, z: -88..-62, h: 9.5) ---
    this.addBox(0, -0.1, -75, 26.4, 0.2, 26.4, this.mats.floorTile, false);
    this.addBox(0, 9.6, -75, 26.4, 0.3, 26.4, this.mats.sandstone, false);
    this.addBox(-13.3, 4.75, -75, 0.6, 9.5, 26.4, this.mats.hieroglyphWall, true);
    this.addBox(13.3, 4.75, -75, 0.6, 9.5, 26.4, this.mats.hieroglyphWall, true);
    this.addBox(0, 4.75, -88.3, 26.6, 9.5, 0.6, this.mats.hieroglyphWall, true);

    // Colossal Anubis Statues
    const anubisL = createAnubisStatueModel(this.mats);
    anubisL.position.set(-10.2, 0, -76);
    anubisL.rotation.y = Math.PI / 2;
    this.scene.add(anubisL);
    this.colliders.push({ minX: -11.4, maxX: -9.0, minZ: -77.2, maxZ: -74.8, active: true });

    const anubisR = createAnubisStatueModel(this.mats);
    anubisR.position.set(10.2, 0, -76);
    anubisR.rotation.y = -Math.PI / 2;
    this.scene.add(anubisR);
    this.colliders.push({ minX: 9.0, maxX: 11.4, minZ: -77.2, maxZ: -74.8, active: true });

    this.addBrazier(-7.0, -65.5, true);
    this.addBrazier(7.0, -65.5, false);
    this.addBrazier(-7.0, -83.5, false);
    this.addBrazier(7.0, -83.5, true);
    this.addClayUrn('urn_sanctum_1', -10.5, -65.5, 0, 20);

    // Central Royal Sarcophagus at (0, 0, -76)
    const sarcophagus = createSarcophagusModel(this.mats);
    sarcophagus.position.set(0, 0, -76);
    this.scene.add(sarcophagus);
    this.sanctumPrism = sarcophagus.getObjectByName('SanctumPrism')!;
    this.colliders.push({ minX: -1.9, maxX: 1.9, minZ: -78.7, maxZ: -73.3, active: true });

    // Golden Energy Barrier protecting the Royal Crown alcoves until Mirrors align
    this.sanctumBarrierMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 4.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.sanctumBarrierMesh.position.set(0, 2.1, -83.0);
    this.scene.add(this.sanctumBarrierMesh);
    this.sanctumBarrierCollider = { minX: -3.2, maxX: 3.2, minZ: -86.2, maxZ: -79.8, active: true };
    this.colliders.push(this.sanctumBarrierCollider);

    // Final Story Tablet
    this.addStoryTablet('sanctum_revelation', -3.6, -66.0, 0.2, 'Tafel des Sonnenkönigs');

    // Puzzle 3: 2 Solar Mirrors at (-8.5, -68) and (8.5, -68) aiming at prism (0, 1.45, -76)
    const mirrorCoords: { x: number; z: number; initialStep: number }[] = [
      { x: -8.5, z: -68.0, initialStep: 1 },
      { x: 8.5, z: -68.0, initialStep: 2 },
    ];
    mirrorCoords.forEach((mc, idx) => {
      const { group, yoke, beam } = createSolarMirrorModel(this.mats);
      group.position.set(mc.x, 0, mc.z);
      this.scene.add(group);
      this.colliders.push({ minX: mc.x - 0.75, maxX: mc.x + 0.75, minZ: mc.z - 0.75, maxZ: mc.z + 0.75, active: true });

      // Compute exact target yaw so +Z of yoke points at (0, 1.45, -76)
      const dx = 0 - mc.x;
      const dz = -76 - mc.z;
      const targetAngle = Math.atan2(dx, dz);
      const targetStep = 0; // step 0 corresponds to targetAngle; other steps add 45° offsets
      yoke.rotation.y = targetAngle + mc.initialStep * (Math.PI / 4);

      // Sun shaft cone descending from ceiling onto mirror
      const shaftGeo = new THREE.CylinderGeometry(0.45, 0.85, 8.2, 12, 1, true);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: 0xffe6a3,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.set(mc.x, 5.5, mc.z);
      this.scene.add(shaft);

      const mirrorData = { yoke, beam, step: mc.initialStep, targetStep, targetAngle };
      this.mirrors.push(mirrorData);

      this.interactables.push({
        id: `mirror_${idx}`,
        position: new THREE.Vector3(mc.x, 1.4, mc.z),
        radius: 3.0,
        getPrompt: () => {
          if (this.puzzle3Solved) return 'Sonnenspiegel ausgerichtet';
          const aligned = mirrorData.step === mirrorData.targetStep;
          return `[E] Sonnenspiegel ${idx + 1} drehen ${aligned ? '(Auf Kristall ausgerichtet!)' : '(Sucht Ziel...)'}`;
        },
        onInteract: () => {
          if (this.puzzle3Solved) return;
          mirrorData.step = (mirrorData.step + 1) % 4;
          soundEngine.playPuzzleTurn();
          this.checkPuzzle3();
          this.emitHud(true);
        },
      });
    });

    // Grand Finale Treasure: Krone der Ewigkeit
    this.crownRelicItem = this.addTreasure(
      'crown_eternity',
      'Krone der Ewigkeit',
      'crown',
      0,
      -83.0,
      1000,
      0,
      true,
    );

    // Boss Mummy: Wächter-Pharao Imhotep
    this.spawnMummy('mummy_boss', 0, -70.5, true);

    // --- ATMOSPHERIC FLOATING GOLDEN DUST MOTES ---
    const dustCount = 260;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 26;
      dustPos[i * 3 + 1] = 0.4 + Math.random() * 5.2;
      dustPos[i * 3 + 2] = 16 - Math.random() * 102;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd580,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);
  }

  private addSpikeTrap(x: number, z: number, phaseOffset: number): void {
    const { group, spears } = createSpikeTrapModel(this.mats);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.spikeTraps.push({
      group,
      spears,
      position: new THREE.Vector3(x, 0, z),
      phaseOffset,
      extended: false,
    });
  }

  private addPendulumTrap(x: number, z: number, phaseOffset: number): void {
    const { group, pivot } = createPendulumTrapModel(this.mats);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.pendulumTraps.push({
      group,
      pivot,
      position: new THREE.Vector3(x, 0, z),
      phaseOffset,
      bladeWorldPos: new THREE.Vector3(x, 1.2, z),
    });
  }

  private spawnMummy(id: string, x: number, z: number, isBoss: boolean): void {
    const rig = createMummyModel(this.mats, isBoss);
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    this.mummies.push({
      id,
      isBoss,
      rig,
      homePos: new THREE.Vector3(x, 0, z),
      health: isBoss ? 140 : 60,
      maxHealth: isBoss ? 140 : 60,
      speed: isBoss ? 2.65 : 2.2,
      stunTimer: 0,
      attackCooldown: 0,
      hurtTimer: 0,
      alive: true,
      walkPhase: Math.random() * Math.PI * 2,
      awakened: false,
    });
  }

  private addClayUrn(id: string, x: number, z: number, goldValue: number, healAmount: number): void {
    const group = createClayUrnModel(this.mats);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const collider: AABB = {
      minX: x - 0.34,
      maxX: x + 0.34,
      minZ: z - 0.34,
      maxZ: z + 0.34,
      active: true,
    };
    this.colliders.push(collider);
    this.clayUrns.push({
      id,
      group,
      position: new THREE.Vector3(x, 0.45, z),
      collider,
      goldValue,
      healAmount,
      broken: false,
    });
  }

  private initParticlePool(): void {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const palette = [this.mats.terracotta, this.mats.brushedGold, this.mats.amberGlow, this.mats.sandstone];
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(geo, palette[i % palette.length]);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.65,
        active: false,
      });
    }
  }

  private spawnParticles(origin: THREE.Vector3, count: number, spreadSpeed = 3.8): void {
    if (this.reducedMotion) return;
    let spawned = 0;
    for (const p of this.particlePool) {
      if (p.active) continue;
      p.active = true;
      p.life = 0.55 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.mesh.position.copy(origin);
      p.mesh.position.y += 0.2 + Math.random() * 0.5;
      p.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
      p.velocity.set(
        (Math.random() - 0.5) * spreadSpeed * 2,
        2.0 + Math.random() * spreadSpeed,
        (Math.random() - 0.5) * spreadSpeed * 2,
      );
      p.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  private initBossShockwave(): void {
    const ringGeo = new THREE.RingGeometry(0.82, 1.15, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.bossWaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.bossWaveRing.position.y = 0.09;
    this.bossWaveRing.visible = false;
    this.scene.add(this.bossWaveRing);

    const coreGeo = new THREE.RingGeometry(0.15, 1.3, 24);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.bossWaveCore = new THREE.Mesh(coreGeo, coreMat);
    this.bossWaveCore.position.y = 0.07;
    this.bossWaveCore.visible = false;
    this.scene.add(this.bossWaveCore);
  }

  private triggerTremor(amount: number): void {
    if (!this.reducedMotion) {
      this.cameraTremor = Math.max(this.cameraTremor, amount);
    }
  }

  private checkPuzzle1(): void {
    // Target: [0: Falke, 1: Skarabäus, 2: Ankh]
    if (this.puzzle1States[0] === 0 && this.puzzle1States[1] === 1 && this.puzzle1States[2] === 2) {
      this.puzzle1Solved = true;
      this.puzzlesSolved += 1;
      this.gate1Collider.active = false;
      this.triggerTremor(0.35);
      soundEngine.playStoneSlide();
      soundEngine.playPuzzleSolved();
      this.showBanner('Die Waage der Ma’at ist im Einklang — das Tor zur Klingenpassage öffnet sich!');
    }
  }

  private triggerFloorPlate(plate: FloorPlateEntity): void {
    if (this.puzzle2Solved || plate.active) return;

    const expected = this.puzzle2Order[this.puzzle2Progress];
    if (plate.symbol === expected) {
      plate.active = true;
      (plate.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x10b981);
      (plate.ring.material as THREE.MeshStandardMaterial).emissive.setHex(0xf59e0b);
      this.puzzle2Progress += 1;
      soundEngine.playPuzzleTurn();

      if (this.puzzle2Progress >= this.puzzle2Order.length) {
        this.puzzle2Solved = true;
        this.puzzlesSolved += 1;
        this.chasmBridgeCollider.active = false;
        this.gate2Collider.active = false;
        this.triggerTremor(0.4);
        soundEngine.playStoneSlide();
        soundEngine.playPuzzleSolved();
        this.showBanner('Die Brücke des Osiris erhebt sich aus der Tiefe und das Allerheiligste öffnet sich!');
      } else {
        this.showBanner(`Siegel ${this.puzzle2Progress}/4 (${plate.label}) aktiviert!`);
      }
      this.emitHud(true);
    } else {
      // Wrong order -> reset
      this.puzzle2Progress = 0;
      this.floorPlates.forEach((p) => {
        p.active = false;
        (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
        (p.ring.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      });
      soundEngine.playTrapSnap();
      this.showBanner('Falsche Reihenfolge! Lies die Hymne der Katakomben: Lotus → Schlange → Sonne → Falke.');
      this.emitHud(true);
    }
  }

  private checkPuzzle3(): void {
    const allAligned = this.mirrors.every((m) => m.step === m.targetStep);
    if (allAligned && !this.puzzle3Solved) {
      this.puzzle3Solved = true;
      this.puzzlesSolved += 1;
      this.sanctumBarrierCollider.active = false;
      this.sanctumBarrierMesh.visible = false;
      this.triggerTremor(0.35);
      soundEngine.playSolarFlash();
      soundEngine.playPuzzleSolved();

      // Shatter shield & weaken Boss Mummy
      const boss = this.mummies.find((m) => m.isBoss && m.alive);
      if (boss) {
        boss.health = Math.max(25, boss.health - 65);
        boss.stunTimer = 4.0;
        boss.hurtTimer = 0.4;
        boss.rig.hitMaterial.emissive.setHex(0xd97706);
      }
      this.showBanner('Beide Sonnenstrahlen treffen den Kristall! Die Barriere zerbricht — birg die Krone der Ewigkeit!');
    }
  }

  private showBanner(msg: string): void {
    this.bannerMessage = msg;
    this.bannerTimer = 4.5;
  }

  public startGame(): void {
    if (this.phase === 'victory' || this.phase === 'gameover') {
      this.resetGame();
    }
    this.phase = 'playing';
    this.activeStoryModalId = null;
    soundEngine.startAmbient();
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.activeStoryModalId = null;
      this.requestPointerLockSafe();
      this.emitHud(true);
    } else if (this.phase === 'playing' && !this.activeStoryModalId && !this.pointerLocked) {
      // Closing a tablet story modal keeps the phase 'playing'; restore pointer
      // lock so mouse look continues without an extra canvas click.
      this.requestPointerLockSafe();
    }
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keys.clear();
      this.isDraggingLook = false;
      this.exitPointerLock();
      this.emitHud(true);
    }
  }

  public openStoryModal(id: string | null): void {
    this.activeStoryModalId = id;
    if (id) {
      this.keys.clear();
      this.isDraggingLook = false;
      this.exitPointerLock();
    }
    this.emitHud(true);
  }

  public resetGame(): void {
    this.health = this.maxHealth;
    this.solarEnergy = this.maxSolarEnergy;
    this.gold = 0;
    this.treasuresFound = 0;
    this.secretsFound = 0;
    this.puzzlesSolved = 0;
    this.mummiesDefeated = 0;
    this.elapsedSeconds = 0;
    this.hurtFlash = 0;
    this.invulnTimer = 0;
    this.solarFlashTimer = 0;
    this.torchSwingTimer = 0;
    this.plateTouchCooldown = 0;
    this.keys.clear();
    this.isDraggingLook = false;
    this.bannerMessage = null;
    this.bannerTimer = 0;
    this.unlockedStories = new Set<string>(['prologue']);
    this.activeStoryModalId = null;
    this.visitedZones = new Set<ZoneId>(['forecourt']);
    this.lastZoneId = 'forecourt';
    this.checkpointPos = null;
    this.checkpointYaw = 0;
    this.checkpointZoneName = null;
    this.unlockedCheckpoints.clear();
    this.walkBobPhase = 0;
    this.cameraTremor = 0;

    // Reset Boss Shockwave
    this.bossWaveCooldown = 3.5;
    this.bossWaveTelegraph = 0;
    this.bossWaveActive = false;
    this.bossWaveRadius = 0;
    this.bossWaveHitThisCast = false;
    this.bossWaveRing.visible = false;
    this.bossWaveCore.visible = false;

    // Reset Particle Pool
    this.particlePool.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });

    // Reset Player
    this.playerPos.set(0, 0, 18.5);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.yaw = 0;
    this.pitch = -0.04;

    // Reset Puzzle 1
    this.puzzle1States = [1, 2, 0];
    this.puzzle1Solved = false;
    this.gate1Collider.active = true;
    this.gate1Mesh.position.y = 2.25;

    // Reset Secret Doors
    this.secretOpened = false;
    this.secretDoorCollider.active = true;
    this.secretDoorMesh.position.y = 1.7;
    this.secret2Opened = false;
    this.secret2Collider.active = true;
    this.secret2WallGroup.visible = true;

    // Reset Clay Urns
    this.clayUrns.forEach((u) => {
      u.broken = false;
      u.collider.active = true;
      u.group.visible = true;
    });

    // Reset Puzzle 2
    this.puzzle2Progress = 0;
    this.puzzle2Solved = false;
    this.chasmBridgeCollider.active = true;
    this.bridgeMesh.position.y = -3.8;
    this.gate2Collider.active = true;
    this.gate2Mesh.position.y = 2.35;
    this.floorPlates.forEach((p) => {
      p.active = false;
      (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (p.ring.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    });

    // Reset Puzzle 3
    this.puzzle3Solved = false;
    this.sanctumBarrierCollider.active = true;
    this.sanctumBarrierMesh.visible = true;
    if (this.mirrors[0]) this.mirrors[0].step = 1;
    if (this.mirrors[1]) this.mirrors[1].step = 2;

    // Reset Treasures
    this.treasures.forEach((t) => {
      t.collected = false;
      if (t.floatingPart) t.floatingPart.visible = true;
      if (t.lid) t.lid.rotation.x = 0;
    });

    // Reset Mummies
    this.mummies.forEach((m) => {
      m.alive = true;
      m.health = m.maxHealth;
      m.stunTimer = 0;
      m.hurtTimer = 0;
      m.attackCooldown = 0;
      m.awakened = false;
      m.rig.hitMaterial.emissive.setHex(0x000000);
      m.rig.group.visible = true;
      m.rig.group.position.copy(m.homePos);
      m.rig.group.rotation.set(0, 0, 0);
    });

    this.phase = 'playing';
    this.syncCamera();
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public respawnAtCheckpoint(): void {
    if (!this.checkpointPos) {
      this.resetGame();
      return;
    }

    this.health = this.maxHealth;
    this.solarEnergy = this.maxSolarEnergy;
    this.hurtFlash = 0;
    this.invulnTimer = 1.4;
    this.solarFlashTimer = 0;
    this.torchSwingTimer = 0;
    this.keys.clear();
    this.isDraggingLook = false;
    this.activeStoryModalId = null;

    this.playerPos.copy(this.checkpointPos);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.yaw = this.checkpointYaw;
    this.pitch = -0.04;

    this.bossWaveCooldown = 3.5;
    this.bossWaveTelegraph = 0;
    this.bossWaveActive = false;
    this.bossWaveRing.visible = false;
    this.bossWaveCore.visible = false;

    this.mummies.forEach((m) => {
      if (!m.alive) return;
      m.stunTimer = 0;
      m.hurtTimer = 0;
      m.attackCooldown = 0.8;
      m.awakened = false;
      m.rig.hitMaterial.emissive.setHex(0x000000);
      m.rig.group.position.copy(m.homePos);
    });

    this.phase = 'playing';
    this.showBanner(`Am Kontrollpunkt „${this.checkpointZoneName}“ wiederbelebt.`);
    this.syncCamera();
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public setSensitivity(mult: number): void {
    this.lookSensitivity = THREE.MathUtils.clamp(mult, 0.3, 2.5);
  }

  public setInvertY(invert: boolean): void {
    this.invertY = invert;
  }

  public setVirtualKey(code: string, pressed: boolean): void {
    if (this.phase !== 'playing' || this.activeStoryModalId) {
      this.keys.delete(code);
      return;
    }
    if (code === 'Space' && pressed && this.isGrounded) {
      this.playerVelY = 5.4;
      this.isGrounded = false;
      return;
    }
    if (pressed) {
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    const target = this.getActiveInteractable();
    if (target) {
      target.onInteract();
    }
  }

  public triggerTorchAttack(): void {
    if (this.phase !== 'playing' || this.activeStoryModalId) return;
    if (this.torchSwingTimer > 0) return;

    this.torchSwingTimer = 0.36;
    soundEngine.playTorchSwing();

    // Forward direction
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();

    let hitSomething = false;
    for (const m of this.mummies) {
      if (!m.alive) continue;
      _v1.subVectors(m.rig.group.position, this.playerPos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist < 2.85) {
        _v1.normalize();
        if (_v1.dot(_forward) > 0.35 || dist < 1.3) {
          hitSomething = true;
          m.health -= 24;
          m.hurtTimer = 0.25;
          m.stunTimer = Math.max(m.stunTimer, 0.45);
          m.rig.hitMaterial.emissive.setHex(0x9a2c10);
          this.spawnParticles(m.rig.group.position, 8, 3.4);

          // Knockback (clamped against walls)
          m.rig.group.position.addScaledVector(_v1, 0.75);
          this.resolveHorizontalCollision(m.rig.group.position, 0.48);
          if (m.health <= 0) {
            m.alive = false;
            m.rig.group.visible = false;
            this.mummiesDefeated += 1;
            this.gold += m.isBoss ? 400 : 75;
            if (m.isBoss) {
              this.bossWaveTelegraph = 0;
              this.bossWaveActive = false;
              this.bossWaveCore.visible = false;
              this.bossWaveRing.visible = false;
            }
            soundEngine.playTreasure();
            this.showBanner(
              m.isBoss
                ? 'Wächter-Pharao Imhotep gebannt! (+400 Gold)'
                : 'Mumie besiegt! (+75 Gold)',
            );
          } else {
            soundEngine.playMummyGroan();
          }
        }
      }
    }

    // Breakable Clay Urns
    for (const urn of this.clayUrns) {
      if (urn.broken) continue;
      _v1.subVectors(urn.position, this.playerPos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist < 2.65) {
        _v1.normalize();
        if (_v1.dot(_forward) > 0.35 || dist < 1.3) {
          urn.broken = true;
          urn.collider.active = false;
          urn.group.visible = false;
          hitSomething = true;
          this.spawnParticles(urn.position, 10, 4.2);
          soundEngine.playUrnBreak();
          if (urn.goldValue > 0) this.gold += urn.goldValue;
          if (urn.healAmount > 0) {
            this.health = Math.min(this.maxHealth, this.health + urn.healAmount);
          }
          const rewardParts: string[] = [];
          if (urn.goldValue > 0) rewardParts.push(`+${urn.goldValue} Gold`);
          if (urn.healAmount > 0) rewardParts.push(`+${urn.healAmount} Lebenskraft`);
          this.showBanner(`Tonkrug zerschlagen (${rewardParts.join(', ')})`);
        }
      }
    }

    // Breakable Cracked Wall in Catacombs (Secret 2)
    if (!this.secret2Opened) {
      _v1.subVectors(this.secret2Pos, this.playerPos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist < 3.1) {
        _v1.normalize();
        if (_v1.dot(_forward) > 0.32 || dist < 1.5) {
          hitSomething = true;
          this.secret2Opened = true;
          this.secretsFound += 1;
          this.secret2Collider.active = false;
          this.secret2WallGroup.visible = false;
          this.triggerTremor(0.42);
          this.spawnParticles(this.secret2Pos, 16, 4.8);
          soundEngine.playWallCrumble();
          soundEngine.playPuzzleSolved();
          this.showBanner('Rissige Mauer durchbrochen! Geheime Nische der Katakomben entdeckt!');
        }
      }
    }

    if (hitSomething) {
      this.emitHud(true);
    }
  }

  public triggerSolarFlash(): void {
    if (this.phase !== 'playing' || this.activeStoryModalId) return;
    if (this.solarEnergy < 40) {
      this.showBanner('Nicht genügend Sonnenenergie für den Sonnenblitz!');
      this.emitHud(true);
      return;
    }

    this.solarEnergy -= 40;
    this.solarFlashTimer = 0.45;
    soundEngine.playSolarFlash();

    let stunnedCount = 0;
    for (const m of this.mummies) {
      if (!m.alive) continue;
      const d = m.rig.group.position.distanceTo(this.playerPos);
      if (d < 9.5) {
        m.stunTimer = m.isBoss ? 2.8 : 4.2;
        m.health -= 18;
        m.hurtTimer = 0.3;
        m.rig.hitMaterial.emissive.setHex(0xd97706);
        this.spawnParticles(m.rig.group.position, 6, 3.0);
        stunnedCount += 1;
        if (m.health <= 0) {
          m.alive = false;
          m.rig.group.visible = false;
          this.mummiesDefeated += 1;
          this.gold += m.isBoss ? 400 : 75;
          if (m.isBoss) {
            this.bossWaveTelegraph = 0;
            this.bossWaveActive = false;
            this.bossWaveCore.visible = false;
            this.bossWaveRing.visible = false;
          }
          soundEngine.playTreasure();
        }
      }
    }

    if (stunnedCount > 0) {
      this.showBanner(`Sonnenblitz blendet ${stunnedCount} Mumie${stunnedCount > 1 ? 'n' : ''}!`);
    }
    this.emitHud(true);
  }

  private requestPointerLockSafe(): void {
    try {
      // Modern browsers return a Promise from requestPointerLock(); a synchronous
      // try/catch alone would leave rejections (sandboxed iframe without
      // allow-pointer-lock, Esc cooldown, missing user gesture) unhandled.
      const result: unknown = this.renderer.domElement.requestPointerLock?.();
      if (result instanceof Promise) {
        result.catch(() => {
          // Pointer lock unavailable — the drag-look fallback remains active.
        });
      }
    } catch {
      // Ignore if blocked in sandboxed iframe; drag-look fallback still works seamlessly
    }
  }

  private exitPointerLock(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // ignore
    }
  }

  private getCurrentZone(): ZoneId {
    const z = this.playerPos.z;
    const x = this.playerPos.x;
    if (z > 10) return 'forecourt';
    if (z > -10) return 'entrance_hall';
    if (z > -34) {
      if (x > 3.2) return 'secret_alcove';
      return 'trap_corridor';
    }
    if (z > -62) {
      if (x < -14.0) return 'secret_catacombs';
      return 'catacombs';
    }
    return 'sanctum';
  }

  private getObjectiveText(): string {
    if (!this.puzzle1Solved) {
      return 'Vorhalle: Drehe die 3 Hieroglyphen-Säulen auf Falke · Skarabäus · Ankh.';
    }
    if (!this.puzzle2Solved) {
      return `Katakomben: Betritt die 4 Bodensiegel in Folge (${this.puzzle2Progress}/4: Lotus → Schlange → Sonne → Falke).`;
    }
    if (!this.puzzle3Solved) {
      return 'Grabkammer: Richte beide Sonnenspiegel mit [E] auf den Kristall aus.';
    }
    return 'Finale: Birg die Krone der Ewigkeit hinter dem Sarkophag!';
  }

  private getActiveInteractable(): Interactable | null {
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    let best: Interactable | null = null;
    let bestScore = -Infinity;

    for (const item of this.interactables) {
      const prompt = item.getPrompt();
      if (!prompt) continue;

      _v1.set(item.position.x - this.playerPos.x, 0, item.position.z - this.playerPos.z);
      const xzDist = _v1.length();
      if (xzDist > item.radius) continue;

      let align = 1.0;
      if (xzDist > 0.05) {
        _v1.divideScalar(xzDist);
        align = _v1.dot(_forward);
      }
      if (align < 0.42 && xzDist > 1.35) continue;

      const score = align * 2.0 - xzDist * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return best;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.isDraggingLook = false;
    this.activeTouchId = null;
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud(true);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || this.activeStoryModalId) return;
    soundEngine.startAmbient();

    if (e.button !== 0) return;

    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
      this.isDraggingLook = true;
      this.dragDistance = 0;
      // The click that (re-)acquires pointer lock must not also swing the torch.
      this.lockRequestClick = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else {
      this.triggerTorchAttack();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || this.activeStoryModalId) return;
    const ySign = this.invertY ? -1 : 1;

    if (this.pointerLocked) {
      const sensitivity = 0.0022 * this.lookSensitivity;
      this.yaw -= e.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sensitivity * ySign, -1.25, 1.25);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      const sensitivity = 0.0038 * this.lookSensitivity;
      this.yaw -= dx * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity * ySign, -1.25, 1.25);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    // Suppress the swing only when this click actually acquired pointer lock;
    // if the lock failed (e.g. sandboxed iframe), the click attacks as before.
    const acquiredLockDuringClick = this.lockRequestClick && this.pointerLocked;
    if (this.isDraggingLook && this.dragDistance < 6 && e.button === 0 && this.phase === 'playing' && !this.activeStoryModalId && !acquiredLockDuringClick) {
      this.triggerTorchAttack();
    }
    this.isDraggingLook = false;
    this.lockRequestClick = false;
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (this.phase !== 'playing' || this.activeStoryModalId) return;
    e.preventDefault();
    soundEngine.startAmbient();
    if (this.activeTouchId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.activeTouchId = t.identifier;
      this.lastPointerX = t.clientX;
      this.lastPointerY = t.clientY;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.phase !== 'playing' || this.activeStoryModalId || this.activeTouchId === null) return;
    e.preventDefault();
    const ySign = this.invertY ? -1 : 1;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.activeTouchId) {
        const dx = t.clientX - this.lastPointerX;
        const dy = t.clientY - this.lastPointerY;
        this.lastPointerX = t.clientX;
        this.lastPointerY = t.clientY;
        const sensitivity = 0.0045 * this.lookSensitivity;
        this.yaw -= dx * sensitivity;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity * ySign, -1.25, 1.25);
        break;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.activeTouchId) {
        this.activeTouchId = null;
        break;
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);

    if (e.code === 'KeyE') {
      if (this.activeStoryModalId) {
        this.openStoryModal(null);
        this.requestPointerLockSafe();
      } else {
        this.triggerInteract();
      }
    } else if (e.code === 'KeyF') {
      this.triggerTorchAttack();
    } else if (e.code === 'KeyQ') {
      this.triggerSolarFlash();
    } else if (e.code === 'Space' && this.phase === 'playing' && !this.activeStoryModalId) {
      e.preventDefault();
      if (this.isGrounded) {
        this.playerVelY = 5.4;
        this.isGrounded = false;
      }
    } else if (e.code === 'Escape' && !e.defaultPrevented) {
      if (this.activeStoryModalId) {
        this.openStoryModal(null);
        this.requestPointerLockSafe();
      } else if (this.phase === 'playing') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private resolveHorizontalCollision(pos: THREE.Vector3, radius: number): void {
    for (const box of this.colliders) {
      if (!box.active) continue;
      const closestX = THREE.MathUtils.clamp(pos.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(pos.z, box.minZ, box.maxZ);
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Inside box: push out along nearest edge
          const penLeft = Math.abs(pos.x - box.minX);
          const penRight = Math.abs(box.maxX - pos.x);
          const penFront = Math.abs(pos.z - box.minZ);
          const penBack = Math.abs(box.maxZ - pos.z);
          const minPen = Math.min(penLeft, penRight, penFront, penBack);
          if (minPen === penLeft) pos.x = box.minX - radius;
          else if (minPen === penRight) pos.x = box.maxX + radius;
          else if (minPen === penFront) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
      }
    }
  }

  private syncCamera(): void {
    let bobY = 0;
    let tremorX = 0;
    let tremorY = 0;
    if (!this.reducedMotion) {
      if (this.isGrounded && this.phase === 'playing') {
        bobY = Math.sin(this.walkBobPhase) * 0.032;
      }
      if (this.cameraTremor > 0.005) {
        tremorX = (Math.random() - 0.5) * this.cameraTremor * 0.14;
        tremorY = (Math.random() - 0.5) * this.cameraTremor * 0.14;
      }
    }
    this.camera.position.set(
      this.playerPos.x + tremorX,
      this.playerPos.y + this.eyeHeight + bobY + tremorY,
      this.playerPos.z,
    );
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
  }

  private damagePlayer(amount: number, reason: string): void {
    if (this.phase !== 'playing' || this.invulnTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 1.0;
    this.invulnTimer = 1.05;
    soundEngine.playPlayerHurt();
    this.showBanner(reason);
    if (this.health <= 0) {
      this.phase = 'gameover';
      this.keys.clear();
      this.exitPointerLock();
    }
    this.emitHud(true);
  }

  private tick = (): void => {
    if (this.disposed) return;

    this.timer.update();
    const rawDelta = this.timer.getDelta();
    const delta = Math.min(rawDelta, 0.06);
    const elapsed = this.timer.getElapsed();

    this.updateSceneAnimations(delta, elapsed);

    if (this.phase === 'playing' && !this.activeStoryModalId) {
      this.elapsedSeconds += delta;
      this.solarEnergy = Math.min(this.maxSolarEnergy, this.solarEnergy + delta * 5.5);
      this.updatePlayer(delta);
      this.updateTraps(delta, elapsed);
      this.updateMummies(delta, elapsed);
    } else if (this.phase === 'title') {
      // Slow atmospheric camera drift in front of the pyramid entrance
      this.camera.position.set(
        Math.sin(elapsed * 0.2) * 2.2,
        2.6 + Math.sin(elapsed * 0.35) * 0.25,
        21.5 + Math.cos(elapsed * 0.2) * 1.2,
      );
      this.camera.lookAt(0, 3.2, 6);
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= delta;
      if (this.bannerTimer <= 0) {
        this.bannerMessage = null;
      }
    }
    if (this.hurtFlash > 0) {
      this.hurtFlash = Math.max(0, this.hurtFlash - delta * 2.4);
    }
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - delta);
    }

    this.renderer.render(this.scene, this.camera);

    if (elapsed - this.lastHudEmit > 0.12) {
      this.emitHud(false);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSceneAnimations(delta: number, elapsed: number): void {
    // Flickering braziers & player torch
    this.braziers.forEach((b, i) => {
      const flicker = 0.88 + Math.sin(elapsed * 11 + i * 2.3) * 0.14;
      b.flame.scale.set(1, flicker, 1);
      if (b.light) {
        b.light.intensity = 5.2 + Math.sin(elapsed * 13 + i) * 1.1;
      }
    });
    this.playerTorchLight.intensity = 7.2 + Math.sin(elapsed * 15) * 0.85;
    this.torchViewModel.flame.scale.set(1, 0.92 + Math.sin(elapsed * 17) * 0.16, 1);

    // Torch swing animation
    if (this.torchSwingTimer > 0) {
      this.torchSwingTimer = Math.max(0, this.torchSwingTimer - delta);
      const t = 1 - this.torchSwingTimer / 0.36;
      const swing = Math.sin(t * Math.PI);
      this.torchViewModel.group.rotation.x = -swing * 1.15;
      this.torchViewModel.group.rotation.z = swing * 0.45;
      this.torchViewModel.group.position.set(0.32 - swing * 0.16, -0.28 + swing * 0.08, -0.38 - swing * 0.18);
    } else {
      this.torchViewModel.group.rotation.x = THREE.MathUtils.damp(this.torchViewModel.group.rotation.x, 0, 12, delta);
      this.torchViewModel.group.rotation.z = THREE.MathUtils.damp(this.torchViewModel.group.rotation.z, 0, 12, delta);
      this.torchViewModel.group.position.x = THREE.MathUtils.damp(this.torchViewModel.group.position.x, 0.32, 12, delta);
      this.torchViewModel.group.position.y = THREE.MathUtils.damp(this.torchViewModel.group.position.y, -0.28, 12, delta);
      this.torchViewModel.group.position.z = THREE.MathUtils.damp(this.torchViewModel.group.position.z, -0.38, 12, delta);
    }

    // Solar Flash Light decay
    if (this.solarFlashTimer > 0) {
      this.solarFlashTimer = Math.max(0, this.solarFlashTimer - delta);
      this.solarFlashLight.intensity = (this.solarFlashTimer / 0.45) * 18;
    } else {
      this.solarFlashLight.intensity = 0;
    }

    // Floating Treasures
    this.treasures.forEach((t, i) => {
      if (!t.collected && t.floatingPart) {
        t.floatingPart.rotation.y += delta * 1.1;
        t.floatingPart.position.y = 1.38 + Math.sin(elapsed * 2.2 + i) * 0.08;
      }
    });

    // Smooth Damping for Puzzle 1 Drums & Gate 1
    this.puzzle1Drums.forEach((drum, idx) => {
      const targetRot = -this.puzzle1States[idx] * (Math.PI / 2);
      // Shortest angular interpolation
      let diff = targetRot - drum.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      drum.rotation.y += diff * Math.min(1, delta * 10);
    });
    this.gate1Mesh.position.y = THREE.MathUtils.damp(
      this.gate1Mesh.position.y,
      this.puzzle1Solved ? 6.6 : 2.25,
      4.5,
      delta,
    );

    // Smooth Damping for Secret Door
    this.secretDoorMesh.position.y = THREE.MathUtils.damp(
      this.secretDoorMesh.position.y,
      this.secretOpened ? 5.2 : 1.7,
      4.5,
      delta,
    );

    // Smooth Damping for Osiris Bridge & Gate 2
    this.bridgeMesh.position.y = THREE.MathUtils.damp(
      this.bridgeMesh.position.y,
      this.puzzle2Solved ? -0.08 : -3.8,
      3.8,
      delta,
    );
    this.gate2Mesh.position.y = THREE.MathUtils.damp(
      this.gate2Mesh.position.y,
      this.puzzle2Solved ? 6.8 : 2.35,
      4.5,
      delta,
    );

    // Smooth Damping for Solar Mirrors & Sanctum Prism
    this.mirrors.forEach((m) => {
      const targetY = m.targetAngle + m.step * (Math.PI / 4);
      let diff = targetY - m.yoke.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      m.yoke.rotation.y += diff * Math.min(1, delta * 8);
    });
    if (this.sanctumPrism) {
      this.sanctumPrism.rotation.y += delta * 0.9;
      this.sanctumPrism.position.y = 3.25 + Math.sin(elapsed * 2) * 0.12;
    }

    // Dust motes drift
    if (this.dustPoints) {
      this.dustPoints.rotation.y = Math.sin(elapsed * 0.05) * 0.03;
    }

    // Camera tremor decay
    if (this.cameraTremor > 0) {
      this.cameraTremor = Math.max(0, this.cameraTremor - delta * 0.9);
    }

    // Pooled Shard Particles
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 11.5 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.velocity.y *= -0.35;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
      }
      p.mesh.rotation.x += delta * 7;
      p.mesh.rotation.y += delta * 5;
      p.mesh.scale.setScalar(Math.max(0.1, (p.life / p.maxLife) * 1.1));
    }
  }

  private updatePlayer(delta: number): void {
    // Movement vectors in XZ plane
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    let moveZ = 0;
    let moveX = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprinting ? 6.4 : 4.2;

    if (moveZ !== 0 || moveX !== 0) {
      _v1.set(0, 0, 0).addScaledVector(_forward, moveZ).addScaledVector(_right, moveX).normalize();
      this.playerPos.addScaledVector(_v1, speed * delta);
      this.stepDistAccum += speed * delta;
      if (this.isGrounded) {
        this.walkBobPhase += delta * (sprinting ? 13.5 : 9.2);
      }
      if (this.stepDistAccum > (sprinting ? 1.7 : 1.4) && this.isGrounded) {
        this.stepDistAccum = 0;
        soundEngine.playFootstep();
      }
    } else {
      // Smoothly return walk bob toward neutral
      this.walkBobPhase = THREE.MathUtils.damp(this.walkBobPhase, Math.round(this.walkBobPhase / Math.PI) * Math.PI, 8, delta);
    }

    // Gravity & Jump
    if (!this.isGrounded) {
      this.playerVelY -= 15.0 * delta;
      this.playerPos.y += this.playerVelY * delta;
      if (this.playerPos.y <= 0) {
        this.playerPos.y = 0;
        this.playerVelY = 0;
        this.isGrounded = true;
      }
    }

    this.resolveHorizontalCollision(this.playerPos, this.playerRadius);

    // Track visited zones & save zone checkpoints automatically
    const zoneId = this.getCurrentZone();
    if (zoneId !== this.lastZoneId) {
      this.lastZoneId = zoneId;
      this.visitedZones.add(zoneId);
      if (
        (zoneId === 'trap_corridor' || zoneId === 'catacombs' || zoneId === 'sanctum') &&
        !this.unlockedCheckpoints.has(zoneId)
      ) {
        this.unlockedCheckpoints.add(zoneId);
        if (zoneId === 'trap_corridor') this.checkpointPos = new THREE.Vector3(0, 0, -11.5);
        else if (zoneId === 'catacombs') this.checkpointPos = new THREE.Vector3(0, 0, -35.8);
        else this.checkpointPos = new THREE.Vector3(0, 0, -63.8);
        this.checkpointYaw = 0;
        this.checkpointZoneName = ZONE_NAMES[zoneId];
        this.showBanner(`Kontrollpunkt gespeichert: ${this.checkpointZoneName}`);
      }
      this.emitHud(true);
    }

    // Check Floor Plate Step-On Trigger in Zone 3
    if (this.plateTouchCooldown > 0) {
      this.plateTouchCooldown -= delta;
    } else if (!this.puzzle2Solved && this.playerPos.z < -38 && this.playerPos.z > -44.5) {
      for (const plate of this.floorPlates) {
        if (!plate.active) {
          const dx = this.playerPos.x - plate.position.x;
          const dz = this.playerPos.z - plate.position.z;
          if (dx * dx + dz * dz < 1.05 * 1.05 && this.playerPos.y < 0.4) {
            this.plateTouchCooldown = 0.65;
            this.triggerFloorPlate(plate);
            break;
          }
        }
      }
    }

    this.syncCamera();
  }

  private updateTraps(delta: number, elapsed: number): void {
    // 1. Floor Spear Traps
    for (const trap of this.spikeTraps) {
      const cycle = (elapsed + trap.phaseOffset) % 3.2;
      const isUp = cycle > 2.0 && cycle < 2.85;
      const warning = cycle > 1.55 && cycle <= 2.0;

      if (isUp && !trap.extended && this.playerPos.distanceTo(trap.position) < 12) {
        soundEngine.playTrapSnap();
      }
      trap.extended = isUp;

      const targetY = isUp ? 0.88 : warning ? 0.12 : -0.45;
      trap.spears.position.y = THREE.MathUtils.damp(trap.spears.position.y, targetY, 18, delta);

      if (isUp && this.playerPos.y < 0.85) {
        const dx = Math.abs(this.playerPos.x - trap.position.x);
        const dz = Math.abs(this.playerPos.z - trap.position.z);
        if (dx < 1.2 && dz < 1.2) {
          this.damagePlayer(18, 'Von der Speerfalle getroffen! Achte auf das metallische Klicken.');
        }
      }
    }

    // 2. Swinging Pendulum Crescent Blades
    for (const p of this.pendulumTraps) {
      const angle = Math.sin(elapsed * 2.15 + p.phaseOffset) * 0.72;
      p.pivot.rotation.z = angle;

      // Blade world position (pivot at y = 4.55, rod length = 3.35)
      p.bladeWorldPos.set(
        p.position.x + Math.sin(angle) * 3.35,
        4.55 - Math.cos(angle) * 3.35,
        p.position.z,
      );

      if (this.playerPos.y < 1.65) {
        const dx = Math.abs(this.playerPos.x - p.bladeWorldPos.x);
        const dz = Math.abs(this.playerPos.z - p.bladeWorldPos.z);
        if (dx < 0.95 && dz < 0.65) {
          this.damagePlayer(22, 'Von der Pendelklinge getroffen! Nutze [Shift] zum Durchsprinten.');
        }
      }
    }
  }

  private updateMummies(delta: number, elapsed: number): void {
    // Advance already-active Boss Shockwave ring even if Boss gets stunned mid-wave
    if (this.bossWaveActive) {
      this.bossWaveRadius += delta * 9.5;
      this.bossWaveRing.scale.setScalar(this.bossWaveRadius);
      const dxP = this.playerPos.x - this.bossWaveRing.position.x;
      const dzP = this.playerPos.z - this.bossWaveRing.position.z;
      const pDist = Math.hypot(dxP, dzP);
      if (!this.bossWaveHitThisCast && Math.abs(pDist - this.bossWaveRadius) < 0.78 && this.playerPos.y < 0.55) {
        this.bossWaveHitThisCast = true;
        this.damagePlayer(16, 'Von Imhoteps Fluch-Schockwelle getroffen! Springe mit [Leertaste] darüber.');
      }
      if (this.bossWaveRadius > 11.5) {
        this.bossWaveActive = false;
        this.bossWaveRing.visible = false;
      }
    }

    for (const m of this.mummies) {
      if (!m.alive) continue;

      if (m.hurtTimer > 0) {
        m.hurtTimer -= delta;
        if (m.hurtTimer <= 0) {
          m.rig.hitMaterial.emissive.setHex(0x000000);
        }
      }
      if (m.attackCooldown > 0) m.attackCooldown -= delta;
      if (m.stunTimer > 0) {
        m.stunTimer -= delta;
        // Cancel wind-up telegraph if Boss is stunned
        if (m.isBoss && this.bossWaveTelegraph > 0) {
          this.bossWaveTelegraph = 0;
          this.bossWaveCore.visible = false;
        }
        // Shiver while stunned by solar flash
        m.rig.head.rotation.y = Math.sin(elapsed * 28) * 0.25;
        continue;
      }

      const pos = m.rig.group.position;
      _v1.subVectors(this.playerPos, pos);
      _v1.y = 0;
      const dist = _v1.length();

      const detectRange = m.isBoss ? 14.5 : 10.5;
      // Don't cross chasm or closed gates
      const sameSideOfChasm =
        this.puzzle2Solved ||
        (pos.z > -45 && this.playerPos.z > -45) ||
        (pos.z < -51 && this.playerPos.z < -51);
      const gateAllows = m.isBoss ? this.puzzle2Solved && this.playerPos.z < -61.5 : this.puzzle1Solved;

      // Boss Shockwave Telegraph Wind-Up
      if (m.isBoss && gateAllows && !this.bossWaveActive) {
        if (this.bossWaveTelegraph > 0) {
          this.bossWaveTelegraph -= delta;
          this.bossWaveCore.visible = true;
          this.bossWaveCore.position.set(pos.x, 0.08, pos.z);
          const pulse = 0.6 + (1 - this.bossWaveTelegraph / 0.9) * 1.25;
          this.bossWaveCore.scale.setScalar(pulse);
          if (this.bossWaveTelegraph <= 0) {
            this.bossWaveCore.visible = false;
            this.bossWaveActive = true;
            this.bossWaveRadius = 1.1;
            this.bossWaveHitThisCast = false;
            this.bossWaveRing.visible = true;
            this.bossWaveRing.position.set(pos.x, 0.09, pos.z);
          }
        } else if (m.awakened && dist < 11.5) {
          this.bossWaveCooldown -= delta;
          if (this.bossWaveCooldown <= 0) {
            this.bossWaveCooldown = 6.2;
            this.bossWaveTelegraph = 0.9;
            soundEngine.playBossShockwave();
            this.showBanner('Wächter-Pharao beschwört eine Schockwelle — Springe [Leertaste]!');
          }
        }
      }

      if (dist < detectRange && sameSideOfChasm && gateAllows) {
        if (!m.awakened) {
          m.awakened = true;
          soundEngine.playMummyGroan();
        }
        // Face player
        const targetAngle = Math.atan2(_v1.x, _v1.z);
        m.rig.group.rotation.y = targetAngle;

        if (dist > 1.35) {
          _v1.normalize();
          pos.addScaledVector(_v1, m.speed * delta);
          this.resolveHorizontalCollision(pos, 0.48);

          // Shambling gait
          m.walkPhase += delta * m.speed * 3.1;
          m.rig.leftLeg.rotation.x = Math.sin(m.walkPhase) * 0.45;
          m.rig.rightLeg.rotation.x = -Math.sin(m.walkPhase) * 0.45;
          m.rig.leftArm.rotation.x = Math.sin(m.walkPhase) * 0.18;
          m.rig.rightArm.rotation.x = -Math.sin(m.walkPhase) * 0.18;
          m.rig.torso.rotation.z = Math.sin(m.walkPhase) * 0.06;
        } else if (m.attackCooldown <= 0) {
          m.attackCooldown = m.isBoss ? 1.35 : 1.65;
          this.damagePlayer(
            m.isBoss ? 22 : 14,
            m.isBoss ? 'Der Wächter-Pharao schlägt zu! Nutze [Q] Sonnenblitz!' : 'Eine Mumie greift dich an! Schlage mit [Klick / F]!',
          );
        }
      } else {
        // Gentle idle sway
        m.rig.leftLeg.rotation.x = THREE.MathUtils.damp(m.rig.leftLeg.rotation.x, 0, 8, delta);
        m.rig.rightLeg.rotation.x = THREE.MathUtils.damp(m.rig.rightLeg.rotation.x, 0, 8, delta);
        m.rig.head.rotation.y = Math.sin(elapsed * 0.9 + m.walkPhase) * 0.25;
      }
    }
  }

  private getTargetedMummy(): { name: string; healthRatio: number } | null {
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    let best: MummyEntity | null = null;
    let bestDist = 9.0;
    for (const m of this.mummies) {
      if (!m.alive || m.isBoss) continue;
      _v1.subVectors(m.rig.group.position, this.playerPos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > bestDist) continue;
      if (m.hurtTimer > 0 || m.awakened) {
        _v1.divideScalar(Math.max(0.01, dist));
        if (_v1.dot(_forward) > 0.35 || dist < 3.2) {
          bestDist = dist;
          best = m;
        }
      }
    }
    if (!best) return null;
    return {
      name: 'Erwachte Tempelmumie',
      healthRatio: Math.max(0, best.health / best.maxHealth),
    };
  }

  private emitHud(force: boolean): void {
    const now = this.timer.getElapsed();
    if (!force && now - this.lastHudEmit < 0.1) return;
    this.lastHudEmit = now;

    const zoneId = this.getCurrentZone();
    const activeInteract = this.phase === 'playing' ? this.getActiveInteractable() : null;
    const boss = this.mummies.find((m) => m.isBoss);
    const bossHealthRatio =
      zoneId === 'sanctum' && boss && boss.alive ? Math.max(0, boss.health / boss.maxHealth) : null;

    this.onHudUpdate({
      phase: this.phase,
      zoneId,
      zoneName: ZONE_NAMES[zoneId],
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      solarEnergy: Math.round(this.solarEnergy),
      maxSolarEnergy: this.maxSolarEnergy,
      gold: this.gold,
      treasuresFound: this.treasuresFound,
      totalTreasures: this.totalTreasures,
      secretsFound: this.secretsFound,
      totalSecrets: this.totalSecrets,
      puzzlesSolved: this.puzzlesSolved,
      totalPuzzles: this.totalPuzzles,
      mummiesDefeated: this.mummiesDefeated,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      interactPrompt: activeInteract ? activeInteract.getPrompt() : null,
      bannerMessage: this.bannerMessage,
      pointerLocked: this.pointerLocked,
      unlockedStories: Array.from(this.unlockedStories),
      activeStoryModalId: this.activeStoryModalId,
      puzzle1States: [...this.puzzle1States] as [number, number, number],
      puzzle2Progress: this.puzzle2Progress,
      puzzle3MirrorsAligned: this.puzzle3Solved,
      bossHealthRatio,
      hurtFlash: this.hurtFlash,
      visitedZones: Array.from(this.visitedZones),
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.yaw,
      objectiveText: this.getObjectiveText(),
      hasCheckpoint: this.checkpointPos !== null,
      checkpointZoneName: this.checkpointZoneName,
      targetedMummy: this.phase === 'playing' ? this.getTargetedMummy() : null,
      puzzle1Solved: this.puzzle1Solved,
      puzzle2Solved: this.puzzle2Solved,
      secret1Opened: this.secretOpened,
      secret2Opened: this.secret2Opened,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.timer.dispose();

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    canvas.removeEventListener('touchend', this.onTouchEnd);
    canvas.removeEventListener('touchcancel', this.onTouchEnd);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.textures.dispose();
    this.mats.dispose();
    this.envTexture?.dispose();
    this.envTexture = null;
    this.scene.environment = null;
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
