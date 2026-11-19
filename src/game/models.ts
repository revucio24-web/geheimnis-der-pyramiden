import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { HieroglyphSymbol } from './types';

export interface MaterialLibrary {
  sandstone: THREE.MeshStandardMaterial;
  hieroglyphWall: THREE.MeshStandardMaterial;
  floorTile: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  obsidian: THREE.MeshStandardMaterial;
  brushedGold: THREE.MeshPhysicalMaterial;
  tarnishedBronze: THREE.MeshStandardMaterial;
  lapis: THREE.MeshStandardMaterial;
  linen: THREE.MeshStandardMaterial;
  emeraldGlow: THREE.MeshStandardMaterial;
  amberGlow: THREE.MeshStandardMaterial;
  crystal: THREE.MeshPhysicalMaterial;
  terracotta: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createMaterialLibrary(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): MaterialLibrary {
  const sandstone = new THREE.MeshStandardMaterial({
    map: textures.sandstoneColor,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.04,
    roughness: 0.88,
    metalness: 0.04,
  });

  const hieroglyphWall = new THREE.MeshStandardMaterial({
    map: textures.hieroglyphWallColor,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.035,
    roughness: 0.8,
    metalness: 0.08,
  });

  const floorTile = new THREE.MeshStandardMaterial({
    map: textures.floorTileColor,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.03,
    roughness: 0.82,
    metalness: 0.06,
  });

  const sand = new THREE.MeshStandardMaterial({
    map: textures.sandColor,
    roughness: 0.94,
    metalness: 0.02,
  });

  const obsidian = new THREE.MeshStandardMaterial({
    color: 0x1a181c,
    roughness: 0.38,
    metalness: 0.25,
  });

  const brushedGold = new THREE.MeshPhysicalMaterial({
    color: 0xe3b448,
    metalness: 0.92,
    roughness: 0.2,
    anisotropy: 0.75,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });

  const tarnishedBronze = new THREE.MeshStandardMaterial({
    color: 0x7a5b32,
    metalness: 0.82,
    roughness: 0.42,
  });

  const lapis = new THREE.MeshStandardMaterial({
    color: 0x164e78,
    roughness: 0.32,
    metalness: 0.18,
  });

  const linen = new THREE.MeshStandardMaterial({
    map: textures.linenColor,
    roughness: 0.92,
    metalness: 0.02,
  });

  const emeraldGlow = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 2.0,
    roughness: 0.2,
    metalness: 0.1,
  });

  const amberGlow = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });

  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xfff3c4,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.65,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.65 : 1.0,
    ior: 1.75,
    thickness: 1.2,
    clearcoat: 1.0,
  });

  const terracotta = new THREE.MeshStandardMaterial({
    color: 0xb6653c,
    roughness: 0.72,
    metalness: 0.08,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  return {
    sandstone,
    hieroglyphWall,
    floorTile,
    sand,
    obsidian,
    brushedGold,
    tarnishedBronze,
    lapis,
    linen,
    emeraldGlow,
    amberGlow,
    crystal,
    terracotta,
    contactShadowMat,
    dispose: () => {
      sandstone.dispose();
      hieroglyphWall.dispose();
      floorTile.dispose();
      sand.dispose();
      obsidian.dispose();
      brushedGold.dispose();
      tarnishedBronze.dispose();
      lapis.dispose();
      linen.dispose();
      emeraldGlow.dispose();
      amberGlow.dispose();
      crystal.dispose();
      terracotta.dispose();
      contactShadowMat.dispose();
    },
  };
}

export function addContactShadow(parent: THREE.Object3D, mats: MaterialLibrary, radius: number): void {
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mats.contactShadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  parent.add(shadowPlane);
}

export interface MummyRig {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
  torso: THREE.Mesh;
  hitMaterial: THREE.MeshStandardMaterial;
}

export function createMummyModel(mats: MaterialLibrary, isBoss = false): MummyRig {
  const group = new THREE.Group();
  const scale = isBoss ? 1.28 : 1.0;
  group.scale.setScalar(scale);

  // Isolated clone so individual mummies flash on hit without flashing others
  const hitMaterial = mats.linen.clone();

  addContactShadow(group, mats, 0.72);

  // 1. Pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.3), hitMaterial);
  pelvis.position.y = 0.88;
  pelvis.castShadow = true;
  group.add(pelvis);

  // 2. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.34), hitMaterial);
  torso.position.y = 1.28;
  torso.castShadow = true;
  group.add(torso);

  // 3. Pharaonic Collar / Chest Bandage Wrap
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.14, 10),
    isBoss ? mats.brushedGold : mats.tarnishedBronze,
  );
  collar.position.y = 1.56;
  group.add(collar);

  // Boss glowing chest heart
  if (isBoss) {
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mats.emeraldGlow);
    heart.position.set(0, 1.32, 0.19);
    group.add(heart);
  }

  // 4. Head Group
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.32), hitMaterial);
  skull.castShadow = true;
  head.add(skull);

  // Eyes (5 & 6)
  const eyeMat = isBoss ? mats.emeraldGlow : mats.amberGlow;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
  eyeL.position.set(-0.075, 0.03, 0.16);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
  eyeR.position.set(0.075, 0.03, 0.16);
  head.add(eyeL, eyeR);

  // Crown for Boss Mummy
  if (isBoss) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 6), mats.brushedGold);
    crown.position.set(0, 0.32, -0.02);
    head.add(crown);
    const nemesL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.24), mats.lapis);
    nemesL.position.set(-0.2, -0.04, 0);
    const nemesR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.24), mats.lapis);
    nemesR.position.set(0.2, -0.04, 0);
    head.add(nemesL, nemesR);
  }
  group.add(head);

  // 7 & 8. Articulated Arms (outstretched zombie/mummy pose)
  const makeArm = (side: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.36, 1.5, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.16), hitMaterial);
    upper.position.set(0, -0.22, 0.12);
    upper.rotation.x = -Math.PI / 2.4;
    upper.castShadow = true;
    armPivot.add(upper);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.1, 8),
      isBoss ? mats.brushedGold : mats.tarnishedBronze,
    );
    cuff.position.set(0, -0.38, 0.34);
    cuff.rotation.x = Math.PI / 2;
    armPivot.add(cuff);
    return armPivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  group.add(leftArm, rightArm);

  // 9 & 10. Articulated Legs
  const makeLeg = (side: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.14, 0.82, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.2), hitMaterial);
    legMesh.position.y = -0.41;
    legMesh.castShadow = true;
    legPivot.add(legMesh);
    return legPivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  group.add(leftLeg, rightLeg);

  return { group, leftArm, rightArm, leftLeg, rightLeg, head, torso, hitMaterial };
}

