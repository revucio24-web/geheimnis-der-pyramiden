import * as THREE from 'three';
import { HieroglyphSymbol } from './types';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextureSet {
  sandstoneColor: THREE.CanvasTexture;
  sandstoneBump: THREE.CanvasTexture;
  hieroglyphWallColor: THREE.CanvasTexture;
  floorTileColor: THREE.CanvasTexture;
  floorTileBump: THREE.CanvasTexture;
  sandColor: THREE.CanvasTexture;
  linenColor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  symbolTextures: Record<HieroglyphSymbol, THREE.CanvasTexture>;
  dispose: () => void;
}

export function createProceduralTextures(maxAniso: number): ProceduralTextureSet {
  // 1. Sandstone Ashlar Block Color + Bump
  const [ssCanvas, ssCtx] = makeCanvas(512, 512);
  const [sbCanvas, sbCtx] = makeCanvas(512, 512);

  ssCtx.fillStyle = '#a88454';
  ssCtx.fillRect(0, 0, 512, 512);
  sbCtx.fillStyle = '#888888';
  sbCtx.fillRect(0, 0, 512, 512);

  const rows = 4;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3;
    const colW = 512 / cols;
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const shade = 148 + Math.floor((Math.sin(r * 7 + c * 13) * 0.5 + 0.5) * 32);
      const rCol = Math.min(220, shade + 24);
      const gCol = Math.min(195, shade - 4);
      const bCol = Math.max(60, shade - 50);

      ssCtx.fillStyle = `rgb(${rCol},${gCol},${bCol})`;
      ssCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

      sbCtx.fillStyle = `rgb(${150 + (r % 2) * 20},${150 + (r % 2) * 20},${150 + (r % 2) * 20})`;
      sbCtx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);

      // Subtle horizontal sedimentary streaks
      for (let s = 0; s < 6; s++) {
        const sy = y + 8 + ((s * 19 + c * 7) % (rowH - 16));
        ssCtx.fillStyle = s % 2 === 0 ? 'rgba(65, 45, 22, 0.14)' : 'rgba(245, 215, 165, 0.12)';
        ssCtx.fillRect(x + 6, sy, colW - 12, 3);
      }

      // Mortar dark line
      ssCtx.strokeStyle = 'rgba(42, 30, 16, 0.55)';
      ssCtx.lineWidth = 4;
      ssCtx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);

      sbCtx.strokeStyle = '#252525';
      sbCtx.lineWidth = 5;
      sbCtx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);
    }
  }

  // Fine sand grain speckle
  for (let i = 0; i < 3500; i++) {
    const px = (i * 97) % 512;
    const py = (i * 53 + Math.floor(i / 7) * 17) % 512;
    ssCtx.fillStyle = i % 2 === 0 ? 'rgba(40,28,14,0.12)' : 'rgba(255,235,190,0.1)';
    ssCtx.fillRect(px, py, 2, 2);
    sbCtx.fillStyle = i % 2 === 0 ? 'rgba(40,40,40,0.22)' : 'rgba(220,220,220,0.22)';
    sbCtx.fillRect(px, py, 2, 2);
  }

  const sandstoneColor = finalizeColorTexture(ssCanvas, maxAniso, 2, 2);
  const sandstoneBump = finalizeDataTexture(sbCanvas, maxAniso, 2, 2);

  // 2. Hieroglyph Wall Mural Texture
  const [hwCanvas, hwCtx] = makeCanvas(512, 512);
  hwCtx.drawImage(ssCanvas, 0, 0);

  // Top & bottom gilded frieze bands
  hwCtx.fillStyle = '#c89b3c';
  hwCtx.fillRect(0, 36, 512, 14);
  hwCtx.fillRect(0, 462, 512, 14);
  hwCtx.fillStyle = '#1f4e5f';
  hwCtx.fillRect(0, 52, 512, 8);
  hwCtx.fillRect(0, 452, 512, 8);

  // Draw lotus pattern along top frieze
  for (let x = 16; x < 512; x += 32) {
    hwCtx.fillStyle = '#d4a359';
    hwCtx.beginPath();
    hwCtx.moveTo(x, 32);
    hwCtx.lineTo(x + 8, 10);
    hwCtx.lineTo(x + 16, 32);
    hwCtx.closePath();
    hwCtx.fill();
  }

  // Carved vertical columns of stylized hieroglyphs
  hwCtx.strokeStyle = 'rgba(48, 32, 14, 0.72)';
  hwCtx.fillStyle = 'rgba(196, 146, 62, 0.45)';
  hwCtx.lineWidth = 3;
  for (let col = 0; col < 4; col++) {
    const cx = 64 + col * 128;
    hwCtx.beginPath();
    hwCtx.moveTo(cx - 46, 75);
    hwCtx.lineTo(cx - 46, 435);
    hwCtx.moveTo(cx + 46, 75);
    hwCtx.lineTo(cx + 46, 435);
    hwCtx.stroke();

    // Ankh glyph
    drawGlyphOnCtx(hwCtx, 'ankh', cx, 130, 26, '#c8963e', 'rgba(42,27,12,0.85)');
    // Eye / Scarab alternating
    drawGlyphOnCtx(hwCtx, col % 2 === 0 ? 'auge' : 'skarabaeus', cx, 235, 28, '#286475', 'rgba(42,27,12,0.85)');
    // Falcon / Snake alternating
    drawGlyphOnCtx(hwCtx, col % 2 === 0 ? 'falke' : 'lotus', cx, 355, 28, '#c8963e', 'rgba(42,27,12,0.85)');
  }
  const hieroglyphWallColor = finalizeColorTexture(hwCanvas, maxAniso, 2, 1);

  // 3. Floor Tile Texture + Bump
  const [ftCanvas, ftCtx] = makeCanvas(512, 512);
  const [fbCanvas, fbCtx] = makeCanvas(512, 512);
  ftCtx.fillStyle = '#8b6f47';
  ftCtx.fillRect(0, 0, 512, 512);
  fbCtx.fillStyle = '#7a7a7a';
  fbCtx.fillRect(0, 0, 512, 512);

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const tx = c * 128;
      const ty = r * 128;
      const v = 122 + ((r * 5 + c * 11) % 24);
      ftCtx.fillStyle = `rgb(${v + 24}, ${v + 4}, ${v - 28})`;
      ftCtx.fillRect(tx + 4, ty + 4, 120, 120);
      ftCtx.strokeStyle = 'rgba(35, 24, 14, 0.7)';
      ftCtx.lineWidth = 4;
      ftCtx.strokeRect(tx + 2, ty + 2, 124, 124);

      // Inner carved frame
      ftCtx.strokeStyle = 'rgba(212, 163, 89, 0.22)';
      ftCtx.lineWidth = 2;
      ftCtx.strokeRect(tx + 14, ty + 14, 100, 100);

      fbCtx.fillStyle = '#b8b8b8';
      fbCtx.fillRect(tx + 5, ty + 5, 118, 118);
      fbCtx.strokeStyle = '#222222';
      fbCtx.lineWidth = 6;
      fbCtx.strokeRect(tx + 2, ty + 2, 124, 124);
    }
  }
  const floorTileColor = finalizeColorTexture(ftCanvas, maxAniso, 6, 6);
  const floorTileBump = finalizeDataTexture(fbCanvas, maxAniso, 6, 6);

  // 4. Desert Sand Texture
  const [sdCanvas, sdCtx] = makeCanvas(512, 512);
  sdCtx.fillStyle = '#c89f65';
  sdCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 8) {
    const wave = Math.sin(y * 0.08) * 10;
    sdCtx.fillStyle = y % 16 === 0 ? 'rgba(240, 205, 145, 0.2)' : 'rgba(135, 95, 48, 0.16)';
    sdCtx.fillRect(0, y + wave * 0.2, 512, 5);
  }
  for (let i = 0; i < 4000; i++) {
    sdCtx.fillStyle = i % 2 === 0 ? 'rgba(255,240,205,0.16)' : 'rgba(110,75,35,0.14)';
    sdCtx.fillRect((i * 73) % 512, (i * 131) % 512, 2, 2);
  }
  const sandColor = finalizeColorTexture(sdCanvas, maxAniso, 16, 16);

  // 5. Mummy Linen Bandage Texture
  const [lnCanvas, lnCtx] = makeCanvas(256, 256);
  lnCtx.fillStyle = '#b9a684';
  lnCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 14) {
    lnCtx.fillStyle = y % 28 === 0 ? '#a99572' : '#c6b493';
    lnCtx.fillRect(0, y, 256, 12);
    lnCtx.fillStyle = 'rgba(48, 35, 20, 0.45)';
    lnCtx.fillRect(0, y + 12, 256, 2);
  }
  const linenColor = finalizeColorTexture(lnCanvas, maxAniso, 2, 2);

  // 6. Contact Shadow Radial Texture
  const [csCanvas, csCtx] = makeCanvas(128, 128);
  const grad = csCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  csCtx.fillStyle = grad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeColorTexture(csCanvas, maxAniso, 1, 1);
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  // 7. Crisp Hieroglyph Symbol Textures for Puzzle Pillars & Plates
  const symbols: HieroglyphSymbol[] = ['falke', 'skarabaeus', 'ankh', 'auge', 'lotus', 'schlange', 'sonne'];
  const symbolTextures = {} as Record<HieroglyphSymbol, THREE.CanvasTexture>;
  for (const sym of symbols) {
    const [symCanvas, symCtx] = makeCanvas(256, 256);
    symCtx.fillStyle = '#3c2c1b';
    symCtx.fillRect(0, 0, 256, 256);
    symCtx.strokeStyle = '#d4a359';
    symCtx.lineWidth = 8;
    symCtx.strokeRect(12, 12, 232, 232);
    symCtx.strokeStyle = '#1e6e7d';
    symCtx.lineWidth = 3;
    symCtx.strokeRect(24, 24, 208, 208);

    drawGlyphOnCtx(symCtx, sym, 128, 128, 68, '#f0c674', '#181008');

    const tex = finalizeColorTexture(symCanvas, maxAniso, 1, 1);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    symbolTextures[sym] = tex;
  }

  return {
    sandstoneColor,
    sandstoneBump,
    hieroglyphWallColor,
    floorTileColor,
    floorTileBump,
    sandColor,
    linenColor,
    contactShadow,
    symbolTextures,
    dispose: () => {
      sandstoneColor.dispose();
      sandstoneBump.dispose();
      hieroglyphWallColor.dispose();
      floorTileColor.dispose();
      floorTileBump.dispose();
      sandColor.dispose();
      linenColor.dispose();
      contactShadow.dispose();
      Object.values(symbolTextures).forEach((t) => t.dispose());
    },
  };
}

