[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/febbiaullia/kota-neon/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/febbiaullia/kota-neon/reward.svg)](https://make.fun/bounty/gta6-01)

# Kota Neon

An original 2D top-down open-world crime game built for the make.fun bounty **gta6-01**
("Make GTA 6"). You are Nara, a courier in debt to Bu Sari, the garage owner of Kota
Neon — a sun-soaked coastal city that never sleeps. Take her jobs, steal cars, outrun
the police, and become a street legend.

## How to play

Open `game/index.html` in a desktop browser — the game runs fully offline, no network
needed.

- **Move / drive:** WASD or arrow keys
- **Sprint:** Shift (on foot)
- **Nitro:** hold Shift while driving — a boost with exhaust flames, on a meter that refills while idle
- **Dash:** F on foot — a quick burst in the direction you move or face, with a short cooldown
- **Enter / exit car or bike:** E (entering a vehicle that is not yours steals it — and raises your wanted level)
- **Punch:** Space
- **Honk:** H · **Pause:** P · **Mute:** M
- **Start / continue / restart:** Space or click · **New game:** N on the title screen

## What's inside

- A living city: avenues and streets, traffic, pedestrians, a park, a clock-tower
  plaza, a beach and a pier — all drawn in code, all original.
- **On foot and by car:** walk the sidewalks or drive anything you can get into.
- **Wanted level:** steal a car or hit a pedestrian and the police come after you —
  patrol cars chase, officers run you down, and getting caught costs you 20% of your cash.
- **Ten missions and a story:** deliveries, a getaway, a passenger run, a stolen
  sports car, a morning market run, a race to the last bus, a stolen red motorcycle,
  and one final run against the whole city. Finish them all to complete the story.
- **Combat:** punch on foot, ram with your car. Police cars can be wrecked.
- **HUD with a minimap:** cash, wanted stars, health, speed, mission objective, and a
  live map of the city with police and mission markers.
- **Save:** cash and mission progress are kept in localStorage — continue any day.
- **Sound:** engine hum, police sirens, crashes and jingles, all synthesised with
  WebAudio. No audio files.

## New in this version

- **Nitro (Shift while driving):** a speed boost with exhaust flames, a meter that
  drains while it burns and refills while idle, and a short lockout when it runs dry.
  The nitro bar sits above the speedometer.
- **Dash (F on foot):** a quick burst in the direction you move or face, with cyan
  streaks and a two-second cooldown — made for slipping past the police.
- **Day cycle:** the city runs from morning to night on a three-minute clock. Dusk
  fades in, street lamps glow, and your headlights cut through the dark.
- **Motorcycles:** a second drivable vehicle — quicker off the line, faster at the
  top, sharper in the turns, and far more fragile. Parked bikes and bike traffic
  appear all over the city, and one story mission is a stolen red motorcycle.
- **Taxi side job:** drive near a waiting passenger to pick them up, then follow
  the fare meter to their destination. The meter ticks with distance; quitting the
  car mid-fare loses the passenger and the fare.
- **Ten missions** (was five), two new places — Pasar Neon and Terminal Kota — and a
  fifth screenshot scene: a night ride with headlights and nitro.

## Structure

- `game/` — the whole game as static files (canvas, no external assets, no libraries).
  All art is drawn in code, all sound is synthesized with WebAudio.
- `game/src/` — one job per file: `config` (tuning, city constants, missions),
  `city` (city generation), `world` (simulation), `render` (drawing, HUD, minimap),
  `input`, `audio`, `random`, `shots` (deterministic screenshot scenes), `main` (loop
  and screens).
- `screenshots/` — 4 real screenshots of the game (title, dusk drive with nitro and a
  parked motorcycle, police chase, dusk delivery at the pier). A fifth scene, a night
  ride with headlights and nitro, is staged in `shots.json` for the next set.
- `main.ts` — the make.fun hand-in program (Node 22): copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `LICENSE` — MIT.

## Bounty

Entry for https://make.fun/bounty/gta6-01 — $1,666 USDC prize pool, 100 paid places.
Built by an AI agent (Muse) for @febbiaullia.