export function createAnubisStatueModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, mats, 1.4);

  // 1. Stepped Plinth
  const plinth1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 2.2), mats.sandstone);
  plinth1.position.y = 0.225;
  plinth1.receiveShadow = true;
  plinth1.castShadow = true;
  group.add(plinth1);

  const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.45, 1.75), mats.obsidian);
  plinth2.position.y = 0.675;
  plinth2.castShadow = true;
  group.add(plinth2);

  // 2. Seated Obsidian Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.55, 0.72), mats.obsidian);
  torso.position.set(0, 1.65, -0.15);
  torso.castShadow = true;
  group.add(torso);

  // 3. Kilt / Lower Legs
  const knees = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.7, 1.05), mats.brushedGold);
  knees.position.set(0, 1.25, 0.2);
  group.add(knees);

  // 4. Golden Collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.66, 0.22, 8), mats.brushedGold);
  collar.position.set(0, 2.4, -0.1);
  group.add(collar);

  // 5. Jackal Head & Snout
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.62), mats.obsidian);
  head.position.set(0, 2.8, -0.05);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.68), mats.obsidian);
  snout.position.set(0, 2.7, 0.46);
  group.add(snout);

  // 6 & 7. Tall Jackal Ears
  const earGeo = new THREE.ConeGeometry(0.12, 0.72, 4);
  const earL = new THREE.Mesh(earGeo, mats.brushedGold);
  earL.position.set(-0.18, 3.35, -0.12);
  const earR = new THREE.Mesh(earGeo, mats.brushedGold);
  earR.position.set(0.18, 3.35, -0.12);
  group.add(earL, earR);

  // 8. Glowing Amber Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mats.amberGlow);
  eyeL.position.set(-0.14, 2.86, 0.25);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mats.amberGlow);
  eyeR.position.set(0.14, 2.86, 0.25);
  group.add(eyeL, eyeR);

  return group;
}

