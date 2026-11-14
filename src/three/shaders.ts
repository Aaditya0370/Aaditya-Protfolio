import * as THREE from 'three';

const SPECTRAL_PALETTE_GLSL = `
  // Inigo Quilez cosine spectral interference palette (limitless full-spectrum hues)
  vec3 spectralPalette(float t) {
    vec3 a = vec3(0.45, 0.48, 0.54);
    vec3 b = vec3(0.48, 0.46, 0.46);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.05, 0.35, 0.68);
    return a + b * cos(6.2831853 * (c * t + d));
  }
`;

/**
 * Abyssal topographic wave grid floor spanning the 3D scroll corridor.
 * Deep obsidian base with full-spectrum iridescent elevation isolines & matched film grain.
 */
export function createWaveFloorMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uDeepBlack: { value: new THREE.Color('#020406') },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uMouse;

      out float vElevation;
      out vec2 vWorldXZ;
      out float vDistFromCam;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        float wave1 = sin(worldPos.x * 0.16 + uTime * 0.55) * cos(worldPos.z * 0.12 - uTime * 0.35);
        float wave2 = sin(worldPos.x * 0.06 - worldPos.z * 0.08 + uTime * 0.25) * 1.45;
        float mouseInfluence = sin(length(worldPos.xz * 0.08 - uMouse * 3.0) - uTime * 1.2) * 0.38;

        float elevation = wave1 * 0.85 + wave2 + mouseInfluence;
        worldPos.y += elevation;

        vElevation = elevation;
        vWorldXZ = worldPos.xz;

        vec4 mvPosition = viewMatrix * worldPos;
        vDistFromCam = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform vec3 uDeepBlack;

      in float vElevation;
      in vec2 vWorldXZ;
      in float vDistFromCam;

      out vec4 fragColor;

      ${SPECTRAL_PALETTE_GLSL}

      float grainHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec2 gridCoord = abs(fract(vWorldXZ * 0.35 - 0.5) - 0.5) / fwidth(vWorldXZ * 0.35);
        float gridLine = 1.0 - min(min(gridCoord.x, gridCoord.y), 1.0);

        float contour = abs(fract(vElevation * 1.4 - 0.5) - 0.5) / fwidth(vElevation * 1.4);
        float isoline = 1.0 - min(contour, 1.0);

        float crest = smoothstep(-0.6, 1.9, vElevation);
        float phase = vWorldXZ.x * 0.015 + vWorldXZ.y * 0.01 + vElevation * 0.18 + uTime * 0.03 + uScroll * 0.5;
        vec3 prism = spectralPalette(phase);

        // Liquid-obsidian radial sheen around camera corridor
        float radialGlow = exp(-length(vWorldXZ * 0.035));
        vec3 baseTone = mix(uDeepBlack, prism * 0.085, crest * 0.68);
        vec3 col = baseTone;
        col += prism * gridLine * 0.15;
        col += mix(prism, vec3(1.0), crest * 0.25) * isoline * 0.25;
        col += spectralPalette(phase + 0.25) * radialGlow * 0.045;

        float grain = (grainHash(gl_FragCoord.xy + fract(uTime * 1.37) * 256.0) - 0.5) * 0.016;
        col += grain;

        float fade = smoothstep(130.0, 14.0, vDistFromCam);
        fragColor = vec4(max(col, 0.0) * fade, fade * 0.94);
      }
    `,
    transparent: true,
    depthWrite: true,
  });
}

/**
 * Full-screen WebGL void backdrop shader using 2D simplex noise + subtle iridescent wisps
 * and animated film grain to add deep atmospheric texture to the background voids.
 */
export function createVoidBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(1440, 900) },
      uVoidBlack: { value: new THREE.Color('#020305') },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      out vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.99999, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uMouse;
      uniform vec2 uResolution;
      uniform vec3 uVoidBlack;

      in vec2 vUv;
      out vec4 fragColor;

      ${SPECTRAL_PALETTE_GLSL}

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(
          0.211324865405187,
          0.366025403784439,
          -0.577350269189626,
          0.024390243902439
        );
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 3; i++) {
          val += amp * snoise(p);
          p = p * 2.04 + vec2(17.1, -9.3);
          amp *= 0.5;
        }
        return val * 0.5 + 0.5;
      }

      float grainHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 centered = (vUv - 0.5) * vec2(aspect, 1.0);

        vec2 drift = vec2(uScroll * 1.15 + uTime * 0.018, -uScroll * 0.45 + uTime * 0.012);
        vec2 coord = centered * 1.35 + drift - uMouse * 0.06;

        float n1 = fbm(coord);
        float n2 = fbm(coord * 1.85 + vec2(4.2, -3.1));
        float aurora = exp(-abs(centered.y * 2.1 - (n1 - 0.5) * 1.1) * 3.8) * smoothstep(0.32, 0.85, n2);

        float vignette = smoothstep(1.46, 0.14, length(centered));
        vec3 nebulaHue1 = spectralPalette(n1 * 0.75 + uScroll * 0.8 + uTime * 0.015);
        vec3 nebulaHue2 = spectralPalette(n2 * 0.85 + 0.42 + uScroll * 0.5);
        vec3 auroraHue = spectralPalette(centered.x * 0.35 + n2 * 0.4 + uScroll * 0.9 + uTime * 0.02);

        vec3 col = uVoidBlack;
        col += nebulaHue1 * smoothstep(0.36, 0.88, n1) * 0.052 * vignette;
        col += nebulaHue2 * smoothstep(0.48, 0.94, n2) * 0.038 * vignette;
        col += auroraHue * aurora * 0.048 * vignette;

        float grain = (grainHash(gl_FragCoord.xy + fract(uTime * 1.618) * 384.0) - 0.5) * 0.024;
        col += grain;

        fragColor = vec4(max(col, 0.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  });
}

/**
 * Custom GLSL Iridescent Thin-Film Prism Shader for Hero Crystal Cores & Geodesic Relics.
 */
export function createIridescentPrismMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.94 },
      uFocus: { value: 1.0 },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      out vec3 vNormalView;
      out vec3 vViewPos;
      out vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFocus;

      in vec3 vNormalView;
      in vec3 vViewPos;
      in vec3 vLocalPos;

      out vec4 fragColor;

      ${SPECTRAL_PALETTE_GLSL}

      void main() {
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vViewPos);
        float ndotv = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - ndotv, 2.2);

        // Thin-film optical path difference drives limitless rainbow spectrum
        float filmShift = ndotv * 1.4 + vLocalPos.y * 0.45 + vLocalPos.x * 0.25 + uTime * 0.14;
        vec3 iridescence = spectralPalette(filmShift);

        float scanBand = smoothstep(0.85, 1.0, sin(vLocalPos.y * 14.0 - uTime * 3.2) * 0.5 + 0.5);
        float focusGain = 0.72 + uFocus * 0.48;

        vec3 baseObsidian = vec3(0.012, 0.018, 0.028);
        vec3 col = mix(baseObsidian, iridescence, fresnel * (0.65 + uFocus * 0.2) + 0.08);
        col += iridescence * scanBand * 0.78 * focusGain;
        col += mix(iridescence, vec3(1.0), 0.35) * pow(fresnel, 3.0) * 1.75 * focusGain;

        fragColor = vec4(col, uOpacity);
      }
    `,
    transparent: true,
  });
}

