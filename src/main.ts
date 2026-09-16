import './style.css';
import * as THREE from 'three';
import { INTERACTION } from './config/constants';
import { ExperienceState } from './state/ExperienceState';
import { SceneManager } from './scene/SceneManager';
import { CameraRig } from './scene/CameraRig';
import { Lighting } from './scene/Lighting';
import { Background } from './scene/Background';
import { PostProcessing } from './scene/PostProcessing';
import { Bouquet } from './flowers/Bouquet';
import { PollenSystem } from './particles/PollenSystem';
import { FallingPetals } from './particles/FallingPetals';
import { HandTracking } from './interaction/HandTracking';
import { GestureMapper } from './interaction/GestureMapper';
import { MouseFallback } from './interaction/MouseFallback';
import { Keyboard } from './interaction/Keyboard';
import { AutoPresentation } from './animation/AutoPresentation';
import { Intro } from './ui/Intro';
import { Instructions } from './ui/Instructions';
import { MessageReveal } from './ui/MessageReveal';
import { DebugPanel } from './ui/Debug';
import { clamp, damp } from './utils/math';

/* ------------------------------------------------------------------ scene */
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const sceneManager = new SceneManager(canvas);
const { scene, renderer, mobile } = sceneManager;
const cameraRig = new CameraRig(canvas);
const lighting = new Lighting();
const background = new Background();
const post = new PostProcessing(renderer, scene, cameraRig.camera, mobile);
const bouquet = new Bouquet();
const pollen = new PollenSystem(mobile);
const fallingPetals = new FallingPetals(mobile ? 5 : 7);

scene.add(lighting.group, background.mesh, bouquet.group, pollen.points, fallingPetals.group);
sceneManager.onResizeListener((w, h) => { cameraRig.resize(w, h); post.resize(w, h); });

/* ------------------------------------------------------------------ state */
const state = new ExperienceState();
const handTracking = new HandTracking(
  document.getElementById('webcam') as HTMLVideoElement,
  document.getElementById('hand-overlay') as HTMLCanvasElement,
);
const gestures = new GestureMapper();
const fallback = new MouseFallback(canvas);
const auto = new AutoPresentation();
const instructions = new Instructions();
const message = new MessageReveal();
let resetSmoothing = 0;   // >0 while a reset is animating closed

/* --------------------------------------------------------------- helpers */
function describeFallback(chosen: boolean) {
  const how = fallback.kind === 'touch'
    ? 'Press and hold to give the flowers.'
    : 'Move up to grow the bouquet, right to bloom.';
  instructions.setFallbackNote(chosen ? how : `Camera unavailable — ${how.charAt(0).toLowerCase()}${how.slice(1)}`);
}

function begin(mode: 'hands' | 'fallback', chosenWithoutCamera = false) {
  intro.hide();
  (document.activeElement as HTMLElement | null)?.blur();
  state.inputMode = mode === 'hands' ? 'hands' : fallback.kind === 'touch' ? 'touch' : 'mouse';
  state.cameraAvailable = mode === 'hands';
  fallback.enabled = mode !== 'hands';
  instructions.showCamera(mode === 'hands');
  if (mode !== 'hands') describeFallback(chosenWithoutCamera);
  state.transition('GROWING');
}

async function startWithCamera() {
  const ok = await handTracking.start();
  if (ok) begin('hands');
  else begin('fallback');
}

function reveal() {
  if (state.pastReveal) return;
  state.locked = true;
  state.targetGrowth = 1; state.targetBloom = 1;
  auto.stop();
  state.transition('MESSAGE_REVEAL');
}

function reset() {
  auto.stop();
  message.reset();
  fallingPetals.reset();
  instructions.reset();
  gestures.reset();
  fallback.reset();
  cameraRig.reset();
  resetSmoothing = 1.4;
  state.reset();
  intro.show();
}

/* ------------------------------------------------------------ transitions */
const _headPos = new THREE.Vector3();
state.onChange((next) => {
  if (next === 'MESSAGE_REVEAL') {
    cameraRig.present(1);
    pollen.pulse();
    message.start();
    instructions.dimCamera(true);
  }
  if (next === 'FINAL') {
    // nothing dramatic — the bouquet just stays
  }
  if (next === 'INTRO') {
    cameraRig.present(0);
    instructions.dimCamera(false);
  }
});
message.onFinal = () => state.transition('FINAL');

/* -------------------------------------------------------------------- ui */
const intro = new Intro(startWithCamera, () => begin('fallback', true));
// load the hand model in the background while the intro card is up, so enabling the camera feels instant
if (navigator.mediaDevices) void handTracking.warmUp();
const debug = new DebugPanel({
  autoGrow: () => { state.targetGrowth = 1; gestures.growth = 1; fallback.growth = 1; },
  autoBloom: () => { state.targetBloom = 1; gestures.bloom = 1; fallback.bloom = 1; },
  reset,
  toggleCamera: () => {
    if (handTracking.active) { handTracking.stop(); fallback.enabled = true; state.inputMode = fallback.kind === 'touch' ? 'touch' : 'mouse'; instructions.showCamera(false); describeFallback(true); }
    else handTracking.start().then((ok) => { if (ok) { fallback.enabled = false; state.inputMode = 'hands'; instructions.showCamera(true); } });
  },
  toggleTracking: () => { trackingPaused = !trackingPaused; },
  toggleLandmarks: () => {},
});
let trackingPaused = false;

