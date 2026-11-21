// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between six screens: title, play, paused, busted, story complete and
// game over. Progress (cash and missions) is saved to localStorage, so the player can
// continue another day.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, BIKE, CAR, NITRO, PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom, seedFromString } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_DASH, EVENT_FAIL, EVENT_FUEL, EVENT_HIT, EVENT_MISSION, EVENT_PASSENGER, EVENT_PICKUP, EVENT_PUNCH, EVENT_REPAIR, EVENT_ROADBLOCK, EVENT_STEAL, EVENT_STORY, EVENT_TAXI } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
// A named seed (?seed=kota-neon) always builds the same city, so a scene can be
// shared by name instead of by number; a numeric seed still works as before.
const seed = Number.isInteger(seedParam)
  ? seedParam
  : (params.get('seed') ? seedFromString(params.get('seed')) : Math.floor(Math.random() * 4294967296));

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** The save in memory, kept in step with localStorage by writeSave(). Module scope:
 * the busted and story screens restart from it, so it must never go stale. */
let save = null;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  // Keep the in-memory save in step with localStorage: the busted screen restarts
  // from `save`, so a stale copy would silently undo the fine and the respawn.
  save = world.saveData();
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let titlePan = 0;

  // A hook for automated playtests: the world state and the screen, read-only.
  window.__kotaNeon = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
    get stats() {
      return world.state.stats;
    },
    get fuel() {
      return world.state.fuel;
    },
    get roadblocks() {
      return world.state.roadblocks;
    },
    get passenger2() {
      return world.state.passenger2;
    },
    version: 'kota-neon/1',
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // ignore
      }
      world.reset();
      save = null;
    } else if (save) {
      world.reset();
      world.loadData(save);
    } else {
      world.reset();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Bermain. Ikuti penanda kuning untuk misi pertama.');
  }

  function endBusted() {
    world.busted();
    writeSave();
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    screen = SCREEN_BUSTED;
    audio.busted();
    announce(`Ketangkap! Kas sekarang $${world.state.cash}.`);
  }

  function endStory() {
    writeSave();
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    screen = SCREEN_OVER;
    audio.jingle();
    announce(`Cerita selesai! Kas akhir $${world.state.cash}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_BUSTED) {
      endBusted();
      return;
    }
    if (events & EVENT_STORY) {
      endStory();
      return;
    }
    if (events & EVENT_MISSION) {
      audio.jingle();
      writeSave();
      if (world.state.cash > best) {
        best = world.state.cash;
        saveBest(best);
      }
      // Read the summary aloud too, so the player hears what the banner shows.
      const done = world.state.lastMission;
      if (done) {
        announce(`Misi selesai: ${done.title} +$${done.reward}${done.bonus > 0 ? ` + bonus $${done.bonus}` : ''} dalam ${done.seconds} detik.`);
      }
    } else if (events & EVENT_PICKUP) audio.blip();
    if (events & EVENT_CRASH) audio.crash(200);
    if (events & EVENT_HIT) announce(`Kamu kena! HP ${Math.max(0, Math.round(world.state.player.hp))}.`);
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_TAXI) audio.taxi();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_FUEL) audio.fuelWarn();
    if (events & EVENT_REPAIR) audio.repair();
    if (events & EVENT_PASSENGER) audio.passenger();
    if (events & EVENT_ROADBLOCK) audio.roadblockSiren();
    if (events & EVENT_FAIL) announce('Misi gagal — coba lagi dari bengkel.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (screen === SCREEN_TITLE) {
      // Space is punch in play, but on the title it is the documented start key.
      if (actions & (ACTION_CONFIRM | ACTION_PUNCH)) startGame(false);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Jeda.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Bermain.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_PUNCH)) {
        if (screen === SCREEN_OVER) {
          screen = SCREEN_PLAY;
          announce('Main bebas di Kota Neon.');
        } else {
          startGame(false);
        }
      }
    }
    return actions;
  }

  function stepWorld(dt, move, actions) {
    const wasNitro = world.state.nitroActive;
    const wasFuel = world.state.fuel;
    const events = world.step(dt, move, actions, audio);
    handleEvents(events);
    // A whoosh the first frame the nitro catches, not every frame it burns.
    if (world.state.nitroActive && !wasNitro) audio.nitro();
    // The first frame the tank runs dry, say it out loud — the driver may have
    // missed the flashing gauge while outrunning the police.
    if (wasFuel > 0 && world.state.fuel <= 0) announce('Bensin habis! Mobil mogok — curi mobil lain.');
    // The engine note follows the vehicle the player is actually in: a bike's top
    // speed is higher than a car's, so its engine should climb higher too.
    const playerVehicle = world.playerCar();
    const vehicleTop = playerVehicle && playerVehicle.vehicle === 'bike' ? BIKE.maxSpeed : CAR.maxSpeed;
    audio.engine(world.state.speed, world.state.nitroActive ? vehicleTop * NITRO.boost : vehicleTop);
    audio.siren(dt, world.state.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sprint: false }, 0, null);
        accumulator -= STEP;
      }
      // The title screen pans slowly across the city behind the panel; the world's
      // camera follow is overridden here, after the steps ran.
      titlePan += 0.016;
      const cam = world.state.camera;
      cam.x = 900 + Math.sin(titlePan * 0.4) * 500;
      cam.y = 500 + Math.cos(titlePan * 0.3) * 200;
    } else if (screen === SCREEN_PLAY) {
      // One-shot actions (enter a car, punch) are consumed by the first step only,
      // so a single press is never counted twice in one frame.
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld(STEP, input.move(), first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
      if (screen !== SCREEN_PLAY) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, save !== null);
  }

  // 'N' on the title screen starts fresh instead of continuing a save.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyN') startGame(true);
  });

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Kota Neon. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