function drawGlyphOnCtx(
  ctx: CanvasRenderingContext2D,
  symbol: HieroglyphSymbol,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  stroke: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (symbol) {
    case 'ankh': {
      // Loop
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.42, r * 0.28, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.42, r * 0.13, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
      ctx.fillStyle = fill;
      // Crossbar & stem
      ctx.fillRect(-r * 0.55, -r * 0.08, r * 1.1, r * 0.18);
      ctx.strokeRect(-r * 0.55, -r * 0.08, r * 1.1, r * 0.18);
      ctx.fillRect(-r * 0.1, -r * 0.08, r * 0.2, r * 0.95);
      ctx.strokeRect(-r * 0.1, -r * 0.08, r * 0.2, r * 0.95);
      break;
    }
    case 'skarabaeus': {
      // Scarab oval body + wings + legs
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.42, r * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Sun disc held at top
      ctx.beginPath();
      ctx.arc(0, -r * 0.72, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Wing division & legs
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.2);
      ctx.lineTo(0, r * 0.54);
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(-r * 0.4, i * r * 0.25);
        ctx.lineTo(-r * 0.78, i * r * 0.35 - r * 0.1);
        ctx.moveTo(r * 0.4, i * r * 0.25);
        ctx.lineTo(r * 0.78, i * r * 0.35 - r * 0.1);
      }
      ctx.stroke();
      break;
    }
    case 'falke': {
      // Stylized Horus Falcon silhouette + sun crown
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, r * 0.75);
      ctx.lineTo(-r * 0.25, r * 0.1);
      ctx.lineTo(-r * 0.45, -r * 0.35);
      ctx.lineTo(-r * 0.15, -r * 0.65);
      ctx.lineTo(r * 0.25, -r * 0.55);
      ctx.lineTo(r * 0.48, -r * 0.42);
      ctx.lineTo(r * 0.22, -r * 0.3);
      ctx.lineTo(r * 0.45, r * 0.45);
      ctx.lineTo(r * 0.08, r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Sun disc on head
      ctx.beginPath();
      ctx.arc(0, -r * 0.8, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'auge': {
      // Eye of Horus
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, -r * 0.05);
      ctx.quadraticCurveTo(0, -r * 0.55, r * 0.72, -r * 0.05);
      ctx.quadraticCurveTo(0, r * 0.42, -r * 0.72, -r * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -r * 0.06, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
      ctx.fillStyle = fill;
      // Eyebrow & spiral tail
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, -r * 0.35);
      ctx.quadraticCurveTo(0, -r * 0.78, r * 0.78, -r * 0.38);
      ctx.moveTo(0, r * 0.22);
      ctx.lineTo(0, r * 0.72);
      ctx.moveTo(-r * 0.15, r * 0.32);
      ctx.quadraticCurveTo(-r * 0.45, r * 0.72, -r * 0.68, r * 0.55);
      ctx.lineWidth = r * 0.11;
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    }
    case 'lotus': {
      // Sacred Lotus Blossom
      for (const ang of [-0.55, -0.25, 0, 0.25, 0.55]) {
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.5);
        ctx.quadraticCurveTo(-r * 0.24, -r * 0.1, 0, -r * 0.68);
        ctx.quadraticCurveTo(r * 0.24, -r * 0.1, 0, r * 0.5);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillRect(-r * 0.4, r * 0.45, r * 0.8, r * 0.18);
      break;
    }
    case 'schlange': {
      // Uraeus Cobra
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, r * 0.65);
      ctx.bezierCurveTo(-r * 0.55, r * 0.2, r * 0.45, r * 0.25, r * 0.15, -r * 0.2);
      ctx.bezierCurveTo(-r * 0.15, -r * 0.55, r * 0.35, -r * 0.78, r * 0.5, -r * 0.45);
      ctx.lineWidth = r * 0.2;
      ctx.strokeStyle = fill;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.45, -r * 0.45, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sonne': {
      // Radiant Sun of Ra
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = fill;
      ctx.lineWidth = r * 0.1;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46);
        ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}
