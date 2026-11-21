// The simulation of Kota Neon, with no drawing and no browser in it: the player on foot and
// in cars and on motorcycles, traffic, pedestrians, police, the wanted level, the ten-mission
// story, combat, the taxi side job and the day cycle — the city itself. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react (sound, screens,
// saves) without the world knowing about them.
import { BEACH, BIKE, CAR, DASH, DAY, FUEL, MISSIONS, NITRO, PASSENGER, PEDS, PLACES, PLAYER, POLICE, REPAIR, ROADBLOCK, ROADS, TAXI, TRAFFIC, WANTED, WORLD } from './config.js';
import { createCity, hitsBuilding, inSea, nearestRoadPoint, onPier, onRoad, onSand, ROAD_HALF } from './city.js';
import { gauss, pick, range, sample, weightedPick } from './random.js';
import { ACTION_DASH, ACTION_ENTER, ACTION_HONK, ACTION_HONK_LONG, ACTION_LIGHTS, ACTION_PUNCH, ACTION_REPAIR } from './input.js';

export const EVENT_PICKUP = 1;
export const EVENT_CRASH = 2;
export const EVENT_HIT = 4;
export const EVENT_STEAL = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_STORY = 64;
export const EVENT_PUNCH = 128;
export const EVENT_FAIL = 256;
export const EVENT_HONK = 512;
export const EVENT_TAXI = 1024;
export const EVENT_DASH = 2048;
export const EVENT_FUEL = 4096;
export const EVENT_REPAIR = 8192;
export const EVENT_ROADBLOCK = 16384;
export const EVENT_PASSENGER = 32768;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/** Lane offset for right-hand traffic on a road: which side of the centreline to drive on. */
function laneOffset(axis, dir) {
  if (axis === 'v') return dir > 0 ? -28 : 28;
  return dir > 0 ? 28 : -28;
}