export function createSarcophagusModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, mats, 2.4);

  // 1. Stone Dais
  const dais = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 5.4), mats.sandstone);
  dais.position.y = 0.2;
  dais.receiveShadow = true;
  group.add(dais);

  // 2. Granite Coffin Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.85, 3.3), mats.obsidian);
  base.position.y = 0.825;
  base.castShadow = true;
  group.add(base);

  // 3. Golden Royal Lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.34, 3.1), mats.brushedGold);
  lid.position.y = 1.42;
  lid.castShadow = true;
  group.add(lid);

  // 4. Sculpted Pharaoh Mask & Nemes Headdress
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.8), mats.brushedGold);
  mask.position.set(0, 1.7, -0.9);
  group.add(mask);

  const nemes = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.35, 0.72), mats.lapis);
  nemes.position.set(0, 1.62, -0.92);
  group.add(nemes);

  // 5. Crossed Arms with Crook & Flail
  const arms = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.48), mats.brushedGold);
  arms.position.set(0, 1.62, -0.1);
  group.add(arms);

  // 6. Floating Crystal Prism above Sarcophagus (target for solar beams)
  const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), mats.crystal);
  prism.position.set(0, 3.25, 0);
  prism.name = 'SanctumPrism';
  group.add(prism);

  return group;
}

export interface BrazierRef {
  group: THREE.Group;
  flame: THREE.Mesh;
  light: THREE.PointLight | null;
}

export function createBrazierModel(mats: MaterialLibrary, withLight = true): BrazierRef {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.65);

  // 1. Base Pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.25, 8), mats.obsidian);
  base.position.y = 0.125;
  group.add(base);

  // 2. Column Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 8), mats.tarnishedBronze);
  stem.position.y = 0.7;
  stem.castShadow = true;
  group.add(stem);

  // 3. Bronze Bowl (LatheGeometry)
  const bowlPts = [
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.42, 0.12),
    new THREE.Vector2(0.48, 0.28),
    new THREE.Vector2(0.42, 0.3),
    new THREE.Vector2(0.05, 0.08),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 12), mats.tarnishedBronze);
  bowl.position.y = 1.1;
  bowl.castShadow = true;
  group.add(bowl);

  // 4. Embers
  const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.1, 8), mats.amberGlow);
  embers.position.y = 1.32;
  group.add(embers);

  // 5. Animated Flame Cone
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 7), flameMat);
  flame.position.y = 1.62;
  group.add(flame);

  let light: THREE.PointLight | null = null;
  if (withLight) {
    light = new THREE.PointLight(0xff9c3b, 5.5, 16, 1.5);
    light.position.set(0, 1.9, 0);
    group.add(light);
  }

  return { group, flame, light };
}

export function createTreasureChestModel(mats: MaterialLibrary): { group: THREE.Group; lid: THREE.Group } {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.8);

  // 1. Cedar + Bronze Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 0.72), mats.obsidian);
  body.position.y = 0.29;
  body.castShadow = true;
  group.add(body);

  // 2. Gold Corner Bands
  const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.61, 0.75), mats.brushedGold);
  bandL.position.set(-0.42, 0.3, 0);
  const bandR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.61, 0.75), mats.brushedGold);
  bandR.position.set(0.42, 0.3, 0);
  group.add(bandL, bandR);

  // 3. Interior Gold Pile
  const goldPile = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.2, 0.52), mats.brushedGold);
  goldPile.position.y = 0.52;
  group.add(goldPile);

  // 4. Hinged Lid Group
  const lid = new THREE.Group();
  lid.position.set(0, 0.58, -0.36);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.74), mats.brushedGold);
  lidMesh.position.set(0, 0.12, 0.36);
  lidMesh.castShadow = true;
  lid.add(lidMesh);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), mats.lapis);
  lock.position.set(0, 0.02, 0.74);
  lid.add(lock);
  group.add(lid);

  return { group, lid };
}

