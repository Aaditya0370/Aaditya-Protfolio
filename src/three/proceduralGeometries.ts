import * as THREE from 'three';

/**
 * Generates an extruded, beveled mechanical gear ring with precision trapezoidal teeth
 * and radial weight-reduction cutouts.
 */
export function createGearGeometry(
  teeth: number,
  innerRadius: number,
  rootRadius: number,
  tipRadius: number,
  depth: number,
  cutoutCount = 6
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const baseAngle = i * step;
    const a0 = baseAngle;
    const a1 = baseAngle + step * 0.18;
    const a2 = baseAngle + step * 0.30;
    const a3 = baseAngle + step * 0.56;
    const a4 = baseAngle + step * 0.68;

    const p0x = Math.cos(a0) * rootRadius;
    const p0y = Math.sin(a0) * rootRadius;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rootRadius, Math.sin(a1) * rootRadius);
    shape.lineTo(Math.cos(a2) * tipRadius, Math.sin(a2) * tipRadius);
    shape.lineTo(Math.cos(a3) * tipRadius, Math.sin(a3) * tipRadius);
    shape.lineTo(Math.cos(a4) * rootRadius, Math.sin(a4) * rootRadius);
  }
  shape.closePath();

  // Central bore hole
  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  // Radial lightening slots when ring width allows
  const bandWidth = rootRadius - innerRadius;
  if (cutoutCount > 0 && bandWidth > 0.38) {
    const slotInner = innerRadius + bandWidth * 0.28;
    const slotOuter = rootRadius - bandWidth * 0.25;
    const slotStep = (Math.PI * 2) / cutoutCount;

    for (let c = 0; c < cutoutCount; c++) {
      const startA = c * slotStep + slotStep * 0.16;
      const endA = (c + 1) * slotStep - slotStep * 0.16;
      const slot = new THREE.Path();
      slot.absarc(0, 0, slotOuter, startA, endA, false);
      slot.absarc(0, 0, slotInner, endA, startA, true);
      slot.closePath();
      shape.holes.push(slot);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.035, depth * 0.22),
    bevelSize: Math.min(0.03, depth * 0.2),
    bevelSegments: 2,
    curveSegments: 24,
  });
  geo.center();
  return geo;
}

/**
 * Generates an extruded, beveled mechanical turbine stator crown with angled vane apertures.
 */
export function createTurbineCrownGeometry(
  vanes: number,
  innerRadius: number,
  outerRadius: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const vaneStep = (Math.PI * 2) / vanes;
  const rMidIn = innerRadius + (outerRadius - innerRadius) * 0.22;
  const rMidOut = outerRadius - (outerRadius - innerRadius) * 0.2;

  for (let i = 0; i < vanes; i++) {
    const a0 = i * vaneStep + vaneStep * 0.14;
    const a1 = i * vaneStep + vaneStep * 0.72;
    const skew = 0.14;

    const aperture = new THREE.Path();
    aperture.moveTo(Math.cos(a0) * rMidIn, Math.sin(a0) * rMidIn);
    aperture.lineTo(Math.cos(a1) * rMidIn, Math.sin(a1) * rMidIn);
    aperture.lineTo(Math.cos(a1 + skew) * rMidOut, Math.sin(a1 + skew) * rMidOut);
    aperture.lineTo(Math.cos(a0 + skew) * rMidOut, Math.sin(a0 + skew) * rMidOut);
    aperture.closePath();
    shape.holes.push(aperture);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 32,
  });
  geo.center();
  return geo;
}

/**
 * Generates a split-wing chamfered vault frame for 3D Project Monoliths.
 */
export function createVaultWingGeometry(
  width: number,
  height: number,
  depth: number
): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const cham = 0.32;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + cham, -hh);
  shape.lineTo(hw - cham, -hh);
  shape.lineTo(hw, -hh + cham);
  shape.lineTo(hw, hh - cham);
  shape.lineTo(hw - cham, hh);
  shape.lineTo(-hw + cham, hh);
  shape.lineTo(-hw, hh - cham);
  shape.lineTo(-hw, -hh + cham);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/**
 * Extracts unique vertex positions from an icosahedron for placing geodesic joint nodes.
 */
export function extractUniqueVertices(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const pos = geometry.attributes.position;
  const unique: THREE.Vector3[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)}_${y.toFixed(3)}_${z.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(new THREE.Vector3(x, y, z));
    }
  }
  return unique;
}

/**
 * Builds an articulated Geodesic Lattice Group (wireframe edges + instanced faceted vertex nodes).
 */
export function createGeodesicCage(
  radius: number,
  detail: number,
  edgeMaterial: THREE.Material,
  nodeMaterial: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const group = new THREE.Group();

  const baseIco = trackGeo(new THREE.IcosahedronGeometry(radius, detail));
  const edgesGeo = trackGeo(new THREE.EdgesGeometry(baseIco, 1));
  const lines = new THREE.LineSegments(edgesGeo, edgeMaterial);
  group.add(lines);

  const vertices = extractUniqueVertices(baseIco);
  const nodeGeo = trackGeo(new THREE.OctahedronGeometry(0.068, 0));
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMaterial, vertices.length);
  const dummy = new THREE.Object3D();

  vertices.forEach((v, idx) => {
    dummy.position.copy(v);
    dummy.lookAt(0, 0, 0);
    dummy.updateMatrix();
    nodes.setMatrixAt(idx, dummy.matrix);
  });
  nodes.instanceMatrix.needsUpdate = true;
  nodes.computeBoundingSphere();
  group.add(nodes);

  return group;
}

/**
 * Generates an extruded, beveled astronomical vernier scale ring with precision perimeter notches.
 */
export function createVernierRingGeometry(
  notches: number,
  innerRadius: number,
  outerRadius: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / notches;

  for (let i = 0; i < notches; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.62;
    const a2 = a0 + step * 0.72;
    const a3 = a0 + step * 0.92;
    const notchDepth = i % 4 === 0 ? 0.14 : 0.07;

    const p0x = Math.cos(a0) * outerRadius;
    const p0y = Math.sin(a0) * outerRadius;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * outerRadius, Math.sin(a1) * outerRadius);
    shape.lineTo(
      Math.cos(a2) * (outerRadius - notchDepth),
      Math.sin(a2) * (outerRadius - notchDepth)
    );
    shape.lineTo(
      Math.cos(a3) * (outerRadius - notchDepth),
      Math.sin(a3) * (outerRadius - notchDepth)
    );
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.025, depth * 0.2),
    bevelSize: Math.min(0.025, depth * 0.2),
    bevelSegments: 2,
    curveSegments: 32,
  });
  geo.center();
  return geo;
}
