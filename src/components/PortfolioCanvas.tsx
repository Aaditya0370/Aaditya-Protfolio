import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SpatialAudioEngine } from '../audio/spatialAudio';
import { CHAMBERS, PROFILE, PROJECTS, SHADER_PRESETS, ShaderMode } from '../data/portfolioData';
import { buildPortfolioScene, HitAction, PortfolioSceneObjects } from '../three/sceneBuilder';

interface PortfolioCanvasProps {
  scrollProgressRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}

// Pre-allocated math helpers at module scope (zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _currentLook = new THREE.Vector3(0.4, 0.8, 0.0);
const _camTangent = new THREE.Vector3();
const _packetPos = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

const SHADER_MODE_INDEX: Record<ShaderMode, number> = {
  harmonic: 0,
  turbulence: 1,
  lattice: 2,
  orbital: 3,
};

function computeFocusWeight(scroll: number, stop: number, halfWidth: number): number {
  const t = THREE.MathUtils.clamp(1 - Math.abs(scroll - stop) / halfWidth, 0, 1);
  return t * t * (3 - 2 * t);
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function PortfolioCanvas({
  scrollProgressRef,
  reducedMotion,
}: PortfolioCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      280
    );

    const audio = new SpatialAudioEngine();

    let disciplineIdx = 0;
    const shaderState: { mode: ShaderMode; freq: number; amp: number } = {
      mode: 'harmonic',
      freq: SHADER_PRESETS.harmonic.defaultFreq,
      amp: SHADER_PRESETS.harmonic.defaultAmp,
    };
    let emailCopied = false;
    let copyTimer = 0;

    const objects: PortfolioSceneObjects = buildPortfolioScene(
      scene,
      renderer,
      isSoftwareGl,
      {
        getDisciplineIdx: () => disciplineIdx,
        getShaderState: () => shaderState,
        getEmailCopied: () => emailCopied,
        getSoundMuted: () => audio.isMuted(),
      }
    );

    let disposed = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!disposed) {
          objects.redrawAllStaticText();
        }
      });
    }

    objects.voidBackdropMaterial.uniforms.uResolution.value.set(
      window.innerWidth,
      window.innerHeight
    );

    objects.cameraCurve.getPointAt(0, camera.position);
    objects.lookAtCurve.getPointAt(0, _currentLook);
    camera.lookAt(_currentLook);

    // Hardware-GPU subtle optical bloom via EffectComposer (skipped cleanly on Software WebGL)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(window.innerWidth, window.innerHeight);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.42, // selective HDR bloom strength for holographic shader highlights
        0.55,
        1.16 // strictly above 1.13 text color so plain white 3D text stays pure & sharp
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let pointerX = 0;
    let pointerY = 0;
    let smoothPointerX = 0;
    let smoothPointerY = 0;
    let hoveredMonolithIdx: number | null = null;
    let lastHoveredTarget: THREE.Object3D | null = null;
    let lastRaycastMs = 0;
    let smoothedScroll = scrollProgressRef.current;
    let smoothedBank = 0;
    let activeFocusSlot = 0;
    let contextLost = false;

    const unlockAudio = () => {
      audio.unlock();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      audio.unlock();
      if (e.code === 'KeyM') {
        audio.toggleMute();
        objects.redrawHeroText();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerX = nx;
      pointerY = ny;

      const now = performance.now();
      if (now - lastRaycastMs < 50) return;
      lastRaycastMs = now;

      _pointerNdc.set(nx, ny);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(objects.hitTargets, false);

      if (hits.length > 0) {
        canvas.style.cursor = 'pointer';
        const hitObj = hits[0].object;
        if (hitObj !== lastHoveredTarget) {
          lastHoveredTarget = hitObj;
          audio.playHover();
        }
        const action = hitObj.userData.hitAction as HitAction | undefined;
        hoveredMonolithIdx = action?.type === 'monolith' ? action.index : null;
      } else {
        canvas.style.cursor = 'default';
        hoveredMonolithIdx = null;
        lastHoveredTarget = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      audio.unlock();
      _pointerNdc.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(objects.hitTargets, false);
      if (hits.length === 0) return;

      const action = hits[0].object.userData.hitAction as HitAction | undefined;
      if (!action) return;

      switch (action.type) {
        case 'discipline': {
          disciplineIdx = action.index;
          objects.redrawSystemsText();
          audio.playTabSwitch(action.index);
          break;
        }
        case 'monolith': {
          const m = objects.monoliths[action.index];
          if (m) {
            m.flipped = !m.flipped;
            m.targetRotY = m.baseRotY + (m.flipped ? Math.PI : 0);
            audio.playMonolithFlip(m.flipped);
          }
          break;
        }
        case 'shaderMode': {
          shaderState.mode = action.mode;
          shaderState.freq = SHADER_PRESETS[action.mode].defaultFreq;
          shaderState.amp = SHADER_PRESETS[action.mode].defaultAmp;
          objects.redrawShaderText();
          audio.playShaderAdjust(shaderState.freq, shaderState.amp);
          break;
        }
        case 'shaderFreq': {
          shaderState.freq = Number(
            THREE.MathUtils.clamp(shaderState.freq + action.delta, 0.8, 6.0).toFixed(2)
          );
          objects.redrawShaderText();
          audio.playShaderAdjust(shaderState.freq, shaderState.amp);
          break;
        }
        case 'shaderAmp': {
          shaderState.amp = Number(
            THREE.MathUtils.clamp(shaderState.amp + action.delta, 0.05, 0.65).toFixed(2)
          );
          objects.redrawShaderText();
          audio.playShaderAdjust(shaderState.freq, shaderState.amp);
          break;
        }
        case 'copyEmail': {
          navigator.clipboard?.writeText(PROFILE.email).catch(() => {});
          emailCopied = true;
          objects.redrawContactText();
          audio.playConfirm();
          clearTimeout(copyTimer);
          copyTimer = window.setTimeout(() => {
            if (!disposed) {
              emailCopied = false;
              objects.redrawContactText();
            }
          }, 2200);
          break;
        }
        case 'openUrl': {
          audio.playConfirm();
          const anchor = document.createElement('a');
          anchor.href = action.url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.click();
          break;
        }
        case 'scrollToTop': {
          audio.playConfirm();
          window.scrollTo({
            top: 0,
            behavior: reducedMotionRef.current ? 'auto' : 'smooth',
          });
          break;
        }
        case 'toggleSound': {
          audio.toggleMute();
          objects.redrawHeroText();
          break;
        }
      }
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      objects.voidBackdropMaterial.uniforms.uResolution.value.set(w, h);
      if (composer) {
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        composer.setSize(w, h);
      }
      if (bloomPass) {
        bloomPass.resolution.set(w, h);
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };

    const onContextRestored = () => {
      contextLost = false;
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = reducedMotionRef.current ? 0 : clock.getElapsedTime();

      if (!contextLost) {
        const targetScroll = THREE.MathUtils.clamp(scrollProgressRef.current, 0, 1);
        const prevScroll = smoothedScroll;
        smoothedScroll = THREE.MathUtils.damp(smoothedScroll, targetScroll, 6.2, delta);
        const scrollVelocity = delta > 0 ? (smoothedScroll - prevScroll) / delta : 0;
        audio.updateSpatialMotion(smoothedScroll, scrollVelocity);

        smoothPointerX = THREE.MathUtils.damp(smoothPointerX, pointerX, 4.5, delta);
        smoothPointerY = THREE.MathUtils.damp(smoothPointerY, pointerY, 4.5, delta);

        objects.cameraCurve.getPointAt(smoothedScroll, _camTarget);
        objects.lookAtCurve.getPointAt(smoothedScroll, _lookTarget);
        objects.cameraCurve.getTangentAt(smoothedScroll, _camTangent);

        // Compute scroll-aligned focus weights for each section & monolith in portfolioData
        const heroFocus = computeFocusWeight(smoothedScroll, CHAMBERS[0].scrollStop, 0.14);
        const systemsFocus = computeFocusWeight(smoothedScroll, CHAMBERS[1].scrollStop, 0.13);
        const projectsFocus = computeFocusWeight(smoothedScroll, CHAMBERS[2].scrollStop, 0.22);
        const shaderFocus = computeFocusWeight(smoothedScroll, CHAMBERS[3].scrollStop, 0.13);
        const horizonFocus = computeFocusWeight(smoothedScroll, CHAMBERS[4].scrollStop, 0.14);
        const projectsHeaderFocus = computeFocusWeight(smoothedScroll, 0.285, 0.06);
        let maxMonolithFocus = 0;
        for (let idx = 0; idx < PROJECTS.length; idx++) {
          const mf = computeFocusWeight(smoothedScroll, PROJECTS[idx].scrollStop, 0.075);
          if (mf > maxMonolithFocus) maxMonolithFocus = mf;
        }
        const stopLock = Math.max(
          heroFocus,
          systemsFocus,
          projectsHeaderFocus,
          shaderFocus,
          horizonFocus,
          maxMonolithFocus
        );

        _camTarget.x += smoothPointerX * 0.55 * (1 - stopLock * 0.78);
        _camTarget.y += smoothPointerY * 0.32 * (1 - stopLock * 0.78);

        camera.position.lerp(_camTarget, 1 - Math.exp(-8.5 * delta));
        _currentLook.lerp(_lookTarget, 1 - Math.exp(-8.5 * delta));
        camera.lookAt(_currentLook);

        const bankScale = reducedMotionRef.current ? 0 : 1 - stopLock;
        const targetBank = THREE.MathUtils.clamp(-_camTangent.x * 0.11, -0.068, 0.068) * bankScale;
        smoothedBank = THREE.MathUtils.damp(smoothedBank, targetBank, 5.2, delta);
        camera.rotateZ(smoothedBank);

        // Apply subtle scale & light brightening to focused megastructure
        objects.heroCoreGroup.scale.setScalar(
          THREE.MathUtils.damp(objects.heroCoreGroup.scale.x, 1 + heroFocus * 0.07, 6.5, delta)
        );
        objects.systemsGroup.scale.setScalar(
          THREE.MathUtils.damp(objects.systemsGroup.scale.x, 1 + systemsFocus * 0.07, 6.5, delta)
        );
        objects.shaderLabGroup.scale.setScalar(
          THREE.MathUtils.damp(objects.shaderLabGroup.scale.x, 1 + shaderFocus * 0.07, 6.5, delta)
        );
        objects.horizonGroup.scale.setScalar(
          THREE.MathUtils.damp(objects.horizonGroup.scale.x, 1 + horizonFocus * 0.07, 6.5, delta)
        );

        objects.chamberLights.hero.intensity = THREE.MathUtils.damp(
          objects.chamberLights.hero.intensity,
          4.5 + heroFocus * 6.5,
          6.0,
          delta
        );
        objects.chamberLights.systems.intensity = THREE.MathUtils.damp(
          objects.chamberLights.systems.intensity,
          4.0 + systemsFocus * 6.0,
          6.0,
          delta
        );
        objects.chamberLights.projects.intensity = THREE.MathUtils.damp(
          objects.chamberLights.projects.intensity,
          3.8 + projectsFocus * 5.2,
          6.0,
          delta
        );
        objects.chamberLights.shaderLab.intensity = THREE.MathUtils.damp(
          objects.chamberLights.shaderLab.intensity,
          4.5 + shaderFocus * 6.5,
          6.0,
          delta
        );
        objects.chamberLights.horizon.intensity = THREE.MathUtils.damp(
          objects.chamberLights.horizon.intensity,
          3.8 + horizonFocus * 5.7,
          6.0,
          delta
        );

        // Update GLSL Uniforms + focus-driven shader brightening
        objects.voidBackdropMaterial.uniforms.uTime.value = elapsed;
        objects.voidBackdropMaterial.uniforms.uScroll.value = smoothedScroll;
        objects.voidBackdropMaterial.uniforms.uMouse.value.set(
          smoothPointerX,
          smoothPointerY
        );

        objects.waveFloorMaterial.uniforms.uTime.value = elapsed;
        objects.waveFloorMaterial.uniforms.uScroll.value = smoothedScroll;
        objects.waveFloorMaterial.uniforms.uMouse.value.set(smoothPointerX, smoothPointerY);

        objects.prismDustMaterial.uniforms.uTime.value = elapsed;
        objects.prismDustMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();

        objects.prismCoreMaterial.uniforms.uTime.value = elapsed;
        objects.prismCoreMaterial.uniforms.uFocus.value = heroFocus;

        for (let i = 0; i < objects.hologramMaterials.length; i++) {
          objects.hologramMaterials[i].uniforms.uTime.value = elapsed;
        }
        objects.chamberHoloMaterials.hero.forEach((m) => {
          m.uniforms.uFocus.value = heroFocus;
        });
        objects.chamberHoloMaterials.systems.forEach((m) => {
          m.uniforms.uFocus.value = systemsFocus;
        });
        objects.chamberHoloMaterials.shaderLab.forEach((m) => {
          m.uniforms.uFocus.value = shaderFocus;
        });
        objects.chamberHoloMaterials.horizon.forEach((m) => {
          m.uniforms.uFocus.value = horizonFocus;
        });

        const labUniforms = objects.shaderLabMaterial.uniforms;
        labUniforms.uTime.value = elapsed;
        labUniforms.uFocus.value = shaderFocus;
        labUniforms.uMode.value = SHADER_MODE_INDEX[shaderState.mode];
        labUniforms.uFreq.value = THREE.MathUtils.damp(
          labUniforms.uFreq.value,
          shaderState.freq,
          6.0,
          delta
        );
        labUniforms.uAmp.value = THREE.MathUtils.damp(
          labUniforms.uAmp.value,
          shaderState.amp,
          6.0,
          delta
        );

        // Monolith scroll-focus scale + screen brighten + focus lock sound
        let bestSlot: number | null = null;
        let bestFocus = 0.62;
        const chamberFocusCandidates: [number, number][] = [
          [0, heroFocus],
          [1, systemsFocus],
          [6, shaderFocus],
          [7, horizonFocus],
        ];
        for (const [slot, val] of chamberFocusCandidates) {
          if (val > bestFocus) {
            bestFocus = val;
            bestSlot = slot;
          }
        }

        objects.monoliths.forEach((m, idx) => {
          const mFocus = computeFocusWeight(smoothedScroll, PROJECTS[idx].scrollStop, 0.075);
          if (mFocus > bestFocus) {
            bestFocus = mFocus;
            bestSlot = 2 + idx;
          }
          const isHovered = idx === hoveredMonolithIdx;
          const targetScale = (1 + mFocus * 0.06) * (isHovered ? 1.045 : 1.0);
          const nextScale = THREE.MathUtils.damp(m.group.scale.x, targetScale, 8, delta);
          m.group.scale.setScalar(nextScale);
          m.frontScreenMat.emissiveIntensity = THREE.MathUtils.damp(
            m.frontScreenMat.emissiveIntensity,
            0.48 + mFocus * 0.3,
            7,
            delta
          );
          m.backScreenMat.emissiveIntensity = THREE.MathUtils.damp(
            m.backScreenMat.emissiveIntensity,
            0.52 + mFocus * 0.3,
            7,
            delta
          );
        });

        if (bestSlot !== null && bestSlot !== activeFocusSlot) {
          activeFocusSlot = bestSlot;
          audio.playFocusLock(bestSlot, bestSlot >= 2 && bestSlot <= 5);
        }

        // Subtle mouse-interaction parallax tilt on geodesic megastructures
        const tiltScale = reducedMotionRef.current ? 0 : 1;
        objects.heroCoreGroup.rotation.x = THREE.MathUtils.damp(
          objects.heroCoreGroup.rotation.x,
          -smoothPointerY * 0.14 * tiltScale,
          5.0,
          delta
        );
        objects.heroCoreGroup.rotation.y = THREE.MathUtils.damp(
          objects.heroCoreGroup.rotation.y,
          smoothPointerX * 0.18 * tiltScale,
          5.0,
          delta
        );

        objects.systemsGroup.rotation.x = THREE.MathUtils.damp(
          objects.systemsGroup.rotation.x,
          -smoothPointerY * 0.11 * tiltScale,
          5.0,
          delta
        );
        objects.systemsGroup.rotation.z = THREE.MathUtils.damp(
          objects.systemsGroup.rotation.z,
          -smoothPointerX * 0.11 * tiltScale,
          5.0,
          delta
        );

        objects.shaderLabGroup.rotation.x = THREE.MathUtils.damp(
          objects.shaderLabGroup.rotation.x,
          -smoothPointerY * 0.13 * tiltScale,
          5.0,
          delta
        );
        objects.shaderLabGroup.rotation.y = THREE.MathUtils.damp(
          objects.shaderLabGroup.rotation.y,
          smoothPointerX * 0.16 * tiltScale,
          5.0,
          delta
        );

        objects.horizonGroup.rotation.x = THREE.MathUtils.damp(
          objects.horizonGroup.rotation.x,
          -smoothPointerY * 0.1 * tiltScale,
          4.5,
          delta
        );
        objects.horizonGroup.rotation.y = THREE.MathUtils.damp(
          objects.horizonGroup.rotation.y,
          smoothPointerX * 0.14 * tiltScale,
          4.5,
          delta
        );

        // Animate Kinetic Mechanical & Geodesic Megastructures
        if (!reducedMotionRef.current) {
          // Chamber 0: Interlocking Astrolabe Gears & Geodesic Cage
          if (objects.heroKineticParts[0]) {
            objects.heroKineticParts[0].rotation.z = elapsed * 0.1; // Turbine crown
          }
          if (objects.heroKineticParts[1]) {
            objects.heroKineticParts[1].rotation.z = -elapsed * 0.22; // Outer ring gear
          }
          objects.heroPinions.forEach((pinion, idx) => {
            pinion.rotation.z = elapsed * (0.75 + idx * 0.12); // Meshing inner pinions
          });
          if (objects.heroKineticParts[2]) {
            objects.heroKineticParts[2].rotation.y = elapsed * 0.18; // Geodesic cage
            objects.heroKineticParts[2].rotation.x = Math.sin(elapsed * 0.3) * 0.2;
          }
          if (objects.heroKineticParts[3]) {
            objects.heroKineticParts[3].rotation.z = elapsed * 0.34; // Inner sapphire gear
          }
          if (objects.heroKineticParts[4]) {
            objects.heroKineticParts[4].rotation.x = elapsed * 0.22; // Trefoil 1
          }
          if (objects.heroKineticParts[5]) {
            objects.heroKineticParts[5].rotation.y = -elapsed * 0.25; // Trefoil 2
          }
          if (objects.heroKineticParts[6]) {
            objects.heroKineticParts[6].rotation.y = -elapsed * 0.45; // Prism crystal
            objects.heroKineticParts[6].rotation.x = elapsed * 0.2;
          }
          if (objects.heroKineticParts[7]) {
            objects.heroKineticParts[7].rotation.z = elapsed * 0.14; // Outer Vernier scale ring
          }
          const heroBaseY = (objects.heroCoreGroup.userData.baseY as number | undefined) ?? 0.9;
          objects.heroCoreGroup.position.y = heroBaseY + Math.sin(elapsed * 0.85) * 0.14;

          // Chamber 1: Geodesic Compute Spire
          objects.systemsBlades.forEach((blade, idx) => {
            blade.rotation.y = elapsed * (0.22 + idx * 0.07) * (idx % 2 === 0 ? 1 : -1);
          });
          objects.systemsCage.rotation.y = -elapsed * 0.12;
          objects.neuralPackets.forEach((pkt) => {
            const u = (elapsed * pkt.speed + pkt.offset) % 1;
            pkt.curve.getPointAt(u, _packetPos);
            pkt.mesh.position.copy(_packetPos);
          });

          // Chamber 2: Vault Monoliths (keep screens straight & upright) & Rear Kinetic Stabilizers
          objects.monoliths.forEach((m) => {
            m.group.position.y = m.baseY + Math.sin(elapsed * 1.1 + m.phase) * 0.06;
            m.group.rotation.x = 0;
            m.group.rotation.y = THREE.MathUtils.damp(
              m.group.rotation.y,
              m.targetRotY,
              7.5,
              delta
            );
            m.gearRing.rotation.z = elapsed * 0.24 + m.phase;
            m.cage.rotation.z = -elapsed * 0.16;
            m.cage.rotation.y = elapsed * 0.12;
          });

          // Chamber 3: Chromatic Resonance Dyson Array
          objects.shaderManifold.rotation.y = elapsed * 0.16;
          objects.shaderDysonParts.forEach((part, idx) => {
            part.rotation.z += delta * (0.16 + idx * 0.05) * (idx % 2 === 0 ? 1 : -1);
            part.rotation.x += delta * (0.09 + idx * 0.03);
          });

          // Chamber 4: Grand Kinetic Celestial Orrery
          objects.horizonParts.forEach((part, idx) => {
            part.rotation.z += delta * (0.08 + idx * 0.03) * (idx % 2 === 0 ? 1 : -1);
            if (idx > 0) {
              part.rotation.y += delta * 0.06;
            }
          });

          // Orbital Satellites & Relay Drones flanking S-curve voids
          objects.satellites.forEach((sat) => {
            sat.group.position.y =
              sat.basePos.y + Math.sin(elapsed * sat.speed + sat.phase) * sat.orbitAmp;
            sat.group.position.x =
              sat.basePos.x + Math.cos(elapsed * sat.speed * 0.6 + sat.phase) * 0.35;
            sat.group.rotation.y = elapsed * 0.18 * (sat.phase % 2 > 1 ? 1 : -1) + sat.phase;
            sat.gyroRing.rotation.z = elapsed * 0.75 + sat.phase;
            sat.wings.rotation.x = Math.sin(elapsed * 0.45 + sat.phase) * 0.28;
          });

          // S-curve Geodesic Gateways: counter-rotate inner vernier & holographic rings while keeping buttresses planted
          objects.gateways.forEach((gw, idx) => {
            if (gw.children[1]) {
              gw.children[1].rotation.z = elapsed * (0.09 + idx * 0.02) * (idx % 2 === 0 ? 1 : -1);
            }
            if (gw.children[2]) {
              gw.children[2].rotation.z = -elapsed * (0.14 + idx * 0.02);
            }
          });
        }

        if (composer && !isSoftwareGl) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(copyTimer);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      audio.dispose();
      if (composer) {
        composer.dispose();
      }
      objects.disposables.geometries.forEach((g) => g.dispose());
      objects.disposables.materials.forEach((m) => m.dispose());
      objects.disposables.textures.forEach((t) => t.dispose());
      renderer.dispose();

      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [scrollProgressRef]);

  if (webglFailed) {
    return (
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 72% 35%, rgba(6, 95, 70, 0.24), transparent 45%), radial-gradient(circle at 25% 70%, rgba(30, 64, 175, 0.22), transparent 50%), #020305',
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-10 w-full h-full"
      aria-label="Interactive 3D portfolio spatial environment"
    />
  );
}
