import * as THREE from 'three';
import { lerp } from '../utils/math';

/**
 * The shape of one petal blade. Petals are a lattice (lengthSegments x
 * widthSegments) whose spine is integrated along +Y, curling toward +Z
 * (outward, away from the flower's axis) and cupping across the width.
 */
export interface PetalShape {
  length: number;
  width: number;
  /** 0..1 along the length where the blade is widest */
  widthPeak: number;
  /** 0 = rounded tip, 1 = pointed */
  tipPoint: number;
  /** cross-section curvature (radians across half the width); + cups inward */
  cup: number;
  /** spine curl along the length (radians); + curls back/outward */
  curl: number;
  /** where the curl concentrates: high = only the tip curls */
  curlExponent: number;
  /** wavy edge amplitude */
  ripple: number;
  rippleFrequency: number;
  /** gentle twist around the spine (radians at the tip) */
  twist: number;
}

export const lerpShape = (a: PetalShape, b: PetalShape, t: number, out: PetalShape): PetalShape => {
  out.length = lerp(a.length, b.length, t);
  out.width = lerp(a.width, b.width, t);
  out.widthPeak = lerp(a.widthPeak, b.widthPeak, t);
  out.tipPoint = lerp(a.tipPoint, b.tipPoint, t);
  out.cup = lerp(a.cup, b.cup, t);
  out.curl = lerp(a.curl, b.curl, t);
  out.curlExponent = lerp(a.curlExponent, b.curlExponent, t);
  out.ripple = lerp(a.ripple, b.ripple, t);
  out.rippleFrequency = lerp(a.rippleFrequency, b.rippleFrequency, t);
  out.twist = lerp(a.twist, b.twist, t);
  return out;
};

export const cloneShape = (s: PetalShape): PetalShape => ({ ...s });

export interface PetalColorProfile {
  /** multiplier at the throat (base) */
  base: [number, number, number];
  /** multiplier at the tip / edges */
  edge: [number, number, number];
  /** how far up the blade the base tint reaches, 0..1 */
  baseReach: number;
  veins: number;
}

/** Allocate a blade lattice with baked vertex-color shading. Positions are filled by updatePetalGeometry. */
export function createPetalGeometry(lengthSegments: number, widthSegments: number, colors: PetalColorProfile) {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = (lengthSegments + 1) * (widthSegments + 1);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));

  const uvs = new Float32Array(vertexCount * 2);
  const shade = new Float32Array(vertexCount * 3);
  let ci = 0, ui = 0;
  for (let row = 0; row <= lengthSegments; row++) {
    const lengthT = row / lengthSegments;
    for (let col = 0; col <= widthSegments; col++) {
      const widthT = col / widthSegments - 0.5;
      const edgeness = Math.abs(widthT) * 2;
      // base tint fades out along the blade; edges/tips take the edge tint
      const baseMix = Math.pow(Math.max(0, 1 - lengthT / Math.max(0.05, colors.baseReach)), 1.5);
      const edgeMix = Math.max(Math.pow(lengthT, 2.2) * 0.75, Math.pow(edgeness, 3) * 0.55);
      const veins = 1 + colors.veins * Math.sin(widthT * Math.PI * 7) * Math.sin(Math.min(1, lengthT * 1.1) * Math.PI) * 0.5;
      const mottle = 1 + (((Math.sin(lengthT * 91.7 + widthT * 47.3) * 43758.5453) % 1 + 1) % 1 - 0.5) * 0.05;
      for (let c = 0; c < 3; c++) {
        let v = 1;
        v = lerp(v, colors.base[c], baseMix);
        v = lerp(v, colors.edge[c], edgeMix);
        shade[ci++] = v * veins * mottle;
      }
      uvs[ui++] = widthT + 0.5;
      uvs[ui++] = lengthT;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const indices: number[] = [];
  for (let row = 0; row < lengthSegments; row++) {
    for (let col = 0; col < widthSegments; col++) {
      const a = row * (widthSegments + 1) + col;
      const b = (row + 1) * (widthSegments + 1) + col;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(indices);
  geometry.userData.lengthSegments = lengthSegments;
  geometry.userData.widthSegments = widthSegments;
  return geometry;
}

/** Write the blade for `shape` into `geometry` (positions + normals). */
export function updatePetalGeometry(geometry: THREE.BufferGeometry, shape: PetalShape) {
  const lengthSegments = geometry.userData.lengthSegments as number;
  const widthSegments = geometry.userData.widthSegments as number;
  const positions = geometry.attributes.position.array as Float32Array;

  const stepLength = shape.length / lengthSegments;
  let spineY = 0, spineZ = 0, spineAngle = 0;
  let write = 0;

  for (let row = 0; row <= lengthSegments; row++) {
    const lengthT = row / lengthSegments;

    // width profile: rises to a peak then narrows to the tip
    let profile: number;
    if (lengthT < shape.widthPeak) {
      profile = Math.pow(Math.sin((lengthT / Math.max(1e-3, shape.widthPeak)) * Math.PI * 0.5), 0.75);
    } else {
      const tail = (lengthT - shape.widthPeak) / Math.max(1e-3, 1 - shape.widthPeak);
      profile = lerp(Math.pow(Math.cos(tail * Math.PI * 0.5), 0.7), 1 - tail, shape.tipPoint);
    }
    profile = Math.max(profile, 0.05 * (1 - lengthT));
    const halfWidth = shape.width * 0.5 * profile;

    // spine frame: direction along the spine (YZ plane) and the blade's "up"
    const dirY = Math.cos(spineAngle), dirZ = Math.sin(spineAngle);
    const upY = -dirZ, upZ = dirY;
    const twist = shape.twist * lengthT * lengthT;
    const cosT = Math.cos(twist), sinT = Math.sin(twist);

    for (let col = 0; col <= widthSegments; col++) {
      const widthT = col / widthSegments - 0.5;
      const edgeness = Math.abs(widthT) * 2;
      // cupping: edges lift toward -Z (inward), strongest at the widest part
      const cupLift = -Math.sin(shape.cup) * widthT * widthT * 4 * halfWidth * (0.6 + 0.4 * profile);
      const ripple = shape.ripple * edgeness * Math.sin(lengthT * shape.rippleFrequency * Math.PI * 2 + widthT * 3.0) * lengthT;
      const lift = cupLift + ripple;

      // across-vector rotated about the spine by the twist: X' = cos·X − sin·up
      const lx = widthT * 2 * halfWidth;
      positions[write++] = lx * cosT;
      positions[write++] = spineY + lift * upY - lx * sinT * upY;
      positions[write++] = spineZ + lift * upZ - lx * sinT * upZ;
    }

    spineAngle = shape.curl * Math.pow(lengthT, shape.curlExponent);
    spineY += Math.cos(spineAngle) * stepLength;
    spineZ += Math.sin(spineAngle) * stepLength;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
