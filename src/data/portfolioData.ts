export type ShaderMode = 'harmonic' | 'turbulence' | 'lattice' | 'orbital';

export interface EngineeringDiscipline {
  id: string;
  title: string;
  summary: string;
  stack: string[];
  metricLabel: string;
  metricValue: string;
  codeTitle: string;
  codeSnippet: string;
}

export interface PortfolioProject {
  id: string;
  index: string;
  title: string;
  category: string;
  year: string;
  role: string;
  summary: string;
  architecture: string;
  accentHex: string;
  secondaryHex: string;
  metrics: { label: string; value: string }[];
  stack: string[];
  codeTitle: string;
  codeSnippet: string;
  liveUrl: string;
  repoUrl: string;
  scrollStop: number;
}

export interface ChamberConfig {
  id: string;
  index: string;
  label: string;
  shortLabel: string;
  scrollStop: number;
}

export const PROFILE = {
  brandName: 'Alex Vance',
  roleHeadline: 'Systems, Compilers & Real-Time 3D Graphics Engineer',
  heroTitle: 'Engineering Software That Moves Like Light',
  heroSubtitle:
    'I architect low-latency distributed backends, custom WebGL & GLSL pipelines, and resilient developer tools built from first principles.',
  location: 'San Francisco · Available for select engineering roles',
  email: 'hello@alexvance.dev',
  github: 'https://github.com',
  linkedin: 'https://linkedin.com',
  x: 'https://x.com',
  stats: [
    { label: 'Production Systems Shipped', value: '24+' },
    { label: 'Median Frame Budget', value: '4.2 ms' },
    { label: 'Open-Source Stars', value: '8.4k' },
    { label: 'Years Crafting Code', value: '7 yrs' },
  ],
};

export const CHAMBERS: ChamberConfig[] = [
  { id: 'overview', index: '01', label: '01. Core Identity', shortLabel: 'Core', scrollStop: 0.0 },
  { id: 'systems', index: '02', label: '02. Systems & Architecture', shortLabel: 'Systems', scrollStop: 0.19 },
  { id: 'projects', index: '03', label: '03. Selected Engineering', shortLabel: 'Works', scrollStop: 0.49 },
  { id: 'shader-lab', index: '04', label: '04. Shader & Math Lab', shortLabel: 'Shader Lab', scrollStop: 0.77 },
  { id: 'contact', index: '05', label: '05. Collaboration', shortLabel: 'Contact', scrollStop: 0.99 },
];

export const DISCIPLINES: EngineeringDiscipline[] = [
  {
    id: 'graphics',
    title: 'Real-Time 3D & GLSL Shaders',
    summary:
      'Custom physically-based rendering pipelines, GPU particle solvers, and zero-allocation Three.js render loops tuned for 120Hz displays.',
    stack: ['WebGL2', 'GLSL ES 3.0', 'Three.js', 'WGSL', 'Math & Kinematics'],
    metricLabel: 'Draw Call Budget',
    metricValue: '< 35 calls / frame',
    codeTitle: 'Damped Spatial Spline Camera',
    codeSnippet: `// Frame-rate independent exponential camera damping
const alpha = 1.0 - Math.exp(-6.5 * delta);
camera.position.lerp(splinePoint, alpha);
lookTarget.lerp(aheadPoint, alpha * 1.15);
camera.lookAt(lookTarget);`,
  },
  {
    id: 'systems',
    title: 'Distributed Systems & Consensus',
    summary:
      'Deterministic state machines, Raft-backed replication logs, and lock-free ring buffers engineered for predictable tail latency under load.',
    stack: ['Rust', 'Go', 'gRPC', 'eBPF', 'PostgreSQL'],
    metricLabel: 'P99 Replication Latency',
    metricValue: '1.8 ms across 3 AZs',
    codeTitle: 'Lock-Free SPSC Ring Buffer Push',
    codeSnippet: `pub fn try_push(&self, item: T) -> Result<(), T> {
  let tail = self.tail.load(Ordering::Relaxed);
  let next = (tail + 1) & self.mask;
  if next == self.head.load(Ordering::Acquire) {
    return Err(item);
  }
  unsafe { (*self.buf[tail].get()).write(item); }
  self.tail.store(next, Ordering::Release);
  Ok(())
}`,
  },
  {
    id: 'compilers',
    title: 'Compilers, ASTs & Developer Tooling',
    summary:
      'Incremental query-based type checkers, bytecode VMs, and WASM language servers delivering sub-10ms diagnostics in the editor.',
    stack: ['TypeScript', 'Rust', 'WebAssembly', 'LLVM', 'Tree-sitter'],
    metricLabel: 'Incremental Re-parse',
    metricValue: '0.6 ms avg / keystroke',
    codeTitle: 'Pratt Precedence Expression Parser',
    codeSnippet: `function parseExpr(minBp: number): Expr {
  let lhs = parsePrefix();
  while (true) {
    const op = lexer.peek();
    const [lBp, rBp] = infixBindingPower(op);
    if (lBp < minBp) break;
    lexer.next();
    lhs = { kind: 'Binary', op, lhs, rhs: parseExpr(rBp) };
  }
  return lhs;
}`,
  },
  {
    id: 'fullstack',
    title: 'High-Craft Web Architecture',
    summary:
      'Accessible, strict-typed React interfaces paired with streaming edge APIs, optimistic state reconciliation, and zero-jank compositor motion.',
    stack: ['React 19', 'TypeScript', 'Node.js', 'Tailwind CSS', 'WebSockets'],
    metricLabel: 'Core Web Vitals',
    metricValue: '100 / 100 Lighthouse',
    codeTitle: 'Coalesced Render Scheduler',
    codeSnippet: `let queued = false;
export function scheduleFrame(task: () => void) {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    task();
  });
}`,
  },
];

