import * as THREE from 'three';
import {
  DISCIPLINES,
  EngineeringDiscipline,
  PortfolioProject,
  PROFILE,
  SHADER_PRESETS,
  ShaderMode,
} from '../data/portfolioData';

/**
 * Generates a subtle radial contact shadow texture to ground 3D sculptures.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.45, 'rgba(2, 10, 18, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a brushed anodized metal roughness map (linear NoColorSpace).
 */
export function createBrushedMetalRoughnessMap(): THREE.CanvasTexture {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#484848';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y++) {
    const v = 52 + Math.floor(Math.sin(y * 0.41) * 14 + Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, width, 1);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an aerospace-grade iridescent photovoltaic grid texture for satellite wings.
 */
export function createSolarPanelTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#071324');
  grad.addColorStop(0.5, '#092434');
  grad.addColorStop(1, '#08182E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Cell grid lines
  ctx.strokeStyle = 'rgba(148, 210, 255, 0.35)';
  ctx.lineWidth = 2;
  const cols = 12;
  const rows = 6;
  for (let c = 1; c < cols; c++) {
    const x = (c / cols) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Fine copper/gold trace busbars
  ctx.strokeStyle = 'rgba(240, 192, 130, 0.24)';
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    const y = ((r + 0.5) / rows) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function makeTextTexture(
  width: number,
  height: number,
  maxAnisotropy: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): { texture: THREE.CanvasTexture; redraw: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);

  const redraw = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.shadowColor = 'rgba(2, 4, 8, 0.96)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    draw(ctx, width, height);
    ctx.restore();
    texture.needsUpdate = true;
  };

  redraw();
  return { texture, redraw };
}

/**
 * Chamber 0: Floating plain white bold 3D Hero Typography (no card, no box).
 */
export function createHeroTextTexture(
  maxAnisotropy: number,
  getSoundMuted: () => boolean
) {
  return makeTextTexture(1400, 920, maxAnisotropy, (ctx) => {
    const soundMuted = getSoundMuted();

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(PROFILE.brandName.toUpperCase(), 24, 24);

    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.9;
    ctx.fillText(PROFILE.roleHeadline, 24, 72);
    ctx.globalAlpha = 1;

    ctx.font = '800 86px "Outfit", sans-serif';
    const nextY = wrapText(ctx, PROFILE.heroTitle, 24, 146, 1280, 96);

    ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.94;
    const afterSubY = wrapText(ctx, PROFILE.heroSubtitle, 24, nextY + 26, 1220, 46);
    ctx.globalAlpha = 1;

    // Divider line
    const statsY = Math.max(afterSubY + 54, 610);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(24, statsY, 1260, 2);

    ctx.fillStyle = '#FFFFFF';
    const colW = 315;
    PROFILE.stats.forEach((st, idx) => {
      const sx = 24 + idx * colW;
      ctx.font = '700 50px "JetBrains Mono", monospace';
      ctx.fillText(st.value, sx, statsY + 28);
      ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
      ctx.globalAlpha = 0.88;
      ctx.fillText(st.label, sx, statsY + 92);
      ctx.globalAlpha = 1;
    });

    ctx.font = '700 25px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.94;
    ctx.fillText('SCROLL TO MOVE THROUGH 3D SPACE ↓', 24, 835);

    ctx.globalAlpha = soundMuted ? 0.65 : 1.0;
    ctx.fillText(soundMuted ? 'SOUND: OFF  [M]' : 'SOUND: ON  [M]', 950, 835);
    ctx.globalAlpha = 1;
  });
}

/**
 * Chamber 1: Floating plain white bold 3D Systems & Code Typography.
 * Includes interactive discipline tab row at known UV coordinates.
 */
export function createSystemsTextTexture(
  maxAnisotropy: number,
  getDisciplineIdx: () => number
) {
  return makeTextTexture(1400, 960, maxAnisotropy, (ctx) => {
    const activeIdx = getDisciplineIdx();
    const d: EngineeringDiscipline = DISCIPLINES[activeIdx] || DISCIPLINES[0];

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('01. SYSTEMS & CRAFT', 24, 20);

    ctx.font = '800 64px "Outfit", sans-serif';
    wrapText(ctx, 'First-Principles Engineering', 24, 66, 1300, 74);

    // Interactive Discipline Tabs (y: 175..235, divided into 4 equal x columns)
    const tabY = 180;
    const tabW = 330;
    DISCIPLINES.forEach((item, idx) => {
      const tx = 24 + idx * tabW;
      const isSelected = idx === activeIdx;
      ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
      ctx.globalAlpha = isSelected ? 1 : 0.64;
      ctx.fillText(item.title.split('&')[0].trim(), tx, tabY);
      if (isSelected) {
        ctx.fillRect(tx, tabY + 38, Math.min(270, ctx.measureText(item.title.split('&')[0].trim()).width), 4);
      }
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fillRect(24, 245, 1320, 2);
    ctx.fillStyle = '#FFFFFF';

    // Active Discipline Title & Metric
    ctx.font = '800 40px "Outfit", sans-serif';
    ctx.fillText(d.title, 24, 275);

    ctx.font = '700 25px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.94;
    ctx.fillText(`${d.metricLabel}: ${d.metricValue}`, 24, 328);
    ctx.globalAlpha = 1;

    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    const afterDesc = wrapText(ctx, d.summary, 24, 382, 1300, 42);

    // Stack
    ctx.font = '700 23px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.9;
    ctx.fillText(d.stack.join('  ·  '), 24, afterDesc + 16);
    ctx.globalAlpha = 1;

    // Code block (plain white bold monospace over clean hairline dividers)
    const codeTop = afterDesc + 70;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fillRect(24, codeTop, 1320, 2);
    ctx.fillStyle = '#FFFFFF';

    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.88;
    ctx.fillText(d.codeTitle, 24, codeTop + 18);
    ctx.globalAlpha = 1;

    ctx.font = '700 23px "JetBrains Mono", monospace';
    const lines = d.codeSnippet.split('\n');
    lines.forEach((line, lIdx) => {
      ctx.fillText(line, 24, codeTop + 58 + lIdx * 32);
    });
  });
}

/**
 * Chamber 2 Floating Section Header in 3D space.
 */
export function createProjectsHeaderTexture(maxAnisotropy: number) {
  return makeTextTexture(1400, 320, maxAnisotropy, (ctx) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText('02. SELECTED ENGINEERING', 700, 24);

    ctx.font = '800 74px "Outfit", sans-serif';
    ctx.fillText('Production Systems & Graphics Engines', 700, 74);

    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.92;
    ctx.fillText('Click any 3D monolith to flip and inspect architecture & code', 700, 174);
    ctx.globalAlpha = 1;
  });
}

/**
 * Chamber 2 Front Face of each 3D Project Monolith.
 */
export function createProjectScreenTexture(
  projectId: string,
  index: string,
  title: string,
  category: string,
  accentHex: string,
  secondaryHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const width = 1024;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#030507');
  bg.addColorStop(0.55, '#040911');
  bg.addColorStop(1, '#030807');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Mathematical/code visualization on right side with full-spectrum iridescent hues
  ctx.save();
  if (projectId === 'vortex-fluid') {
    for (let ring = 0; ring < 16; ring++) {
      ctx.beginPath();
      const baseR = 38 + ring * 16;
      const hue = (ring * 24 + 140) % 360;
      ctx.strokeStyle = `hsla(${hue}, 88%, 62%, 0.78)`;
      ctx.lineWidth = ring % 3 === 0 ? 2.6 : 1.3;
      for (let a = 0; a <= 120; a++) {
        const theta = (a / 120) * Math.PI * 2;
        const wobble =
          Math.sin(theta * 4 + ring * 0.5) * 14 +
          Math.cos(theta * 7 - ring * 0.3) * 8;
        const px = width * 0.68 + Math.cos(theta) * (baseR + wobble);
        const py = height * 0.48 + Math.sin(theta) * (baseR * 0.72 + wobble);
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  } else if (projectId === 'kronos-raft') {
    const nodes = [
      { x: 580, y: 190, hue: 160 },
      { x: 780, y: 165, hue: 205 },
      { x: 890, y: 315, hue: 280 },
      { x: 740, y: 455, hue: 38 },
      { x: 540, y: 390, hue: 330 },
    ];
    ctx.lineWidth = 2.0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const lineGrad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        lineGrad.addColorStop(0, `hsla(${nodes[i].hue}, 85%, 62%, 0.65)`);
        lineGrad.addColorStop(1, `hsla(${nodes[j].hue}, 85%, 62%, 0.65)`);
        ctx.strokeStyle = lineGrad;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
    nodes.forEach((n, idx) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, idx === 0 ? 22 : 14, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${n.hue}, 82%, 52%)`;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    });
  } else if (projectId === 'prism-compiler') {
    const levels = [
      [{ x: 690, y: 130 }],
      [
        { x: 550, y: 245 },
        { x: 690, y: 245 },
        { x: 830, y: 245 },
      ],
      [
        { x: 490, y: 365 },
        { x: 610, y: 365 },
        { x: 760, y: 365 },
        { x: 890, y: 365 },
      ],
      [
        { x: 560, y: 470 },
        { x: 720, y: 470 },
        { x: 850, y: 470 },
      ],
    ];
    ctx.lineWidth = 2;
    for (let l = 0; l < levels.length - 1; l++) {
      for (const p of levels[l]) {
        for (const c of levels[l + 1]) {
          if (Math.abs(p.x - c.x) < 180) {
            ctx.strokeStyle = `hsla(${(l * 75 + 160) % 360}, 85%, 62%, 0.68)`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.bezierCurveTo(p.x, (p.y + c.y) / 2, c.x, (p.y + c.y) / 2, c.x, c.y);
            ctx.stroke();
          }
        }
      }
    }
    levels.flat().forEach((n, i) => {
      const hue = (i * 38 + 150) % 360;
      ctx.fillStyle = `hsla(${hue}, 78%, 45%, 0.85)`;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(n.x - 28, n.y - 14, 56, 28, 6);
      ctx.fill();
      ctx.stroke();
    });
  } else {
    const bars = 42;
    for (let b = 0; b < bars; b++) {
      const bx = 456 + b * 12;
      const amp =
        (Math.sin(b * 0.35) * 0.5 + 0.5) * 180 +
        Math.cos(b * 0.8) * 45 +
        30;
      const hue = (b / bars) * 320;
      const gradBar = ctx.createLinearGradient(0, 340 - amp, 0, 340 + amp * 0.5);
      gradBar.addColorStop(0, `hsl(${hue}, 90%, 64%)`);
      gradBar.addColorStop(1, `hsl(${(hue + 65) % 360}, 85%, 45%)`);
      ctx.fillStyle = gradBar;
      ctx.fillRect(bx, 340 - amp * 0.6, 6, amp);
    }
  }
  ctx.restore();

  // Plain white bold typography on left
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';

  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.fillText(index, 52, 56);

  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(category, 52, 96);
  ctx.globalAlpha = 1;

  ctx.font = '700 46px "Outfit", sans-serif';
  wrapText(ctx, title, 52, 162, 410, 54);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(52, height - 96, width - 104, 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Click monolith to flip for code & architecture ↻', 52, height - 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Chamber 2 Back Face of each 3D Project Monolith (Architecture, Metrics & Code).
 */
export function createProjectBackTexture(
  project: PortfolioProject,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const { texture } = makeTextTexture(1024, 640, maxAnisotropy, (ctx, w, h) => {
    ctx.fillStyle = '#030507';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(`${project.index} · ${project.title}`, 44, 34);

    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    const afterArch = wrapText(ctx, project.architecture, 44, 78, w - 88, 28);

    // Metrics row
    const metY = afterArch + 14;
    project.metrics.forEach((m, idx) => {
      const mx = 44 + idx * 310;
      ctx.font = '700 26px "JetBrains Mono", monospace';
      ctx.fillText(m.value, mx, metY);
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.globalAlpha = 0.78;
      ctx.fillText(m.label, mx, metY + 34);
      ctx.globalAlpha = 1;
    });

    // Hairline
    const codeY = metY + 72;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(44, codeY, w - 88, 2);
    ctx.fillStyle = '#FFFFFF';

    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.75;
    ctx.fillText(project.codeTitle, 44, codeY + 14);
    ctx.globalAlpha = 1;

    ctx.font = '700 17px "JetBrains Mono", monospace';
    project.codeSnippet.split('\n').slice(0, 10).forEach((line, lIdx) => {
      ctx.fillText(line, 44, codeY + 44 + lIdx * 24);
    });

    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Click monolith to flip back ↻', 44, h - 42);
  });
  return texture;
}

/**
 * Chamber 3: Interactive 3D Shader Lab Typography & Controls.
 */
export function createShaderLabTextTexture(
  maxAnisotropy: number,
  getState: () => { mode: ShaderMode; freq: number; amp: number }
) {
  const modes: ShaderMode[] = ['harmonic', 'turbulence', 'lattice', 'orbital'];

  return makeTextTexture(1280, 900, maxAnisotropy, (ctx) => {
    const { mode, freq, amp } = getState();
    const preset = SHADER_PRESETS[mode];

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('03. INTERACTIVE SHADER LAB', 24, 20);

    ctx.font = '800 62px "Outfit", sans-serif';
    wrapText(ctx, 'Live Vertex & Fresnel Manifold', 24, 64, 1180, 68);

    ctx.font = '700 27px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.94;
    wrapText(
      ctx,
      'Click any algorithm or parameter below in 3D space to mutate the live GLSL shader uniforms.',
      24,
      206,
      1160,
      38
    );
    ctx.globalAlpha = 1;

    // 2x2 Interactive Mode Grid (y: 320..440)
    modes.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 24 + col * 580;
      const by = 330 + row * 68;
      const isSelected = m === mode;
      ctx.font = '700 31px "Plus Jakarta Sans", sans-serif';
      ctx.globalAlpha = isSelected ? 1 : 0.64;
      const label = SHADER_PRESETS[m].label;
      ctx.fillText(label, bx, by);
      if (isSelected) {
        ctx.fillRect(bx, by + 40, ctx.measureText(label).width, 4);
      }
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fillRect(24, 490, 1200, 2);
    ctx.fillStyle = '#FFFFFF';

    // Formula
    ctx.font = '700 25px "JetBrains Mono", monospace';
    ctx.fillText(preset.formula, 24, 520);

    ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.9;
    wrapText(ctx, preset.description, 24, 570, 1180, 35);
    ctx.globalAlpha = 1;

    // Interactive Parameter Controls (Freq & Amp +/-)
    ctx.font = '700 29px "JetBrains Mono", monospace';
    ctx.fillText(`uFreq:  ${freq.toFixed(2)} rad`, 24, 700);
    ctx.fillText('[  -  ]', 480, 700);
    ctx.fillText('[  +  ]', 640, 700);

    ctx.fillText(`uAmp:   ${amp.toFixed(2)} m`, 24, 775);
    ctx.fillText('[  -  ]', 480, 775);
    ctx.fillText('[  +  ]', 640, 775);
  });
}

/**
 * Chamber 4: Floating plain white bold 3D Collaboration & Contact Typography.
 */
export function createContactTextTexture(
  maxAnisotropy: number,
  getCopied: () => boolean
) {
  return makeTextTexture(1400, 760, maxAnisotropy, (ctx) => {
    const copied = getCopied();

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillText('04. COLLABORATION', 700, 30);

    ctx.font = '800 78px "Outfit", sans-serif';
    wrapText(ctx, "Let's Architect Something Remarkable", 700, 86, 1240, 88);

    ctx.font = '700 29px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.94;
    ctx.fillText(
      'Available for staff engineering roles, graphics R&D, and architecture consulting.',
      700,
      292
    );
    ctx.globalAlpha = 1;

    // Clickable Email (y: 380..460)
    ctx.font = '700 46px "JetBrains Mono", monospace';
    const emailLabel = copied ? `${PROFILE.email}  (COPIED ✓)` : PROFILE.email;
    ctx.fillText(emailLabel, 700, 396);
    const emailW = ctx.measureText(emailLabel).width;
    ctx.fillRect(700 - emailW / 2, 456, emailW, 4);

    // Bottom Interactive Links (y: 540..620)
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('GitHub ↗', 350, 560);
    ctx.fillText('LinkedIn ↗', 700, 560);
    ctx.fillText('Return to Core ↑', 1050, 560);
  });
}