const keyboard = new Keyboard({
  onReset: reset,
  onAuto: () => {
    if (!state.started) begin('fallback', true);
    if (auto.active) auto.stop(); else auto.start(state.growth, state.bloom);
  },
  onReveal: () => { if (!state.started) begin('fallback', true); reveal(); },
  onToggleUI: () => { state.uiHidden = !state.uiHidden; document.body.classList.toggle('ui-hidden', state.uiHidden); },
  onToggleDebug: () => debug.toggle(),
  onSwapHands: () => { handTracking.swapHands = !handTracking.swapHands; },
});

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
renderer.info.autoReset = false;
const headOrigins: THREE.Vector3[] = [];
let petalsDue = false;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  renderer.info.reset();
  state.tick(dt);
  if (resetSmoothing > 0) resetSmoothing -= dt;

  /* ---- input -> targets ---- */
  if (handTracking.active && !trackingPaused) {
    handTracking.read(now);
    handTracking.drawOverlay(debug.showLandmarks);
    gestures.update(handTracking.hands, dt, cameraRig.camera);
  }
  pollen.setHand(handTracking.active ? gestures.handWorld : null);

  if (state.started && !state.locked) {
    auto.update(dt);
    fallback.update(dt);
    if (auto.active) {
      state.targetGrowth = auto.growth; state.targetBloom = auto.bloom;
      gestures.growth = auto.growth; gestures.bloom = auto.bloom;
      fallback.growth = auto.growth; fallback.bloom = auto.bloom;
    } else if (handTracking.active) {
      state.targetGrowth = gestures.growth; state.targetBloom = gestures.bloom;
    } else {
      state.targetGrowth = fallback.growth; state.targetBloom = fallback.bloom;
    }
    // keyboard nudges whichever source is live
    if (keyboard.growHeld) { state.targetGrowth = clamp(state.growth + dt * 0.35); gestures.growth = fallback.growth = state.targetGrowth; }
    if (keyboard.bloomHeld) { state.targetBloom = clamp(state.bloom + dt * 0.35); gestures.bloom = fallback.bloom = state.targetBloom; }
  }
  if (state.locked) { state.targetGrowth = 1; state.targetBloom = 1; }

  /* ---- smoothing ---- */
  const smoothing = resetSmoothing > 0 ? 0.9 : state.locked ? 0.6 : INTERACTION.smoothingSeconds;
  state.growth = damp(state.growth, state.targetGrowth, smoothing, dt);
  state.bloom = damp(state.bloom, state.targetBloom, smoothing, dt);
  state.deriveFromControls();

  /* ---- the bouquet is given ---- */
  if (state.is('FULL_BOUQUET') && state.timeInState > 1.2 &&
      state.growth > INTERACTION.completeThreshold && state.bloom > INTERACTION.completeThreshold) {
    reveal();
  }
  if (state.pastReveal && !fallingPetals.hasReleased && state.bloom > 0.985) petalsDue = true;
  if (petalsDue && !fallingPetals.hasReleased) {
    headOrigins.length = 0;
    for (const f of bouquet.flowers) headOrigins.push(f.headWorldPosition(_headPos).clone());
    fallingPetals.release(headOrigins);
    petalsDue = false;
  }

  /* ---- scene ---- */
  const t = clock.elapsedTime;
  // a few buds always peek out of the paper, even before anything has happened
  bouquet.update(0.04 + 0.96 * state.growth, state.bloom, t);
  const warmth = bouquet.openness;
  lighting.update(dt, warmth);
  background.update(cameraRig.camera, dt, warmth);
  pollen.setVisibility(state.started ? 0.35 + 0.65 * warmth : 0.15);
  pollen.update(dt);
  fallingPetals.update(dt);
  if (!state.pastReveal) cameraRig.present(state.bloom * 0.28);
  cameraRig.update(dt);
  post.update(dt, state.pastReveal ? 1 : warmth * 0.5);
  post.render();

  /* ---- ui ---- */
  const progress = Math.max(state.growth, state.bloom * 0.5 + state.growth * 0.5);
  instructions.update(state.elapsed, progress, handTracking.active);
  message.update(dt);
  debug.update(dt, [
    `state    ${state.name}`,
    `input    ${state.inputMode}${auto.active ? ' (auto)' : ''}${gestures.singleHandMode ? ' (one hand)' : ''}`,
    `growth   ${state.growth.toFixed(3)} -> ${state.targetGrowth.toFixed(2)}`,
    `bloom    ${state.bloom.toFixed(3)} -> ${state.targetBloom.toFixed(2)}`,
    `hands    L${gestures.leftSeen ? '✓' : '·'} R${gestures.rightSeen ? '✓' : '·'}  tracker ${handTracking.status} ${handTracking.delegate}${handTracking.lastError ? ' ' + handTracking.lastError : ''}`,
    `flowers  ${bouquet.flowerCount}   draws ${renderer.info.render.calls}   tris ${renderer.info.render.triangles}`,
    `keys     G/B grow/bloom · Space auto · Enter reveal · R reset · H ui · S swap hands`,
  ]);
}

frame();

// expose for console tinkering
(window as unknown as { bouquet: unknown }).bouquet = { state, bouquet, cameraRig, handTracking, gestures, auto, reveal, reset };
