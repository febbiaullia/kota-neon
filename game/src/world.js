// The simulation of Kota Neon, with no drawing and no browser in it: the player on foot and
// in cars, traffic, pedestrians, police, the wanted level, the five-mission story, combat and
// the city itself. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sound, screens, saves) without the world knowing about them.
import { BEACH, CAR, MISSIONS, PEDS, PLACES, PLAYER, POLICE, ROADS, TRAFFIC, WANTED, WORLD } from './config.js';
import { createCity, hitsBuilding, inSea, nearestRoadPoint, onPier, onRoad, onSand, ROAD_HALF } from './city.js';
import { pick, range } from './random.js';
import { ACTION_ENTER, ACTION_HONK, ACTION_PUNCH } from './input.js';

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

  function makeCar(x, y, angle, kind, color, missionCar = false) {
    const car = {
      id: carId += 1, x, y, angle, speed: 0, color, kind, hp: CAR.hp,
      owned: false, missionCar, wrecked: false, smokeTimer: 0, ai: null, spin: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar(nearX, nearY) {
    const point = nearestRoadPoint(nearX + range(random, -600, 600), nearY + range(random, -600, 600));
    const dir = random() < 0.5 ? 1 : -1;
    const car = makeCar(
      point.axis === 'v' ? point.road + laneOffset('v', dir) : point.x,
      point.axis === 'v' ? point.y : point.road + laneOffset('h', dir),
      point.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      'traffic', pick(random, ['#d94f3d', '#3d7bd9', '#e8c53a', '#7a4fd9', '#e8e8e8', '#3aa655', '#e07a9e', '#2b2b33']),
    );
    car.ai = { axis: point.axis, road: point.road, dir, cruise: TRAFFIC.cruiseSpeed + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter), turnCooldown: 0 };
    return car;
  }

  function spawnParkedCar() {
    const spot = pick(random, city.parking);
    const angle = pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = makeCar(spot.x, spot.y, angle, 'parked', pick(random, ['#d94f3d', '#3d7bd9', '#e8c53a', '#7a4fd9', '#e8e8e8', '#3aa655']));
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
    const step = currentStep();
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (step.time) state.missionTimer = step.time;
    toast(`${mission.title} — ${mission.briefing}`, 5);
  }

  function advanceStep(events) {
    const mission = currentMission();
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      state.cash += mission.reward;
      toast(`Misi selesai! +$${mission.reward}`, 4);
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
    return events | EVENT_PICKUP;
  }

  function failMission() {
    const mission = currentMission();
    if (!mission) return;
    toast(`Misi gagal: ${mission.title} — coba lagi!`, 4);
    state.wanted = 0;
    state.missionStep = 0;
    const step = currentStep();
    state.missionLabel = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (step.time) state.missionTimer = step.time;
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
    const accelMax = onSandNow ? CAR.accel * 0.55 : CAR.accel;
    if (move.y < 0) car.speed += accelMax * dt;
    else if (move.y > 0) {
      if (car.speed > 20) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 160 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steerInput = move.x;
    const steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += steerInput * CAR.steer * steerFactor * Math.sign(car.speed || 1) * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (hitsBuilding(city, nx, ny, CAR.width / 2) || inSea(nx, ny)) {
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
    if (player.hp < PLAYER.hp && state.wanted === 0) player.hp = Math.min(PLAYER.hp, player.hp + 3 * dt);

    if (actions & ACTION_ENTER) {
      if (player.inCar !== null) exitCar();
      else events = enterCar(events);
    }
    if (actions & ACTION_PUNCH) events = punch(events);
    if (actions & ACTION_HONK && audio) audio.honk();

    if (player.inCar !== null) updatePlayerCar(dt, move);
    else updatePlayerOnFoot(dt, move);

    updateTraffic(dt);
    updatePeds(dt);
    events = updatePolice(dt, events);
    events = updateMissions(dt, events);
    updateWanted(dt);
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
    };
  }

  function loadData(data) {
    if (!data) return;
    state.cash = data.cash || 0;
    state.missionIndex = data.missionIndex || 0;
    state.storyDone = !!data.storyDone;
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
