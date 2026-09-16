import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config/constants';
import { damp, lerp } from '../utils/math';
import { easeInOutSine } from '../animation/easing';

/**
 * A cinematic camera: a slow drift, an orbit the user can nudge, and a
 * "presentation" move that brings the bouquet closer and lower for the
 * message. Orbit input is applied as an offset on top of the authored pose so
 * the two never fight.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private basePosition = new THREE.Vector3(...CAMERA.introPosition);
  private baseTarget = new THREE.Vector3(...CAMERA.introTarget);
  private introPos = new THREE.Vector3(...CAMERA.introPosition);
  private introTarget = new THREE.Vector3(...CAMERA.introTarget);
  private finalPos = new THREE.Vector3(...CAMERA.finalPosition);
  private finalTarget = new THREE.Vector3(...CAMERA.finalTarget);
  /** 0 = intro framing, 1 = final "handed to you" framing */
  private presentation = 0;
  private presentationTarget = 0;
  private time = 0;
  private userOffset = new THREE.Spherical();
  private baseSpherical = new THREE.Spherical();
  private tmp = new THREE.Vector3();
  private aspectPush = 0;
  private interacting = false;
  private idleSeconds = 0;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far);
    this.camera.position.copy(this.basePosition);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.6;
    this.controls.minDistance = CAMERA.orbit.minDistance;
    this.controls.maxDistance = CAMERA.orbit.maxDistance;
    this.controls.minPolarAngle = CAMERA.orbit.minPolar;
    this.controls.maxPolarAngle = CAMERA.orbit.maxPolar;
    this.controls.minAzimuthAngle = CAMERA.orbit.minAzimuth;
    this.controls.maxAzimuthAngle = CAMERA.orbit.maxAzimuth;
    this.controls.target.copy(this.baseTarget);
    this.controls.addEventListener('start', () => { this.interacting = true; this.idleSeconds = 0; });
    this.controls.addEventListener('end', () => { this.interacting = false; });
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    // portrait phones: push the camera back so the bouquet still fits with room for text
    const portrait = w / h;
    this.aspectPush = portrait < 1 ? lerp(3.4, 0, portrait / 1) : 0;
    this.camera.updateProjectionMatrix();
  }

  /** 0..1 — moves toward the presentation framing. */
  present(amount: number) { this.presentationTarget = amount; }

  /** Snap back to the intro framing (used on reset — animated via damping). */
  reset() {
    this.presentationTarget = 0;
    this.userOffset.set(0, 0, 0);
    this.controls.target.copy(this.introTarget);
  }

  update(dt: number) {
    this.time += dt;
    this.presentation = damp(this.presentation, this.presentationTarget, 2.6, dt);
    const p = easeInOutSine(this.presentation);

    // authored pose
    this.basePosition.lerpVectors(this.introPos, this.finalPos, p);
    this.baseTarget.lerpVectors(this.introTarget, this.finalTarget, p);
    this.basePosition.z += this.aspectPush;

    // slow breathing drift — small enough to be felt, not seen
    const drift = CAMERA.driftAmplitude;
    const dx = Math.sin(this.time * CAMERA.driftSpeed) * drift;
    const dy = Math.sin(this.time * CAMERA.driftSpeed * 0.71 + 1.3) * drift * 0.5;

    // read what the user did with OrbitControls as an offset from the base
    if (this.interacting) {
      this.controls.update();
      this.tmp.copy(this.camera.position).sub(this.controls.target);
      this.userOffset.setFromVector3(this.tmp);
      this.baseSpherical.setFromVector3(this.tmp.copy(this.basePosition).sub(this.baseTarget));
      this.userOffset.theta -= this.baseSpherical.theta;
      this.userOffset.phi -= this.baseSpherical.phi;
      this.userOffset.radius -= this.baseSpherical.radius;
      return;
    }

    // relax the user's nudge back to the authored pose over time
    this.idleSeconds += dt;
    const relax = this.idleSeconds > 4 ? 6 : 60;
    this.userOffset.theta = damp(this.userOffset.theta, 0, relax, dt);
    this.userOffset.phi = damp(this.userOffset.phi, 0, relax, dt);
    this.userOffset.radius = damp(this.userOffset.radius, 0, relax, dt);

    this.baseSpherical.setFromVector3(this.tmp.copy(this.basePosition).sub(this.baseTarget));
    this.baseSpherical.theta += this.userOffset.theta;
    this.baseSpherical.phi = THREE.MathUtils.clamp(this.baseSpherical.phi + this.userOffset.phi, CAMERA.orbit.minPolar, CAMERA.orbit.maxPolar);
    this.baseSpherical.radius = THREE.MathUtils.clamp(this.baseSpherical.radius + this.userOffset.radius, CAMERA.orbit.minDistance, CAMERA.orbit.maxDistance + this.aspectPush);
    this.tmp.setFromSpherical(this.baseSpherical).add(this.baseTarget);
    this.tmp.x += dx; this.tmp.y += dy;

    this.camera.position.lerp(this.tmp, 1 - Math.exp(-dt / 0.35));
    this.controls.target.lerp(this.baseTarget, 1 - Math.exp(-dt / 0.35));
    this.camera.lookAt(this.controls.target);
  }
}