export function createTreasureRelicModel(
  mats: MaterialLibrary,
  kind: 'scarab' | 'chalice' | 'eye' | 'crown',
): { group: THREE.Group; floatingPart: THREE.Group } {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.65);

  // 1. Carved Stone Pedestal
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.95), mats.sandstone);
  base.position.y = 0.11;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.78, 8), mats.obsidian);
  column.position.y = 0.61;
  column.castShadow = true;
  group.add(column);

  // 2. Floating Golden Artifact
  const floatingPart = new THREE.Group();
  floatingPart.position.y = 1.38;

  if (kind === 'scarab') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mats.brushedGold);
    body.scale.set(0.85, 0.6, 1.25);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mats.lapis);
    gem.position.set(0, 0.12, 0);
    floatingPart.add(body, gem);
  } else if (kind === 'chalice') {
    const pts = [
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.06, 0.14),
      new THREE.Vector2(0.06, 0.28),
      new THREE.Vector2(0.26, 0.52),
      new THREE.Vector2(0.21, 0.54),
      new THREE.Vector2(0.04, 0.32),
    ];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mats.brushedGold);
    cup.position.y = -0.24;
    floatingPart.add(cup);
  } else if (kind === 'eye') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 20), mats.brushedGold);
    const pupil = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), mats.emeraldGlow);
    floatingPart.add(ring, pupil);
  } else {
    // Royal Crown of Eternity
    const circlet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.22, 12), mats.brushedGold);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), mats.brushedGold);
    spire.position.y = 0.24;
    const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), mats.amberGlow);
    sunOrb.position.set(0, 0.45, 0);
    floatingPart.add(circlet, spire, sunOrb);
  }

  group.add(floatingPart);
  return { group, floatingPart };
}

export function createPuzzlePillarModel(
  mats: MaterialLibrary,
  textures: ProceduralTextureSet,
  symbols: [HieroglyphSymbol, HieroglyphSymbol, HieroglyphSymbol, HieroglyphSymbol],
): { group: THREE.Group; drum: THREE.Group } {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.85);

  // 1. Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.3), mats.sandstone);
  base.position.y = 0.275;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Rotating Drum with 4 Hieroglyph faces
  const drum = new THREE.Group();
  drum.position.y = 1.25;
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.25, 0.96), mats.obsidian);
  core.castShadow = true;
  drum.add(core);

  // 4 symbol plaques on +Z, +X, -Z, -X faces
  const dirs = [
    { pos: [0, 0, 0.49], rotY: 0 },
    { pos: [0.49, 0, 0], rotY: Math.PI / 2 },
    { pos: [0, 0, -0.49], rotY: Math.PI },
    { pos: [-0.49, 0, 0], rotY: -Math.PI / 2 },
  ];
  symbols.forEach((sym, i) => {
    const faceMat = new THREE.MeshStandardMaterial({
      map: textures.symbolTextures[sym],
      roughness: 0.45,
      metalness: 0.25,
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), faceMat);
    plaque.position.set(dirs[i].pos[0], dirs[i].pos[1], dirs[i].pos[2]);
    plaque.rotation.y = dirs[i].rotY;
    drum.add(plaque);
  });

  group.add(drum);

  // 3. Gilded Cap + Indicator Arrow pointing at front (+Z)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.15), mats.sandstone);
  cap.position.y = 2.02;
  group.add(cap);

  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 4), mats.brushedGold);
  marker.rotation.x = Math.PI;
  marker.position.set(0, 2.15, 0.56);
  group.add(marker);

  return { group, drum };
}

export function createSolarMirrorModel(mats: MaterialLibrary): {
  group: THREE.Group;
  yoke: THREE.Group;
  beam: THREE.Mesh;
} {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.9);

  // 1. Pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.95, 8), mats.sandstone);
  base.position.y = 0.475;
  base.castShadow = true;
  group.add(base);

  // 2. Rotating Yoke
  const yoke = new THREE.Group();
  yoke.position.y = 1.45;

  const frameRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 10, 24), mats.brushedGold);
  yoke.add(frameRing);

  const mirrorDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 20), mats.crystal);
  mirrorDisc.rotation.x = Math.PI / 2;
  yoke.add(mirrorDisc);

  // Reflected Light Beam Cone extending along +Z of yoke
  const beamGeo = new THREE.CylinderGeometry(0.12, 0.35, 12.5, 10, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 6.25);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd275,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.x = -0.153;
  yoke.add(beam);

  group.add(yoke);
  return { group, yoke, beam };
}

export function createSpikeTrapModel(mats: MaterialLibrary): { group: THREE.Group; spears: THREE.Group } {
  const group = new THREE.Group();

  // Bronze floor grate
  const grate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 2.6), mats.tarnishedBronze);
  grate.position.y = 0.03;
  grate.receiveShadow = true;
  group.add(grate);

  const spears = new THREE.Group();
  const spearGeo = new THREE.ConeGeometry(0.08, 1.35, 6);
  for (let x = -0.8; x <= 0.81; x += 0.8) {
    for (let z = -0.8; z <= 0.81; z += 0.8) {
      const s = new THREE.Mesh(spearGeo, mats.brushedGold);
      s.position.set(x, -0.68, z);
      spears.add(s);
    }
  }
  group.add(spears);
  return { group, spears };
}