/**
 * Custom GLSL Holographic Energy Conduit Shader for TubeGeometry fiber buses & Dyson rings.
 */
export function createHologramConduitMaterial(phaseOffset = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phaseOffset },
      uFocus: { value: 0.0 },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      out vec2 vUv;
      out vec3 vNormalView;
      out vec3 vViewPos;

      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uFocus;

      in vec2 vUv;
      in vec3 vNormalView;
      in vec3 vViewPos;

      out vec4 fragColor;

      ${SPECTRAL_PALETTE_GLSL}

      void main() {
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vViewPos);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 1.8);

        float pulse = smoothstep(0.62, 0.99, sin(vUv.x * 24.0 - uTime * 4.0 + uPhase) * 0.5 + 0.5);
        vec3 spectrum = spectralPalette(vUv.x * 1.4 + uTime * 0.18 + uPhase);
        float focusGain = 0.76 + uFocus * 0.44;

        vec3 col = (spectrum * (0.28 + fresnel * 1.05) + mix(spectrum, vec3(1.0), 0.25) * pulse * 1.65) * focusGain;
        fragColor = vec4(col, 0.78 + uFocus * 0.14);
      }
    `,
    transparent: true,
  });
}

/**
 * Interactive Chamber 3 Manifold ShaderMaterial.
 * Supports 4 algorithmic displacement modes + full-spectrum iridescent thin-film Fresnel shading.
 */
export function createShaderLabMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: 0 }, // 0=harmonic, 1=turbulence, 2=lattice, 3=orbital
      uFreq: { value: 2.4 },
      uAmp: { value: 0.28 },
      uFocus: { value: 0.0 },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      uniform float uTime;
      uniform float uMode;
      uniform float uFreq;
      uniform float uAmp;

      out vec3 vNormalView;
      out vec3 vViewPos;
      out float vDisp;
      out vec3 vLocalPos;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise3D(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
            f.y
          ),
          mix(
            mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
            f.y
          ),
          f.z
        );
      }

      float computeDisplacement(vec3 p) {
        if (uMode < 0.5) {
          return sin(p.x * uFreq + uTime * 1.4)
               * cos(p.y * uFreq - uTime * 1.1)
               * sin(p.z * uFreq + uTime * 0.9) * uAmp;
        } else if (uMode < 1.5) {
          vec3 q = p * (uFreq * 0.45) + vec3(0.0, uTime * 0.45, uTime * 0.25);
          float n = noise3D(q) * 0.65 + noise3D(q * 2.1) * 0.35;
          return (n - 0.5) * 2.0 * uAmp;
        } else if (uMode < 2.5) {
          float wave = sin(length(p.xz) * uFreq - uTime * 1.8) + cos(p.y * uFreq * 0.8 + uTime);
          float stepped = floor(wave * 3.5) / 3.5;
          return stepped * uAmp * 0.7;
        } else {
          float angle = atan(p.z, p.x);
          return sin(angle * 6.0 + p.y * uFreq - uTime * 1.8) * uAmp * 0.85;
        }
      }

      void main() {
        float d = computeDisplacement(position);
        vec3 displaced = position + normal * d;

        float eps = 0.04;
        vec3 tangent1 = normalize(abs(normal.x) < 0.9 ? cross(normal, vec3(1.0, 0.0, 0.0)) : cross(normal, vec3(0.0, 1.0, 0.0)));
        vec3 tangent2 = normalize(cross(normal, tangent1));

        vec3 p1 = position + tangent1 * eps;
        vec3 p2 = position + tangent2 * eps;
        vec3 d1 = p1 + normal * computeDisplacement(p1);
        vec3 d2 = p2 + normal * computeDisplacement(p2);
        vec3 approxNormal = normalize(cross(d1 - displaced, d2 - displaced));

        vDisp = d;
        vLocalPos = displaced;
        vNormalView = normalize(normalMatrix * approxNormal);
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vViewPos = mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAmp;
      uniform float uFocus;

      in vec3 vNormalView;
      in vec3 vViewPos;
      in float vDisp;
      in vec3 vLocalPos;

      out vec4 fragColor;

      ${SPECTRAL_PALETTE_GLSL}

      void main() {
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(-vViewPos);

        vec3 L1 = normalize(vec3(0.7, 0.9, 0.6));
        vec3 L2 = normalize(vec3(-0.8, -0.3, 0.5));
        float diff1 = max(dot(N, L1), 0.0);
        float diff2 = max(dot(N, L2), 0.0);

        vec3 H1 = normalize(L1 + V);
        float spec = pow(max(dot(N, H1), 0.0), 56.0);

        float ndotv = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - ndotv, 2.5);
        float normDisp = clamp((vDisp / max(uAmp, 0.05)) * 0.5 + 0.5, 0.0, 1.0);

        // Limitless thin-film rainbow spectrum driven by view angle + crest displacement
        float spectrumT = ndotv * 1.15 + normDisp * 0.75 + vLocalPos.y * 0.12 + uTime * 0.08;
        vec3 prismColor = spectralPalette(spectrumT);
        vec3 secondaryPrism = spectralPalette(spectrumT + 0.38);
        float focusGain = 0.75 + uFocus * 0.48;

        vec3 obsidianBase = vec3(0.012, 0.016, 0.026);
        vec3 lit = mix(obsidianBase, prismColor, diff1 * 0.48 + normDisp * 0.24);
        lit += secondaryPrism * diff2 * 0.22;
        lit += prismColor * pow(fresnel, 2.0) * 1.72 * focusGain;
        lit += mix(prismColor, vec3(1.0), 0.4) * (spec * 0.88 + pow(fresnel, 4.0) * 0.78) * focusGain;

        fragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/**
 * Soft circular bokeh chromatic dust motes drifting across the serpentine S-curve void.
 */
export function createPrismDustMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    glslVersion: THREE.GLSL3,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;

      in float aPhase;
      in float aScale;

      out vec3 vColor;
      out float vAlpha;

      ${SPECTRAL_PALETTE_GLSL}

      void main() {
        vec3 pos = position;
        pos.y += sin(uTime * 0.45 + aPhase) * 0.45;
        pos.x += cos(uTime * 0.32 + aPhase * 1.3) * 0.35;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float dist = max(-mvPosition.z, 1.0);

        gl_PointSize = clamp((aScale * 34.0 * uPixelRatio) / dist, 1.5, 16.0);
        gl_Position = projectionMatrix * mvPosition;

        vColor = spectralPalette(aPhase * 0.16 + uTime * 0.04);
        vAlpha = smoothstep(85.0, 12.0, dist) * smoothstep(1.2, 5.5, dist) * 0.62;
      }
    `,
    fragmentShader: `
      in vec3 vColor;
      in float vAlpha;

      out vec4 fragColor;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float soft = pow(1.0 - r * 2.0, 2.0);
        fragColor = vec4(vColor * (0.75 + soft * 0.4), soft * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