export const PROJECTS: PortfolioProject[] = [
  {
    id: 'vortex-fluid',
    index: '01',
    title: 'Vortex Navier-Stokes GPU Solver',
    category: 'WebGL2 · Compute Shaders',
    year: '2026',
    role: 'Lead Graphics Architect',
    summary:
      'Real-time 2D/3D curl-noise and Jacobi pressure-projection fluid simulator running entirely in floating-point ping-pong framebuffers at 120 FPS.',
    architecture:
      'Built a multi-pass FBO pipeline executing advection, vorticity confinement, divergence calculation, and 24-iteration Jacobi pressure solves without CPU readbacks.',
    accentHex: '#10B981',
    secondaryHex: '#0EA5E9',
    metrics: [
      { label: 'Grid Resolution', value: '512 × 512' },
      { label: 'Frame Time', value: '2.9 ms' },
      { label: 'Active Particles', value: '262,144' },
    ],
    stack: ['TypeScript', 'WebGL2', 'GLSL ES 3.0', 'FBO Ping-Pong'],
    codeTitle: 'Jacobi Pressure Iteration Fragment Shader',
    codeSnippet: `precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,
    liveUrl: '#shader-lab',
    repoUrl: 'https://github.com',
    scrollStop: 0.34,
  },
  {
    id: 'kronos-raft',
    index: '02',
    title: 'Kronos Distributed KV Engine',
    category: 'Systems · Rust & Raft',
    year: '2025',
    role: 'Core Author',
    summary:
      'Multi-group Raft consensus storage engine with io_uring WAL writes, zero-copy snapshot streaming, and deterministic simulation testing.',
    architecture:
      'Separated I/O networking from the pure state-machine tick function, allowing 100,000+ simulated network partitions and clock-skew faults to run deterministically in seconds.',
    accentHex: '#0EA5E9',
    secondaryHex: '#10B981',
    metrics: [
      { label: 'Sustained Write Ops', value: '185k / sec' },
      { label: 'Failover Recovery', value: '42 ms' },
      { label: 'Fault Seeds Tested', value: '1.2M runs' },
    ],
    stack: ['Rust', 'io_uring', 'Raft', 'gRPC', 'Deterministic Sim'],
    codeTitle: 'Deterministic State Machine Step',
    codeSnippet: `pub fn step(&mut self, event: RaftEvent) -> Vec<Effect> {
  match (self.role, event) {
    (Role::Follower, RaftEvent::ElectionTimeout) => {
      self.current_term += 1;
      self.role = Role::Candidate;
      self.broadcast_request_vote()
    }
    (_, RaftEvent::AppendEntries(rpc)) if rpc.term >= self.current_term => {
      self.reconcile_log(rpc)
    }
    _ => Vec::new(),
  }
}`,
    liveUrl: '#systems',
    repoUrl: 'https://github.com',
    scrollStop: 0.44,
  },
  {
    id: 'prism-compiler',
    index: '03',
    title: 'Prism Incremental Query Compiler',
    category: 'Compilers · WebAssembly',
    year: '2025',
    role: 'Compiler Engineer',
    summary:
      'Demand-driven compiler and LSP compiled to WebAssembly, featuring Salsa-style memoized dependency graphs and sub-millisecond incremental diagnostics.',
    architecture:
      'Implemented green-red lossless syntax trees paired with a revision-tracked query database so keystrokes only invalidate downstream type signatures that visibly changed.',
    accentHex: '#10B981',
    secondaryHex: '#1E40AF',
    metrics: [
      { label: 'Cold Typecheck (50k LOC)', value: '118 ms' },
      { label: 'Incremental Edit', value: '0.7 ms' },
      { label: 'WASM Binary Size', value: '340 KB' },
    ],
    stack: ['Rust', 'WebAssembly', 'TypeScript', 'LSP', 'Incremental DB'],
    codeTitle: 'Memoized Dependency Query Verification',
    codeSnippet: `pub fn verify_memoized(&mut self, key: QueryKey) -> Option<Value> {
  let entry = self.cache.get(&key)?;
  if entry.verified_at == self.current_revision {
    return Some(entry.value.clone());
  }
  let inputs_clean = entry.deps.iter().all(|dep| {
    self.last_changed(*dep) <= entry.verified_at
  });
  if inputs_clean { Some(entry.value.clone()) } else { None }
}`,
    liveUrl: '#systems',
    repoUrl: 'https://github.com',
    scrollStop: 0.54,
  },
  {
    id: 'aether-dsp',
    index: '04',
    title: 'Aether Zero-Alloc Audio Graph',
    category: 'Audio DSP · C++ / AudioWorklet',
    year: '2024',
    role: 'Systems & Audio Engineer',
    summary:
      'Polyphonic modular synthesizer and spectral analyzer running on real-time AudioWorklet threads compiled from SIMD-accelerated C++ via Emscripten.',
    architecture:
      'Enforced strict real-time thread safety: zero heap allocations, zero mutex locks on the audio callback, and lock-free SPSC parameter modulation queues.',
    accentHex: '#0284C7',
    secondaryHex: '#059669',
    metrics: [
      { label: 'Audio Buffer Size', value: '128 samples' },
      { label: 'DSP CPU Load (64 voices)', value: '3.4%' },
      { label: 'Roundtrip Latency', value: '4.8 ms' },
    ],
    stack: ['C++20', 'WASM SIMD', 'AudioWorklet', 'Canvas2D', 'React'],
    codeTitle: 'SIMD 4-Voice PolyBLEP Oscillator Step',
    codeSnippet: `inline v128_t poly_blep(v128_t t, v128_t dt) {
  // Branchless anti-aliased discontinuity correction across 4 voices
  v128_t mask_start = wasm_f32x4_lt(t, dt);
  v128_t norm_start = wasm_f32x4_div(t, dt);
  v128_t corr_start = wasm_f32x4_sub(
    wasm_f32x4_add(norm_start, norm_start),
    wasm_f32x4_mul(norm_start, norm_start)
  );
  return wasm_v128_bitselect(corr_start, wasm_f32x4_splat(0.0f), mask_start);
}`,
    liveUrl: '#shader-lab',
    repoUrl: 'https://github.com',
    scrollStop: 0.64,
  },
];

export const SHADER_PRESETS: Record<
  ShaderMode,
  {
    label: string;
    description: string;
    formula: string;
    defaultFreq: number;
    defaultAmp: number;
  }
> = {
  harmonic: {
    label: 'Harmonic Resonance',
    description: 'Superimposed spherical harmonics modulating vertex normals along a continuous parametric manifold.',
    formula: 'd = sin(p.x * f + t) * cos(p.y * f - t * 0.8) * a',
    defaultFreq: 2.4,
    defaultAmp: 0.28,
  },
  turbulence: {
    label: 'Simplex Turbulence',
    description: 'Multi-octave 3D simplex gradient curl field driving organic surface displacement and Fresnel sheen.',
    formula: 'd = fbm(p * f * 0.6 + vec3(0.0, t * 0.4, 0.0)) * a',
    defaultFreq: 3.1,
    defaultAmp: 0.36,
  },
  lattice: {
    label: 'Quantized Lattice',
    description: 'Stepped architectural quantization snapping surface waves into discrete crystalline compute terraces.',
    formula: 'd = floor(sin(length(p.xz) * f - t) * 5.0) / 5.0 * a',
    defaultFreq: 3.8,
    defaultAmp: 0.24,
  },
  orbital: {
    label: 'Magnetic Vortex',
    description: 'Helical phase twist coupled with radial magnetic field lines pulsing between deep blue and emerald.',
    formula: 'd = sin(atan(p.z, p.x) * 6.0 + p.y * f - t * 1.4) * a',
    defaultFreq: 2.8,
    defaultAmp: 0.32,
  },
};