export function createPendulumTrapModel(mats: MaterialLibrary): { group: THREE.Group; pivot: THREE.Group } {
  const group = new THREE.Group();

  // Ceiling anchor
  const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), mats.tarnishedBronze);
  anchor.position.y = 4.65;
  group.add(anchor);

  const pivot = new THREE.Group();
  pivot.position.y = 4.55;

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 8), mats.tarnishedBronze);
  rod.position.y = -1.65;
  pivot.add(rod);

  // Crescent Axe Blade
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-1.15, 0.25);
  bladeShape.quadraticCurveTo(0, -0.75, 1.15, 0.25);
  bladeShape.quadraticCurveTo(0, -0.22, -1.15, 0.25);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  bladeGeo.center();
  const blade = new THREE.Mesh(bladeGeo, mats.brushedGold);
  blade.position.y = -3.35;
  blade.castShadow = true;
  pivot.add(blade);

  group.add(pivot);
  return { group, pivot };
}

export function createStoneTabletModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.7);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.65), mats.sandstone);
  plinth.position.y = 0.175;
  group.add(plinth);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.35, 0.22), mats.obsidian);
  slab.position.y = 1.02;
  slab.castShadow = true;
  group.add(slab);

  const glyphBand = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.96), mats.amberGlow);
  glyphBand.position.set(0, 1.05, 0.115);
  group.add(glyphBand);

  return group;
}

export function createTorchWeaponModel(mats: MaterialLibrary): {
  group: THREE.Group;
  flame: THREE.Mesh;
} {
  const group = new THREE.Group();

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.52, 8), mats.tarnishedBronze);
  handle.rotation.x = 0.35;
  group.add(handle);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.03, 0.12, 8), mats.brushedGold);
  head.position.set(0, 0.26, -0.09);
  head.rotation.x = 0.35;
  group.add(head);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.2, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb84d }),
  );
  flame.position.set(0, 0.38, -0.14);
  group.add(flame);
  group.scale.setScalar(0.78);

  return { group, flame };
}

export function createClayUrnModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.42);

  // Lathe profile for ceramic pharaonic urn
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.02),
    new THREE.Vector2(0.28, 0.24),
    new THREE.Vector2(0.32, 0.46),
    new THREE.Vector2(0.22, 0.66),
    new THREE.Vector2(0.14, 0.78),
    new THREE.Vector2(0.19, 0.88),
    new THREE.Vector2(0.14, 0.9),
    new THREE.Vector2(0.11, 0.78),
  ];
  const vessel = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), mats.terracotta);
  vessel.castShadow = true;
  vessel.receiveShadow = true;
  group.add(vessel);

  // Decorative bronze & gold bands
  const bellyBand = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.02, 6, 18), mats.tarnishedBronze);
  bellyBand.rotation.x = Math.PI / 2;
  bellyBand.position.y = 0.48;
  group.add(bellyBand);

  const collarBand = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 16), mats.brushedGold);
  collarBand.rotation.x = Math.PI / 2;
  collarBand.position.y = 0.78;
  group.add(collarBand);

  return group;
}

export function createCrackedWallModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  // Slightly recessed sandstone slab (width 3.0m along X, height 3.4m, depth 0.48m)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.4, 0.46), mats.sandstone);
  slab.position.y = 1.7;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  // Visible dark fracture lines + subtle golden glint indicating breakable masonry
  const crackDefs = [
    { x: -0.35, y: 1.9, rotZ: 0.42, len: 1.5 },
    { x: 0.22, y: 1.45, rotZ: -0.58, len: 1.65 },
    { x: -0.1, y: 1.15, rotZ: 0.18, len: 1.2 },
    { x: 0.52, y: 2.25, rotZ: 0.75, len: 1.05 },
  ];
  crackDefs.forEach((c) => {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.07, c.len, 0.5), mats.obsidian);
    crack.position.set(c.x, c.y, 0);
    crack.rotation.z = c.rotZ;
    group.add(crack);
  });

  // Faint amber crystal seam behind crack
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.51), mats.amberGlow);
  seam.position.set(0.05, 1.55, 0);
  seam.rotation.z = -0.35;
  group.add(seam);

  return group;
}