export function createWorld(random) {
  const city = createCity(random);
  let carId = 0;
  let pedId = 0;

  const player = {
    x: PLACES.garage.x, y: PLACES.garage.y + 90, angle: -Math.PI / 2,
    hp: PLAYER.hp, inCar: null, punchCooldown: 0, invulnerable: 0, moving: false,
  };
  const camera = { x: 0, y: 0 };
  const cars = [];
  const peds = [];
  const officers = [];
  const particles = [];
  const state = {
    player, camera, cars, peds, officers, particles, city,
    cash: 0, wanted: 0, wantedTimer: 0, bustHold: 0,
    missionIndex: 0, missionStep: 0, missionTimer: 0, missionLabel: '',
    marker: null, elapsed: 0, dusk: false, storyDone: false,
    toast: '', toastTimer: 0, speed: 0, passenger: false,
    nitro: 1, nitroCooldown: 0, nitroActive: false,
    dashCooldown: 0, dashTimer: 0, dashDir: { x: 0, y: 0 },
    timeOfDay: 0.3, nightFactor: 0,
    taxiActive: false, taxiFare: 0, taxiDropoff: null,
    taxiCooldown: TAXI.firstHailDelay, taxiHail: null,
    // Round 5: fuel, headlights, roadblocks, the VIP passenger job, stats.
    fuel: 1, fuelWarned: false, fuelEmptyToasted: false, headlights: false,
    roadblocks: [], roadblockCooldown: 0, roadblockHitCooldown: 0,
    passenger2: null, passenger2Cooldown: PASSENGER.firstDelay,
    passenger2Client: null, passenger2StartedAt: 0,
    stats: { carsStolen: 0, timesBusted: 0, faresDone: 0, missionsDone: 0, cashEarned: 0 },
    lastMission: null, summaryTimer: 0, missionStartElapsed: 0, raceCheckpoint: 0,
  };

  function toast(text, seconds = 3) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function addParticle(x, y, vx, vy, life, color, size) {
    if (particles.length > 220) particles.shift();
    particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
  }

  function sparks(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * TAU;
      const s = range(random, 60, 260);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, range(random, 0.2, 0.5), color, range(random, 2, 4));
    }
  }

  function makeCar(x, y, angle, kind, color, missionCar = false, vehicle = 'car') {
    const car = {
      id: carId += 1, x, y, angle, speed: 0, color, kind, hp: vehicle === 'bike' ? BIKE.hp : CAR.hp,
      owned: false, missionCar, wrecked: false, smokeTimer: 0, ai: null, spin: 0, vehicle,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar(nearX, nearY) {
    const point = nearestRoadPoint(nearX + range(random, -600, 600), nearY + range(random, -600, 600));
    const dir = random() < 0.5 ? 1 : -1;
    // One in five road users rides a motorcycle: quicker, narrower, same rules.
    const vehicle = random() < BIKE.trafficChance ? 'bike' : 'car';
    const cruise = (TRAFFIC.cruiseSpeed + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter)) * (vehicle === 'bike' ? 1.3 : 1);
    const car = makeCar(
      point.axis === 'v' ? point.road + laneOffset('v', dir) : point.x,
      point.axis === 'v' ? point.y : point.road + laneOffset('h', dir),
      point.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      'traffic', pick(random, ['#d94f3d', '#3d7bd9', '#e8c53a', '#7a4fd9', '#e8e8e8', '#3aa655', '#e07a9e', '#2b2b33']),
      false, vehicle,
    );
    car.ai = { axis: point.axis, road: point.road, dir, cruise, turnCooldown: 0 };
    return car;
  }

  function spawnParkedCar() {
    const spot = pick(random, city.parking);
    const angle = pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const vehicle = random() < BIKE.parkedChance ? 'bike' : 'car';
    const car = makeCar(spot.x, spot.y, angle, 'parked', pick(random, ['#d94f3d', '#3d7bd9', '#e8c53a', '#7a4fd9', '#e8e8e8', '#3aa655']), false, vehicle);
    return car;
  }

  function spawnPoliceCar() {
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = range(random, 100, WORLD.width - 100); y = 120; }
    else if (edge === 1) { x = range(random, 100, WORLD.width - 100); y = WORLD.height - 200; }
    else if (edge === 2) { x = 120; y = range(random, 100, WORLD.height - 300); }
    else { x = WORLD.width - 120; y = range(random, 100, WORLD.height - 300); }
    const car = makeCar(x, y, angleTo(x, y, player.x, player.y), 'police', '#2b4acb');
    car.ai = { chase: true };
    car.speed = POLICE.carSpeed * 0.6;
    return car;
  }

  function spawnOfficer() {
    const a = random() * TAU;
    const x = clamp(player.x + Math.cos(a) * 320, 40, WORLD.width - 40);
    const y = clamp(player.y + Math.sin(a) * 320, 40, WORLD.height - 40);
    officers.push({ id: pedId += 1, x, y, angle: 0, hp: 30, downTimer: 0, punchCooldown: 0 });
  }

  function spawnPed() {
    const point = nearestRoadPoint(range(random, 100, WORLD.width - 100), range(random, 100, WORLD.height - 400));
    const axis = point.axis;
    const dir = random() < 0.5 ? 1 : -1;
    const side = random() < 0.5 ? -1 : 1;
    const x = axis === 'v' ? point.road + side * (ROAD_HALF + 16) : point.x;
    const y = axis === 'v' ? point.y : point.road + side * (ROAD_HALF + 16);
    peds.push({
      id: pedId += 1, x, y, angle: axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: PEDS.walkSpeed, state: 'walk', downTimer: 0, fleeTimer: 0,
      axis, dir, road: point.road, side, color: pick(random, ['#e8b04b', '#c96f9e', '#7fb069', '#e07a5f', '#6a8caf', '#d9a05b']),
    });
  }

  function currentMission() {
    return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
  }

  function currentStep() {
    const mission = currentMission();
    return mission ? mission.steps[state.missionStep] : null;
  }

  function applyMissionStart() {
    const mission = currentMission();
    if (!mission) {
      state.marker = null;
      state.missionLabel = '';
      return;
    }
    state.missionStep = 0;
    if (mission.wanted) state.wanted = Math.max(state.wanted, mission.wanted);
    if (mission.id === 'mobil-pesanan') {
      const red = makeCar(PLACES.beachParking.x, PLACES.beachParking.y, Math.PI / 2, 'parked', '#d91f2e', true);
      red.hp = CAR.hp;
    }
    if (mission.vehicle === 'bike') {
      // The mission vehicle is a motorcycle: park a red one where the steal step points.
      const stealStep = mission.steps.find((s) => s.type === 'steal');
      if (stealStep) {
        const bike = makeCar(stealStep.x, stealStep.y, Math.PI / 2, 'parked', '#d91f2e', true, 'bike');
        bike.hp = BIKE.hp;
      }
    }
    const step = currentStep();
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (step.time) state.missionTimer = step.time;
    state.missionStartElapsed = state.elapsed;
    state.raceCheckpoint = 0;
    if (step.type === 'race') {
      // A race step points at its first checkpoint, not at one fixed spot.
      const first = step.checkpoints[0];
      state.missionLabel = `${mission.title}: ${first.label}`;
      state.marker = { x: first.x, y: first.y };
    }
    toast(`${mission.title} — ${mission.briefing}`, 5);
  }

  function advanceStep(events) {
    const mission = currentMission();
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      state.cash += mission.reward;
      state.stats.missionsDone += 1;
      state.stats.cashEarned += mission.reward;
      // A fast finish on a timed mission pays a $50 speed bonus on top.
      const seconds = Math.max(0, Math.round(state.elapsed - state.missionStartElapsed));
      const bonus = (mission.steps.some((s) => s.time) && state.missionTimer > 20) ? 50 : 0;
      if (bonus > 0) {
        state.cash += bonus;
        state.stats.cashEarned += bonus;
      }
      state.lastMission = { title: mission.title, reward: mission.reward, seconds, bonus };
      state.summaryTimer = 5;
      toast(`Misi selesai! +$${mission.reward}${bonus > 0 ? ` + bonus $${bonus}` : ''}`, 4);
      state.missionIndex += 1;
      state.passenger = false;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyDone = true;
        state.marker = null;
        state.missionLabel = 'Cerita selesai — Kota Neon milikmu sekarang.';
        return events | EVENT_STORY;
      }
      applyMissionStart();
      return events | EVENT_MISSION;
    }
    const step = currentStep();
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (step.time) state.missionTimer = step.time;
    if (step.type === 'race') {
      state.raceCheckpoint = 0;
      const first = step.checkpoints[0];
      state.missionLabel = `${mission.title}: ${first.label}`;
      state.marker = { x: first.x, y: first.y };
    }
    return events | EVENT_PICKUP;
  }

  function failMission() {
    const mission = currentMission();
    if (!mission) return;
    toast(`Misi gagal: ${mission.title} — coba lagi!`, 4);
    state.wanted = 0;
    state.missionStep = 0;
    state.raceCheckpoint = 0;
    const step = currentStep();
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (step.time) state.missionTimer = step.time;
    if (step.type === 'race') {
      const first = step.checkpoints[0];
      state.missionLabel = `${mission.title}: ${first.label}`;
      state.marker = { x: first.x, y: first.y };
    }
    player.x = PLACES.garage.x;
    player.y = PLACES.garage.y + 90;
    player.inCar = null;
  }

  function wantedUp(amount) {
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.wantedTimer = 0;
  }

  function playerCar() {
    if (player.inCar === null) return null;
    return cars.find((c) => c.id === player.inCar) ?? null;
  }

  function nearestCar(x, y, maxDistance, kinds) {
    let best = null;
    let bestDistance = maxDistance;
    for (const car of cars) {
      if (!kinds.includes(car.kind)) continue;
      const d = distance(x, y, car.x, car.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(events) {
    const car = nearestCar(player.x, player.y, CAR.enterRadius, ['parked', 'traffic']);
    if (!car) return events;
    // Stealing a car with a driver in it: the driver jumps out and runs.
    if (car.kind === 'traffic') {
      peds.push({
        id: pedId += 1, x: car.x - 40, y: car.y, angle: Math.PI, speed: PEDS.fleeSpeed,
        state: 'flee', downTimer: 0, fleeTimer: 3, axis: 'v', dir: 1, road: car.x, side: 1,
        color: '#e07a5f',
      });
    }
    player.inCar = car.id;
    car.kind = 'player';
    car.ai = null;
    if (!car.owned) {
      car.owned = true;
      state.stats.carsStolen += 1;
      // A stolen car always has at least a quarter tank in it.
      state.fuel = Math.max(state.fuel, 0.25);
      state.fuelWarned = state.fuel < FUEL.lowWarn;
      state.fuelEmptyToasted = false;
      wantedUp(WANTED.steal);
      toast('Mobil dicuri! Polisi mengejarmu!', 3);
      return events | EVENT_STEAL;
    }
    return events;
  }

  function exitCar() {
    const car = playerCar();
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    const side = player.angle + Math.PI / 2;
    player.x = clamp(car.x + Math.cos(side) * 48, 20, WORLD.width - 20);
    player.y = clamp(car.y + Math.sin(side) * 48, 20, WORLD.height - 20);
    player.inCar = null;
  }

  function punch(events) {
    if (player.inCar !== null || player.punchCooldown > 0) return events;
    player.punchCooldown = PLAYER.punchCooldown;
    const px = player.x + Math.cos(player.angle) * (PLAYER.radius + 24);
    const py = player.y + Math.sin(player.angle) * (PLAYER.radius + 24);
    let hit = false;
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (distance(px, py, ped.x, ped.y) < PLAYER.punchRange) {
        ped.state = 'down';
        ped.downTimer = 3;
        ped.x += Math.cos(player.angle) * 30;
        ped.y += Math.sin(player.angle) * 30;
        wantedUp(WANTED.hitPed);
        hit = true;
      }
    }
    for (const officer of officers) {
      if (officer.downTimer > 0) continue;
      if (distance(px, py, officer.x, officer.y) < PLAYER.punchRange) {
        officer.hp -= PLAYER.punchDamage;
        officer.x += Math.cos(player.angle) * 36;
        officer.y += Math.sin(player.angle) * 36;
        if (officer.hp <= 0) officer.downTimer = 4;
        hit = true;
      }
    }
    if (hit) return events | EVENT_PUNCH;
    return events;
  }

  function moveWithCollision(entity, dx, dy, radius) {
    // The pier crosses the sea: walking on it is allowed.
    const blocked = (x, y) => hitsBuilding(city, x, y, radius) || (inSea(x, y) && !onPier(x, y));
    const nx = clamp(entity.x + dx, 20, WORLD.width - 20);
    if (!blocked(nx, entity.y)) entity.x = nx;
    const ny = clamp(entity.y + dy, 20, WORLD.height - 20);
    if (!blocked(entity.x, ny)) entity.y = ny;
  }

  function updatePlayerOnFoot(dt, move) {
    if (state.dashCooldown > 0) state.dashCooldown = Math.max(0, state.dashCooldown - dt);
    if (state.dashTimer > 0) {
      // Mid-dash: burst along the dash direction, trailing cyan sparks.
      state.dashTimer = Math.max(0, state.dashTimer - dt);
      moveWithCollision(player, state.dashDir.x * DASH.speed * dt, state.dashDir.y * DASH.speed * dt, PLAYER.radius);
      if (random() < 0.7) {
        addParticle(player.x - state.dashDir.x * 10, player.y - state.dashDir.y * 10,
          -state.dashDir.x * 40 + range(random, -30, 30), -state.dashDir.y * 40 + range(random, -30, 30), 0.3, '#4de8e8', 4);
      }
      player.moving = true;
      if (player.punchCooldown > 0) player.punchCooldown -= dt;
      if (player.invulnerable > 0) player.invulnerable -= dt;
      return;
    }
    const speed = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    let dx = move.x;
    let dy = move.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      player.angle = Math.atan2(dy, dx);
      player.moving = true;
    } else {
      player.moving = false;
    }
    moveWithCollision(player, dx * speed * dt, dy * speed * dt, PLAYER.radius);
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
  }

  function updatePlayerCar(dt, move) {
    const car = playerCar();
    if (!car) return;
    if (car.wrecked) {
      car.speed = 0;
      return;
    }
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const onSandNow = onSand(car.x, car.y);
    // A motorcycle handles differently from a car: sharper steering, harder
    // acceleration, a higher top speed — and a much smaller margin for error.
    const tune = car.vehicle === 'bike' ? BIKE : CAR;
    const halfWidth = car.vehicle === 'bike' ? BIKE.width / 2 + 2 : CAR.width / 2;
    // No fuel, no drive: an empty tank leaves the car rolling to a stop.
    const outOfFuel = state.fuel <= 0;
    // Nitro: Shift while accelerating forward. The meter drains while it burns,
    // locks out briefly when it runs dry, and refills while idle.
    const wantNitro = move.sprint && move.y < 0 && state.nitroCooldown <= 0 && state.nitro > 0;
    state.nitroActive = wantNitro;
    if (wantNitro) {
      state.nitro = Math.max(0, state.nitro - NITRO.drain * dt);
      if (state.nitro <= 0) {
        state.nitroCooldown = NITRO.emptyCooldown;
        toast('Nitro habis! Isi ulang…', 2);
      }
    } else {
      state.nitro = Math.min(1, state.nitro + NITRO.regen * dt);
      if (state.nitroCooldown > 0) state.nitroCooldown = Math.max(0, state.nitroCooldown - dt);
    }
    const accelMax = (onSandNow ? tune.accel * 0.55 : tune.accel) + (wantNitro ? NITRO.accelBonus : 0);
    const topSpeed = wantNitro ? tune.maxSpeed * NITRO.boost : tune.maxSpeed;
    if (move.y < 0 && !outOfFuel) car.speed += accelMax * dt;
    else if (move.y > 0) {
      if (car.speed > 20) car.speed -= tune.brake * dt;
      else car.speed -= tune.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 160 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    car.speed = clamp(car.speed, -tune.maxReverse, topSpeed);
    const steerInput = move.x;
    const steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += steerInput * tune.steer * steerFactor * Math.sign(car.speed || 1) * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (hitsBuilding(city, nx, ny, halfWidth) || inSea(nx, ny)) {
      car.hp -= Math.abs(car.speed) * 0.06;
      sparks(car.x + Math.cos(car.angle) * 34, car.y + Math.sin(car.angle) * 34, 8, '#ffb347');
      car.speed *= -0.25;
      if (car.hp <= 0) {
        car.wrecked = true;
        toast('Mobilmu rusak parah! Cari mobil lain.', 4);
      }
    } else {
      car.x = clamp(nx, 20, WORLD.width - 20);
      car.y = clamp(ny, 20, WORLD.height - 20);
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    state.speed = Math.abs(car.speed);
    if (Math.abs(car.speed) > 60 && random() < 0.3) {
      addParticle(car.x - forward.x * 34, car.y - forward.y * 34, -forward.x * 30 + range(random, -20, 20), -forward.y * 30 + range(random, -20, 20), 0.4, '#c9c2ae', 3);
    }
    if (wantNitro) {
      // Exhaust flames: bright orange and yellow, streaming backwards.
      for (let i = 0; i < 2; i += 1) {
        addParticle(car.x - forward.x * 36 + range(random, -6, 6), car.y - forward.y * 36 + range(random, -6, 6),
          -forward.x * range(random, 120, 220) + range(random, -30, 30), -forward.y * range(random, 120, 220) + range(random, -30, 30),
          range(random, 0.2, 0.35), pick(random, ['#ff9a3d', '#ffd23f', '#ff5b2e']), range(random, 4, 7));
      }
    }
    if (car.hp < 40 && random() < 0.2) {
      addParticle(car.x, car.y - 10, range(random, -10, 10), -40, 0.8, '#555', 6);
    }
  }

  function updateTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic' || !car.ai || !car.ai.axis) continue;
      const ai = car.ai;
      ai.turnCooldown = Math.max(0, ai.turnCooldown - dt);
      // Slow down for the car ahead on the same road.
      let targetSpeed = ai.cruise;
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        if (ai.axis === 'v') {
          if (Math.abs(other.x - car.x) < 44 && Math.sign(other.y - car.y) === ai.dir && Math.abs(other.y - car.y) < 110) {
            targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 20));
            if (Math.abs(other.y - car.y) < 56) targetSpeed = 0;
          }
        } else if (Math.abs(other.y - car.y) < 44 && Math.sign(other.x - car.x) === ai.dir && Math.abs(other.x - car.x) < 110) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 20));
          if (Math.abs(other.x - car.x) < 56) targetSpeed = 0;
        }
      }
      car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
      if (ai.axis === 'v') car.y += ai.dir * car.speed * dt;
      else car.x += ai.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const crossings = ai.axis === 'v' ? ROADS.streets : ROADS.avenues;
      for (const cross of crossings) {
        const pos = ai.axis === 'v' ? car.y : car.x;
        if (Math.abs(pos - cross) < 26 && ai.turnCooldown === 0 && random() < 0.35) {
          const newDir = random() < 0.5 ? 1 : -1;
          const newAxis = ai.axis === 'v' ? 'h' : 'v';
          if (newAxis === 'h') {
            car.y = cross + laneOffset('h', newDir);
            car.x = car.x;
            car.angle = newDir > 0 ? 0 : Math.PI;
          } else {
            car.x = cross + laneOffset('v', newDir);
            car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          ai.axis = newAxis;
          ai.road = cross;
          ai.dir = newDir;
          ai.turnCooldown = 2;
          break;
        }
      }
      // Wrap around the map edges: a car that leaves town comes back on the other side.
      if (car.x < -80) car.x = WORLD.width + 60;
      if (car.x > WORLD.width + 80) car.x = -60;
      if (car.y < -80) car.y = WORLD.height + 60;
      if (car.y > WORLD.height + 80) car.y = -60;
    }
  }

  function updatePolice(dt, events) {
    const wantCars = state.wanted > 0 ? Math.min(POLICE.maxCars, 1 + state.wanted) : 0;
    const policeCars = cars.filter((c) => c.kind === 'police');
    if (policeCars.length < wantCars) spawnPoliceCar();
    if (state.wanted > 0 && player.inCar === null && officers.filter((o) => o.downTimer === 0).length < Math.min(3, 1 + state.wanted)) {
      if (random() < 0.02) spawnOfficer();
    }
    for (const car of policeCars) {
      if (car.wrecked) continue;
      const target = angleTo(car.x, car.y, player.x, player.y);
      const diff = angleDiff(car.angle, target);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      car.speed = Math.min(POLICE.carSpeed, car.speed + 300 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!hitsBuilding(city, nx, ny, CAR.width / 2) && !inSea(nx, ny)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.angle += 0.9 * dt * 4;
        car.speed *= 0.6;
      }
      // Ramming the player's car, or being rammed by it.
      const pCar = playerCar();
      if (pCar && distance(car.x, car.y, pCar.x, pCar.y) < 58) {
        const rel = Math.abs(car.speed - pCar.speed);
        if (rel > 120) {
          car.hp -= rel * 0.12;
          pCar.hp -= rel * 0.08;
          sparks((car.x + pCar.x) / 2, (car.y + pCar.y) / 2, 10, '#ffb347');
          events |= EVENT_CRASH;
          if (car.hp <= 0) {
            car.wrecked = true;
            car.speed = 0;
            toast('Mobil polisi hancur!', 3);
          }
          if (pCar.hp <= 0) {
            pCar.wrecked = true;
            toast('Mobilmu rusak parah! Cari mobil lain.', 4);
          }
        }
        if (Math.abs(pCar.speed) < 40 && Math.abs(car.speed) < 120) {
          state.bustHold += dt;
        }
      }
      if (car.hp < 30 && random() < 0.25) {
        addParticle(car.x, car.y - 10, range(random, -10, 10), -40, 0.8, '#555', 6);
      }
    }
    for (const officer of officers) {
      if (officer.downTimer > 0) {
        officer.downTimer -= dt;
        continue;
      }
      const d = distance(officer.x, officer.y, player.x, player.y);
      if (player.inCar === null && d < 900) {
        const a = angleTo(officer.x, officer.y, player.x, player.y);
        officer.angle = a;
        moveWithCollision(officer, Math.cos(a) * POLICE.footSpeed * dt, Math.sin(a) * POLICE.footSpeed * dt, 12);
        if (d < 34) {
          officer.punchCooldown -= dt;
          if (officer.punchCooldown <= 0) {
            officer.punchCooldown = 0.9;
            player.hp -= POLICE.punchDamage;
            player.invulnerable = 0.4;
            events |= EVENT_HIT;
          }
          state.bustHold += dt;
        }
      } else if (player.inCar !== null) {
        // On foot officers cannot catch a car: they jog back toward the road.
        const point = nearestRoadPoint(officer.x, officer.y);
        const a = angleTo(officer.x, officer.y, point.x, point.y);
        moveWithCollision(officer, Math.cos(a) * 120 * dt, Math.sin(a) * 120 * dt, 12);
      }
    }
    return events;
  }

  function updatePeds(dt) {
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.fleeTimer = 2;
        }
        continue;
      }
      const pCar = playerCar();
      const threat = pCar && distance(ped.x, ped.y, pCar.x, pCar.y) < 110 && Math.abs(pCar.speed) > 150;
      const nearPlayer = distance(ped.x, ped.y, player.x, player.y) < 60 && player.inCar !== null && Math.abs(state.speed) > 150;
      if ((threat || nearPlayer) && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeTimer = 2;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const a = angleTo(player.x, player.y, ped.x, ped.y);
        ped.angle = a;
        moveWithCollision(ped, Math.cos(a) * PEDS.fleeSpeed * dt, Math.sin(a) * PEDS.fleeSpeed * dt, 10);
        if (ped.fleeTimer <= 0) ped.state = 'walk';
        continue;
      }
      // Walk along the sidewalk; at an intersection, sometimes turn.
      const step = ped.speed * dt;
      if (ped.axis === 'v') {
        ped.y += ped.dir * step;
        if (ped.y < 60 || ped.y > WORLD.height - 320) ped.dir *= -1;
        for (const street of ROADS.streets) {
          if (Math.abs(ped.y - street) < 12 && random() < 0.02) {
            ped.axis = 'h';
            ped.road = street;
            ped.y = street + ped.side * (ROAD_HALF + 16);
            ped.angle = ped.dir > 0 ? 0 : Math.PI;
            break;
          }
        }
      } else {
        ped.x += ped.dir * step;
        if (ped.x < 60 || ped.x > WORLD.width - 60) ped.dir *= -1;
        for (const avenue of ROADS.avenues) {
          if (Math.abs(ped.x - avenue) < 12 && random() < 0.02) {
            ped.axis = 'v';
            ped.road = avenue;
            ped.x = avenue + ped.side * (ROAD_HALF + 16);
            ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            break;
          }
        }
      }
      // Hit by the player's car: knocked down, and the law notices.
      if (pCar && Math.abs(pCar.speed) > 60 && distance(ped.x, ped.y, pCar.x, pCar.y) < 46) {
        ped.state = 'down';
        ped.downTimer = 3;
        ped.x += Math.cos(pCar.angle) * 26;
        ped.y += Math.sin(pCar.angle) * 26;
        wantedUp(WANTED.hitPed);
        toast('Kamu menabrak pejalan kaki! Wanted naik!', 3);
      }
    }
  }

  function updateMissions(dt, events) {
    const step = currentStep();
    if (!step) return events;
    if (step.time) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        events |= EVENT_FAIL;
        failMission();
        return events;
      }
    }
    const px = player.x;
    const py = player.y;
    if (step.type === 'goto' || step.type === 'timed' || step.type === 'escape') {
      if (distance(px, py, step.x, step.y) < step.radius) {
        if (step.type === 'escape') state.wanted = 0;
        return advanceStep(events);
      }
    } else if (step.type === 'steal') {
      const car = playerCar();
      if (car && car.missionCar) {
        state.wanted = Math.max(state.wanted, 1);
        return advanceStep(events);
      }
    } else if (step.type === 'deliverCar') {
      const car = playerCar();
      if (car && car.missionCar && distance(px, py, step.x, step.y) < step.radius) {
        return advanceStep(events);
      }
    } else if (step.type === 'race') {
      // A checkpoint race: pass every checkpoint in order before the clock dies.
      const checkpoint = step.checkpoints[state.raceCheckpoint];
      if (checkpoint && distance(px, py, checkpoint.x, checkpoint.y) < checkpoint.radius) {
        state.raceCheckpoint += 1;
        if (state.raceCheckpoint >= step.checkpoints.length) return advanceStep(events);
        const next = step.checkpoints[state.raceCheckpoint];
        state.missionLabel = `${currentMission().title}: ${next.label}`;
        state.marker = { x: next.x, y: next.y };
        return events | EVENT_PICKUP;
      }
    }
    return events;
  }

  /** Fuel: the tank drains with distance driven, and refills at the SPBU pump
   * while the car sits by it — cash pays per unit filled. An empty tank stalls
   * the car; a stolen car always has at least a quarter tank in it. */
  function updateFuel(dt, events) {
    const car = playerCar();
    if (!car || car.wrecked) return events;
    const driven = Math.abs(car.speed) * dt;
    if (driven > 0) state.fuel = Math.max(0, state.fuel - driven * FUEL.drainPerMetre);
    if (state.fuel < FUEL.lowWarn && !state.fuelWarned) {
      state.fuelWarned = true;
      toast('Bensin menipis! Cari SPBU Neon.', 3);
      events |= EVENT_FUEL;
    }
    if (state.fuel <= 0 && !state.fuelEmptyToasted) {
      state.fuelEmptyToasted = true;
      toast('Bensin habis! Mobil mogok — curi mobil lain.', 4);
      events |= EVENT_FUEL;
    }
    const nearPump = distance(car.x, car.y, PLACES.gasStation.x, PLACES.gasStation.y) < FUEL.refillRadius;
    if (nearPump && Math.abs(car.speed) < 20 && state.fuel < 1 && state.cash > 0) {
      const want = Math.min(FUEL.refillRate * dt, 1 - state.fuel);
      const fill = Math.min(want, state.cash / FUEL.pricePerUnit);
      if (fill > 0) {
        state.fuel += fill;
        state.cash -= fill * FUEL.pricePerUnit;
        if (state.fuel >= 1) {
          state.fuelWarned = false;
          state.fuelEmptyToasted = false;
          toast('Tangki penuh! Siap jalan lagi.', 3);
        }
      }
    }
    return events;
  }

  /** Repair (R): only at Bengkel Sari, only the car you are driving, and only
   * if you can pay the bill — per missing HP, with a minimum charge. */
  function repairCar(events) {
    const car = playerCar();
    if (!car) {
      toast('Masuk mobil dulu untuk memperbaiki.', 3);
      return events;
    }
    if (distance(player.x, player.y, PLACES.garage.x, PLACES.garage.y) > REPAIR.radius) {
      toast('Perbaiki mobil hanya di Bengkel Sari.', 3);
      return events;
    }
    const maxHp = car.vehicle === 'bike' ? BIKE.hp : CAR.hp;
    if (car.hp >= maxHp) {
      toast('Mobilmu sudah prima.', 2);
      return events;
    }
    const cost = Math.max(REPAIR.minCost, Math.ceil((maxHp - car.hp) * REPAIR.pricePerHp));
    if (state.cash < cost) {
      toast(`Uang tidak cukup untuk bengkel ($${cost}).`, 3);
      return events;
    }
    state.cash -= cost;
    car.hp = maxHp;
    sparks(car.x, car.y, 12, '#58d68d');
    toast(`Mobil diperbaiki! -$${cost}`, 3);
    return events | EVENT_REPAIR;
  }

  /** Headlights (L): a toggle, so the player can light the road at dusk even
   * before full night — the renderer makes the cone longer and brighter. */
  function toggleHeadlights(events) {
    state.headlights = !state.headlights;
    toast(state.headlights ? 'Lampu depan menyala.' : 'Lampu depan mati.', 2);
    return events;
  }

  /** Police roadblocks: once wanted hits 3, the police seal the road ahead of
   * the player with cones. Ramming a cone damages the car and slows it hard;
   * the block clears as soon as the heat drops below 3. */
  function updateRoadblocks(dt, events) {
    if (state.roadblockHitCooldown > 0) state.roadblockHitCooldown = Math.max(0, state.roadblockHitCooldown - dt);
    if (state.roadblockCooldown > 0) state.roadblockCooldown -= dt;
    if (state.wanted < ROADBLOCK.minWanted) {
      if (state.roadblocks.length > 0) state.roadblocks.length = 0;
      return events;
    }
    if (state.roadblocks.length < ROADBLOCK.maxActive && state.roadblockCooldown <= 0) {
      const aheadX = player.x + Math.cos(player.angle) * ROADBLOCK.aheadDistance;
      const aheadY = player.y + Math.sin(player.angle) * ROADBLOCK.aheadDistance;
      const point = nearestRoadPoint(aheadX, aheadY);
      const bx = point.axis === 'v' ? point.road : point.x;
      const by = point.axis === 'v' ? point.y : point.road;
      const cones = [];
      for (let i = 0; i < ROADBLOCK.coneCount; i += 1) {
        const across = -ROAD_HALF + 20 + (i * (ROAD_HALF * 2 - 40)) / (ROADBLOCK.coneCount - 1);
        const jitter = gauss(random) * 6;
        cones.push(point.axis === 'v'
          ? { x: bx + across + jitter, y: by }
          : { x: bx, y: by + across + jitter });
      }
      state.roadblocks.push({ x: bx, y: by, axis: point.axis, cones });
      state.roadblockCooldown = ROADBLOCK.spawnCooldown;
      toast('Polisi memasang roadblock di depan!', 3);
      events |= EVENT_ROADBLOCK;
    }
    const car = playerCar();
    if (car && !car.wrecked && state.roadblockHitCooldown <= 0) {
      for (const block of state.roadblocks) {
        for (const cone of block.cones) {
          if (distance(car.x, car.y, cone.x, cone.y) < ROADBLOCK.hitRadius) {
            car.hp -= ROADBLOCK.hitDamage;
            car.speed *= 0.4;
            sparks(cone.x, cone.y, 8, '#ffb347');
            state.roadblockHitCooldown = ROADBLOCK.hitCooldown;
            toast('Kamu menabrak roadblock!', 3);
            events |= EVENT_ROADBLOCK;
            if (car.hp <= 0) {
              car.wrecked = true;
              toast('Mobilmu rusak parah! Cari mobil lain.', 4);
            }
            return events;
          }
        }
      }
    }
    return events;
  }

  /** The VIP passenger job, a second side job beside the taxi: a named client
   * waits at the airport or the stadium, pays a base fare plus per-metre, and
   * tips extra when the drop-off beats the par time. Quitting the car mid-ride
   * loses the client and the fare. */
  function updatePassenger2(dt, events) {
    if (state.passenger2Cooldown > 0) state.passenger2Cooldown -= dt;
    const inCar = player.inCar !== null;
    if (!state.passenger2 && state.passenger2Cooldown <= 0 && inCar) {
      const spots = [PLACES.airport, PLACES.stadium];
      for (let tries = 0; tries < 8; tries += 1) {
        const spot = pick(random, spots);
        if (distance(player.x, player.y, spot.x, spot.y) > 500) {
          state.passenger2Client = sample(random, PASSENGER.clients, 1)[0];
          state.passenger2 = { x: spot.x, y: spot.y, place: spot.name, phase: 'hail' };
          break;
        }
      }
    }
    const job = state.passenger2;
    if (job && job.phase === 'hail' && inCar && distance(player.x, player.y, job.x, job.y) < PASSENGER.waitRadius) {
      // The destination is drawn from the other VIP spots, weighted toward the
      // clock tower, so a fare never ends where it began.
      const spots = [
        [PLACES.airport, 1], [PLACES.stadium, 1], [PLACES.tower, 2], [PLACES.pier, 1],
      ].filter(([p]) => p.name !== job.place);
      const drop = weightedPick(random, spots);
      job.phase = 'ride';
      job.dropoff = { x: drop.x, y: drop.y, place: drop.name };
      job.fare = PASSENGER.baseFare;
      job.startedAt = state.elapsed;
      toast(`${state.passenger2Client} naik! Antar ke ${drop.name} — cepat, ada tip.`, 3);
      return events | EVENT_PASSENGER;
    }
    if (job && job.phase === 'ride') {
      if (!inCar) {
        state.passenger2 = null;
        state.passenger2Cooldown = PASSENGER.cooldown;
        toast(`${state.passenger2Client} turun — tarif VIP hangus.`, 3);
        return events;
      }
      job.fare += Math.abs(state.speed) * dt * PASSENGER.perMetre;
      if (distance(player.x, player.y, job.dropoff.x, job.dropoff.y) < PASSENGER.dropoffRadius) {
        const rideSeconds = state.elapsed - job.startedAt;
        const tip = Math.max(0, Math.round((PASSENGER.parTime - rideSeconds) * PASSENGER.tipPerSecond));
        const paid = Math.round(job.fare) + tip;
        state.cash += paid;
        state.stats.faresDone += 1;
        state.stats.cashEarned += paid;
        toast(`VIP dibayar! +$${paid}${tip > 0 ? ` (termasuk tip $${tip})` : ''}`, 4);
        state.passenger2 = null;
        state.passenger2Cooldown = PASSENGER.cooldown;
        return events | EVENT_PASSENGER;
      }
    }
    return events;
  }

  function updateWanted(dt) {
    if (state.wanted === 0) return;
    const policeNear = cars.some((c) => c.kind === 'police' && distance(c.x, c.y, player.x, player.y) < WANTED.decayClearRadius)
      || officers.some((o) => o.downTimer === 0 && distance(o.x, o.y, player.x, player.y) < WANTED.decayClearRadius);
    if (!policeNear) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        toast('Wanted turun — polisi kehilangan jejakmu.', 3);
      }
    } else {
      state.wantedTimer = 0;
    }
  }

  /** How dark the night is at a time of day: 0 in daylight, ramping up through dusk
   * to 1 at full night, then fading back out at dawn. */
  function nightFactorAt(tod) {
    if (tod >= DAY.nightStart) return 1;
    if (tod >= DAY.duskStart) return (tod - DAY.duskStart) / (DAY.nightStart - DAY.duskStart);
    if (tod <= DAY.dawnEnd) return 1 - tod / DAY.dawnEnd;
    return 0;
  }

  function updateTime(dt) {
    state.timeOfDay = (state.timeOfDay + dt / DAY.dayLength) % 1;
    state.nightFactor = nightFactorAt(state.timeOfDay);
  }

  /** The taxi side job. A passenger waits at a random place once the player is
   * driving; pull up close to pick them up, then the fare meter runs with the
   * distance driven until the drop-off. Quitting the car mid-fare loses them. */
  function updateTaxi(dt, events) {
    if (state.taxiCooldown > 0) state.taxiCooldown -= dt;
    const inCar = player.inCar !== null;
    if (!state.taxiActive && !state.taxiHail && state.taxiCooldown <= 0 && inCar) {
      // A new hail: a waiting passenger at a random place, never right on top of the player.
      const spots = [PLACES.park, PLACES.cafe, PLACES.tower, PLACES.market, PLACES.terminal, PLACES.kiosk];
      for (let tries = 0; tries < 8; tries += 1) {
        const spot = pick(random, spots);
        if (distance(player.x, player.y, spot.x, spot.y) > 500) {
          state.taxiHail = { x: spot.x, y: spot.y, place: spot.name };
          break;
        }
      }
    }
    if (state.taxiHail && inCar && distance(player.x, player.y, state.taxiHail.x, state.taxiHail.y) < TAXI.waitRadius) {
      // Picked up: choose a different place as the destination and start the meter.
      // The destination is drawn from every place except the one the passenger
      // boarded at, so a fare never ends where it began.
      const spots = [PLACES.park, PLACES.cafe, PLACES.tower, PLACES.market, PLACES.terminal, PLACES.kiosk, PLACES.pier]
        .filter((p) => p.name !== state.taxiHail.place);
      const drop = pick(random, spots);
      state.taxiDropoff = { x: drop.x, y: drop.y, place: drop.name };
      state.taxiFare = TAXI.baseFare;
      state.taxiActive = true;
      state.taxiHail = null;
      toast(`Penumpang naik! Antar ke ${drop.name}.`, 3);
      return events | EVENT_TAXI;
    }
    if (state.taxiActive) {
      if (!inCar) {
        // Stepped out mid-fare: the passenger leaves and the fare is lost.
        state.taxiActive = false;
        state.taxiDropoff = null;
        state.taxiFare = 0;
        state.taxiCooldown = TAXI.cooldownAfterQuit;
        toast('Penumpang turun — argo hangus.', 3);
        return events;
      }
      // The meter ticks with the distance driven.
      state.taxiFare += Math.abs(state.speed) * dt * TAXI.farePerMetre;
      const drop = state.taxiDropoff;
      if (drop && distance(player.x, player.y, drop.x, drop.y) < TAXI.dropoffRadius) {
        const paid = Math.round(state.taxiFare);
        state.cash += paid;
        state.stats.faresDone += 1;
        state.stats.cashEarned += paid;
        toast(`Argo dibayar! +$${paid}`, 4);
        state.taxiActive = false;
        state.taxiDropoff = null;
        state.taxiFare = 0;
        state.taxiCooldown = TAXI.cooldownAfterFare;
        return events | EVENT_TAXI;
      }
    }
    return events;
  }

  function updateTrafficDensity() {
    const near = cars.filter((c) => c.kind === 'traffic' && distance(c.x, c.y, player.x, player.y) < 1400).length;
    if (near < 8 && random() < 0.05) spawnTrafficCar(player.x, player.y);
    if (peds.length < PEDS.count && random() < 0.03) spawnPed();
    const parked = cars.filter((c) => c.kind === 'parked').length;
    if (parked < 5 && random() < 0.02) spawnParkedCar();
  }

  function updateCamera(dt) {
    const tx = clamp(player.x - 640, 0, WORLD.width - 1280);
    const ty = clamp(player.y - 360, 0, WORLD.height - 720);
    camera.x += (tx - camera.x) * Math.min(1, dt * 5);
    camera.y += (ty - camera.y) * Math.min(1, dt * 5);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function reset() {
    player.x = PLACES.garage.x;
    player.y = PLACES.garage.y + 90;
    player.angle = -Math.PI / 2;
    player.hp = PLAYER.hp;
    player.inCar = null;
    player.punchCooldown = 0;
    player.invulnerable = 0;
    cars.length = 0;
    peds.length = 0;
    officers.length = 0;
    particles.length = 0;
    state.cash = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustHold = 0;
    state.missionIndex = 0;
    state.missionTimer = 0;
    state.elapsed = 0;
    state.dusk = false;
    state.storyDone = false;
    state.toast = '';
    state.toastTimer = 0;
    state.speed = 0;
    state.passenger = false;
    state.nitro = 1;
    state.nitroCooldown = 0;
    state.nitroActive = false;
    state.dashCooldown = 0;
    state.dashTimer = 0;
    state.dashDir = { x: 0, y: 0 };
    state.timeOfDay = 0.3;
    state.nightFactor = 0;
    state.taxiActive = false;
    state.taxiFare = 0;
    state.taxiDropoff = null;
    state.taxiCooldown = TAXI.firstHailDelay;
    state.taxiHail = null;
    state.fuel = 1;
    state.fuelWarned = false;
    state.fuelEmptyToasted = false;
    state.headlights = false;
    state.roadblocks.length = 0;
    state.roadblockCooldown = 0;
    state.roadblockHitCooldown = 0;
    state.passenger2 = null;
    state.passenger2Cooldown = PASSENGER.firstDelay;
    state.passenger2Client = null;
    state.passenger2StartedAt = 0;
    state.stats = { carsStolen: 0, timesBusted: 0, faresDone: 0, missionsDone: 0, cashEarned: 0 };
    state.lastMission = null;
    state.summaryTimer = 0;
    state.missionStartElapsed = 0;
    state.raceCheckpoint = 0;
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar(PLACES.garage.x, PLACES.garage.y);
    for (let i = 0; i < 6; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    // The player's own starter car, parked on the avenue by the garage — on the road,
    // facing north, clear of the garage wall so it can drive away at once.
    const starter = makeCar(900, 640, -Math.PI / 2, 'parked', '#2ec4b6');
    starter.owned = true;
    camera.x = clamp(player.x - 640, 0, WORLD.width - 1280);
    camera.y = clamp(player.y - 360, 0, WORLD.height - 720);
    applyMissionStart();
  }

  /**
   * One fixed step. `move` is {x, y, sprint}; `actions` is the ACTION_* flags taken this
   * frame. `audio` may be null (screenshot staging). Returns EVENT_* flags.
   */
  function step(dt, move, actions, audio) {
    let events = 0;
    state.elapsed += dt;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.summaryTimer > 0) state.summaryTimer -= dt;
    if (player.hp < PLAYER.hp && state.wanted === 0) player.hp = Math.min(PLAYER.hp, player.hp + 3 * dt);

    if (actions & ACTION_ENTER) {
      if (player.inCar !== null) exitCar();
      else events = enterCar(events);
    }
    if (actions & ACTION_PUNCH) events = punch(events);
    if (actions & ACTION_REPAIR) events = repairCar(events);
    if (actions & ACTION_LIGHTS) events = toggleHeadlights(events);
    if ((actions & ACTION_DASH) && player.inCar === null && state.dashCooldown <= 0 && state.dashTimer <= 0) {
      // Dash: burst in the direction of movement, or the facing direction if still.
      const len = Math.hypot(move.x, move.y);
      const dx = len > 0 ? move.x / len : Math.cos(player.angle);
      const dy = len > 0 ? move.y / len : Math.sin(player.angle);
      state.dashDir = { x: dx, y: dy };
      state.dashTimer = DASH.duration;
      state.dashCooldown = DASH.cooldown;
      player.angle = Math.atan2(dy, dx);
      for (let i = 0; i < 8; i += 1) {
        addParticle(player.x - dx * 10, player.y - dy * 10,
          -dx * range(random, 40, 120) + range(random, -40, 40), -dy * range(random, 40, 120) + range(random, -40, 40), 0.35, '#4de8e8', 4);
      }
      events |= EVENT_DASH;
    }
    if (actions & ACTION_HONK_LONG && audio) audio.honkLong();
    else if (actions & ACTION_HONK && audio) audio.honk();

    if (player.inCar !== null) updatePlayerCar(dt, move);
    else updatePlayerOnFoot(dt, move);

    updateTraffic(dt);
    updatePeds(dt);
    events = updatePolice(dt, events);
    events = updateMissions(dt, events);
    events = updateTaxi(dt, events);
    events = updateFuel(dt, events);
    events = updateRoadblocks(dt, events);
    events = updatePassenger2(dt, events);
    updateWanted(dt);
    updateTime(dt);
    updateTrafficDensity();
    updateParticles(dt);
    updateCamera(dt);

    // Busted: held by the police, or beaten down.
    if (state.bustHold >= PLAYER.bustTime || player.hp <= 0) {
      state.bustHold = 0;
      return events | EVENT_BUSTED;
    }
    return events;
  }

  function busted() {
    const lost = Math.floor(state.cash * 0.2);
    state.cash -= lost;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustHold = 0;
    state.nitro = 1;
    state.nitroCooldown = 0;
    state.nitroActive = false;
    state.dashCooldown = 0;
    state.dashTimer = 0;
    state.taxiActive = false;
    state.taxiFare = 0;
    state.taxiDropoff = null;
    state.taxiHail = null;
    state.taxiCooldown = TAXI.cooldownAfterQuit;
    state.stats.timesBusted += 1;
    state.roadblocks.length = 0;
    state.passenger2 = null;
    state.passenger2Cooldown = PASSENGER.cooldown;
    player.hp = PLAYER.hp;
    player.inCar = null;
    player.x = PLACES.garage.x;
    player.y = PLACES.garage.y + 90;
    player.angle = -Math.PI / 2;
    for (const car of cars) {
      if (car.kind === 'police') {
        car.kind = 'parked';
        car.ai = null;
        car.speed = 0;
      }
    }
    officers.length = 0;
    toast(`KETANGKAP! Denda $${lost} — kamu bebas lagi.`, 5);
  }

  function saveData() {
    return {
      cash: state.cash,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      x: player.x,
      y: player.y,
      fuel: state.fuel,
      stats: { ...state.stats },
    };
  }

  function loadData(data) {
    if (!data) return;
    state.cash = data.cash || 0;
    state.missionIndex = data.missionIndex || 0;
    state.storyDone = !!data.storyDone;
    if (typeof data.fuel === 'number') state.fuel = Math.max(0, Math.min(1, data.fuel));
    if (data.stats) state.stats = { ...state.stats, ...data.stats };
    if (typeof data.x === 'number' && typeof data.y === 'number') {
      player.x = clamp(data.x, 20, WORLD.width - 20);
      player.y = clamp(data.y, 20, WORLD.height - 20);
    }
    applyMissionStart();
  }

  reset();
  return {
    state, reset, step, busted, saveData, loadData,
    enterCar, exitCar, playerCar, currentMission, currentStep, applyMissionStart,
  };
}
