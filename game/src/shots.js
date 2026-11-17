// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple driving
// autopilot (follow road waypoints) or by standing still, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { MISSIONS, PLACES, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 24;
const CHASE_SECONDS = 18;
const MISSION_SECONDS = 8;

/** Waypoints along the roads for the driving autopilot. Each pair shares one road, so the
 * straight line between them follows asphalt, never a building. The first point is the
 * nearest road to the garage, where the starter car sits. */
const DRIVE_ROUTE = [
  { x: 900, y: 610 },
  { x: 900, y: 300 },
  { x: 1500, y: 300 },
  { x: 1500, y: 1300 },
  { x: 2100, y: 1300 },
  { x: 2100, y: 1800 },
  { x: 900, y: 1800 },
  { x: 900, y: 800 },
  { x: 1500, y: 800 },
  { x: 1500, y: 300 },
  { x: 900, y: 300 },
];

/** Steer the player's car toward the next waypoint on the route. Brakes into sharp turns,
 * and reverses out if it ever gets wedged. `stuck` carries the recovery state. */
function driveAutopilot(world, routeIndex, stuck) {
  const state = world.state;
  const car = world.playerCar();
  if (!car) return { move: { x: 0, y: 0, sprint: false }, routeIndex };
  const target = DRIVE_ROUTE[routeIndex % DRIVE_ROUTE.length];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  if (Math.hypot(dx, dy) < 130) routeIndex += 1;
  const next = DRIVE_ROUTE[routeIndex % DRIVE_ROUTE.length];
  const desired = Math.atan2(next.y - car.y, next.x - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Stuck recovery: barely moving while trying to accelerate means wedged.
  const speed = Math.abs(car.speed);
  if (stuck.reversing > 0) {
    stuck.reversing -= 1 / 60;
    return { move: { x: -steer, y: 1, sprint: false }, routeIndex };
  }
  if (speed < 25) {
    stuck.still += 1 / 60;
    if (stuck.still > 1.2) {
      stuck.still = 0;
      stuck.reversing = 0.9;
      return { move: { x: -steer, y: 1, sprint: false }, routeIndex };
    }
  } else {
    stuck.still = 0;
  }
  // Brake into a sharp turn instead of sliding into a building.
  const throttle = Math.abs(diff) > 0.7 && speed > 120 ? 1 : -1;
  return { move: { x: steer, y: throttle, sprint: false }, routeIndex };
}

/** Put the player in the starter car by the garage. */
function putPlayerInStarterCar(world) {
  const state = world.state;
  const car = state.cars.find((c) => c.owned);
  if (!car) return;
  state.player.inCar = car.id;
  car.kind = 'player';
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/**
 * Set `world` to the named scene (start, drive, chase, mission; any other name is start)
 * and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, sprint: false }, 0, null);
    }
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'mission') {
    // Dusk at the pier: the last delivery of mission 3, marker lit, cash on the line.
    // The player stands on the pier looking at the marker (80 m away, outside the
    // delivery radius) while traffic moves behind — the moment before the drop-off.
    state.dusk = true;
    state.missionIndex = 2;
    state.missionStep = 1;
    const mission = MISSIONS[2];
    const step = mission.steps[1];
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    state.cash = 700;
    state.player.x = PLACES.pier.x;
    state.player.y = PLACES.pier.y - 80;
    state.player.angle = Math.PI / 2;
    state.camera.x = Math.max(0, Math.min(3600 - 1280, state.player.x - 640));
    state.camera.y = Math.max(0, Math.min(2600 - 720, state.player.y - 360));
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, sprint: false }, 0, null);
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  putPlayerInStarterCar(world);
  // Stage the car on the avenue at the start of the route, facing north: the drive
  // scenes then run entirely on roads, never across a block.
  const car = world.playerCar();
  if (car) {
    car.x = 900;
    car.y = 610;
    car.angle = -Math.PI / 2;
    car.speed = 0;
    state.player.x = 900;
    state.player.y = 610;
    state.player.angle = -Math.PI / 2;
  }
  if (name === 'chase') {
    state.wanted = 3;
  }
  const limit = name === 'chase' ? CHASE_SECONDS : DRIVE_SECONDS;
  let routeIndex = 0;
  const stuck = { still: 0, reversing: 0 };
  for (let i = 0; i < limit / STEP; i += 1) {
    const drive = driveAutopilot(world, routeIndex, stuck);
    routeIndex = drive.routeIndex;
    world.step(STEP, drive.move, 0, null);
  }
  if (name === 'chase') {
    // The toast was set at the start and expired during the run: put it back for the frame.
    state.toast = 'Polisi mengejarmu! Kabur!';
    state.toastTimer = 30;
  }
  const over = world.state.player.hp <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 1250 };
}
