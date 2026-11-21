// Kota Neon — every tuning number, colour and city constant in one place.
// The world is a fixed 3600x2600 city; the camera shows a 1280x720 window of it.

export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The logical window the renderer paints; the camera follows the player inside the world. */
export const VIEW = { width: 1280, height: 720 };

/** Roads: avenue centres (vertical) and street centres (horizontal), each 140 wide. */
export const ROADS = {
  width: 140,
  avenues: [300, 900, 1500, 2100, 2700, 3300],
  streets: [300, 800, 1300, 1800],
};

/** The beach strip and the sea along the south edge of the city. */
export const BEACH = { sandTop: 2300, seaTop: 2470 };

/** Named places the story and the missions use. All original, none from any commercial game. */
export const PLACES = {
  garage: { x: 600, y: 550, name: 'Bengkel Sari' },
  kiosk: { x: 1200, y: 550, name: 'Kios Pelangi' },
  cafe: { x: 2400, y: 1650, name: 'Kafe Senja' },
  park: { x: 1200, y: 1050, name: 'Taman Neon' },
  tower: { x: 1800, y: 1550, name: 'Menara Jam' },
  safehouse: { x: 3000, y: 2050, name: 'Rumah Aman' },
  pier: { x: 1800, y: 2450, name: 'Dermaga Senja' },
  beachParking: { x: 2100, y: 2350, name: 'Parkir Pantai' },
  market: { x: 2700, y: 550, name: 'Pasar Neon' },
  terminal: { x: 300, y: 1800, name: 'Terminal Kota' },
  airport: { x: 3300, y: 300, name: 'Bandara Neon' },
  stadium: { x: 300, y: 300, name: 'Stadion Kota' },
  gasStation: { x: 1500, y: 1800, name: 'SPBU Neon' },
};

/** The player on foot. */
export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 350,
  hp: 100,
  punchRange: 58,
  punchArc: 1.1,
  punchDamage: 12,
  punchCooldown: 0.35,
  bustTime: 1.6,
};

/** Driving: arcade car physics, tuned to feel weighty but forgiving. */
export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  hp: 100,
  enterRadius: 78,
};

/** Nitro: hold Shift while driving for a speed boost. The meter (0..1) drains while
 * active, refills while idle, and locks out briefly when it runs dry. */
export const NITRO = {
  boost: 1.6,
  accelBonus: 500,
  drain: 0.45,
  regen: 0.18,
  emptyCooldown: 2.0,
};

/** Dash: on foot, press F to burst in the direction you are moving (or facing).
 * A short burst with a cooldown, so it is an escape tool, not a sprint. */
export const DASH = {
  speed: 900,
  duration: 0.18,
  cooldown: 2.0,
};

/** The day cycle: timeOfDay runs 0..1 over dayLength seconds. Dusk fades in from
 * duskStart, full night from nightStart, and dawn fades the night out by dawnEnd.
 * Street lamps and headlights only shine once the night factor rises. */
export const DAY = {
  dayLength: 180,
  duskStart: 0.55,
  nightStart: 0.75,
  dawnEnd: 0.08,
};

/** The motorcycle: a second drivable vehicle. Quicker off the line, a higher top
 * speed and sharper steering than any car, but fragile — one hard crash can wreck it,
 * and it carries no more protection than its rider. */
export const BIKE = {
  length: 44,
  width: 16,
  accel: 560,
  brake: 800,
  reverseAccel: 200,
  maxSpeed: 640,
  maxReverse: 120,
  steer: 3.4,
  hp: 60,
  enterRadius: 60,
  trafficChance: 0.2,
  parkedChance: 0.3,
};

/** The taxi side job: drive a car near a waiting passenger to pick them up, then
 * follow the fare meter to their destination. The meter ticks with distance driven;
 * quitting the car mid-fare loses the passenger and the fare. A base fare of $25
 * makes a short hop worth the detour, and a long cross-city run pays like a mission. */
export const TAXI = {
  baseFare: 25,
  farePerMetre: 0.15,
  waitRadius: 90,
  dropoffRadius: 80,
  cooldownAfterFare: 20,
  cooldownAfterQuit: 15,
  firstHailDelay: 8,
};

/** Fuel: the tank (0..1) drains with distance driven, refills at the SPBU for cash.
 * A full tank lasts about three minutes of hard driving; the pump fills a quarter
 * tank a second, so a dry tank costs a few seconds and about $150. */
export const FUEL = {
  drainPerMetre: 0.00002,
  refillRate: 0.25,
  pricePerUnit: 150,
  lowWarn: 0.2,
  refillRadius: 120,
};

/** Repair: press R near Bengkel Sari to fix the car you are driving. The bill is
 * per missing HP with a minimum, so a scratch is cheap and a wreck is not. */
export const REPAIR = {
  pricePerHp: 2,
  minCost: 40,
  radius: 110,
};

/** Police roadblocks: once the wanted level hits 3, the police park across the
 * road ahead of the player and cone it off. Ramming a cone hurts the car. */
export const ROADBLOCK = {
  minWanted: 3,
  maxActive: 3,
  spawnCooldown: 20,
  aheadDistance: 520,
  coneCount: 4,
  hitRadius: 38,
  hitDamage: 6,
  hitCooldown: 1,
};

/** The VIP passenger job (a second side job beside the taxi): a named client waits
 * at the airport or the stadium, pays a base fare plus per-metre, and tips extra
 * when the drop-off beats the par time. */
export const PASSENGER = {
  baseFare: 60,
  perMetre: 0.25,
  tipPerSecond: 2,
  parTime: 60,
  waitRadius: 90,
  dropoffRadius: 80,
  cooldown: 30,
  firstDelay: 20,
  clients: ['Bos Raka', 'Mba Lilis', 'Pak Dedi', 'Nona Sinta'],
};

/** Traffic cars that drive the roads on their own. */
export const TRAFFIC = {
  count: 14,
  cruiseSpeed: 150,
  cruiseJitter: 50,
  spawnClear: 320,
};

/** Pedestrians on the sidewalks. */
export const PEDS = {
  count: 24,
  walkSpeed: 55,
  fleeSpeed: 170,
};

/** Police: how many cars chase at each wanted level, and how fast they are. */
export const POLICE = {
  carHp: 60,
  carSpeed: 520,
  footSpeed: 300,
  punchDamage: 8,
  bustRadius: 42,
  bustHold: 1.6,
  maxCars: 6,
};

/** Wanted level: 0 to 5 stars. */
export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  hitPolice: 1,
  decaySeconds: 25,
  decayClearRadius: 420,
};

/** The twelve-mission story chain. Steps are checked by the world, in order. */
export const MISSIONS = [
  {
    id: 'paket-pertama',
    title: 'Paket Pertama',
    briefing: 'Bu Sari: "Ambil paket di Kios Pelangi, antar ke Kafe Senja. Jangan telat."',
    reward: 150,
    steps: [
      { type: 'goto', x: PLACES.kiosk.x, y: PLACES.kiosk.y, radius: 70, label: 'Ambil paket di Kios Pelangi' },
      { type: 'goto', x: PLACES.cafe.x, y: PLACES.cafe.y, radius: 70, label: 'Antar paket ke Kafe Senja' },
    ],
  },
  {
    id: 'jangan-ketangkap',
    title: 'Jangan Sampai Ketangkap',
    briefing: 'Bu Sari: "Polisi mengendus kita! Kabur ke Rumah Aman, jangan sampai ketangkap."',
    reward: 250,
    wanted: 2,
    steps: [
      { type: 'escape', x: PLACES.safehouse.x, y: PLACES.safehouse.y, radius: 80, time: 75, label: 'Kabur ke Rumah Aman (75 dtk)' },
    ],
  },
  {
    id: 'antar-tamu',
    title: 'Antar Tamu',
    briefing: 'Bu Sari: "Jemput tamu di Taman Neon, antar ke Dermaga Senja. Dia tidak suka menunggu."',
    reward: 300,
    steps: [
      { type: 'goto', x: PLACES.park.x, y: PLACES.park.y, radius: 70, label: 'Jemput tamu di Taman Neon' },
      { type: 'goto', x: PLACES.pier.x, y: PLACES.pier.y, radius: 70, label: 'Antar tamu ke Dermaga Senja' },
    ],
  },
  {
    id: 'mobil-pesanan',
    title: 'Mobil Pesanan',
    briefing: 'Bu Sari: "Ada mobil merah pesanan di Parkir Pantai. Bawa ke bengkel. Jangan ditanya dari mana."',
    reward: 400,
    steps: [
      { type: 'steal', x: PLACES.beachParking.x, y: PLACES.beachParking.y, radius: 90, label: 'Curi mobil merah di Parkir Pantai' },
      { type: 'deliverCar', x: PLACES.garage.x, y: PLACES.garage.y, radius: 110, label: 'Bawa mobilnya ke Bengkel Sari' },
    ],
  },
  {
    id: 'jalur-terakhir',
    title: 'Jalur Terakhir',
    briefing: 'Bu Sari: "Paket terakhir, paling penting. Antar ke Menara Jam. Polisi sudah menunggu — 90 detik."',
    reward: 600,
    wanted: 3,
    steps: [
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 70, label: 'Ambil paket terakhir di bengkel' },
      { type: 'timed', x: PLACES.tower.x, y: PLACES.tower.y, radius: 80, time: 90, label: 'Antar ke Menara Jam (90 dtk)' },
    ],
  },
  {
    id: 'tamu-terakhir',
    title: 'Tamu Terakhir',
    briefing: 'Bu Sari: "Kota ini milikmu sekarang, Nara. Tapi satu tamu terakhir menunggu di Parkir Pantai — antar dia ke Kafe Senja sebelum dia pergi."',
    reward: 500,
    wanted: 2,
    steps: [
      { type: 'goto', x: PLACES.beachParking.x, y: PLACES.beachParking.y, radius: 70, label: 'Jemput tamu di Parkir Pantai' },
      { type: 'timed', x: PLACES.cafe.x, y: PLACES.cafe.y, radius: 80, time: 75, label: 'Antar tamu ke Kafe Senja (75 dtk)' },
    ],
  },
  {
    id: 'pasar-pagi',
    title: 'Pasar Pagi',
    briefing: 'Bu Sari: "Ikan segar dari Pasar Neon harus sampai di Kafe Senja sebelum sarapan. Jangan sampai basi!"',
    reward: 350,
    steps: [
      { type: 'goto', x: PLACES.market.x, y: PLACES.market.y, radius: 70, label: 'Ambil ikan di Pasar Neon' },
      { type: 'goto', x: PLACES.cafe.x, y: PLACES.cafe.y, radius: 70, label: 'Antar ikan ke Kafe Senja' },
    ],
  },
  {
    id: 'terminal-terakhir',
    title: 'Terminal Terakhir',
    briefing: 'Bu Sari: "Bus terakhir berangkat dari Terminal Kota. Paket ini harus naik bus itu — 90 detik, dan polisi sudah mengendus."',
    reward: 450,
    wanted: 2,
    steps: [
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 70, label: 'Ambil paket di bengkel' },
      { type: 'timed', x: PLACES.terminal.x, y: PLACES.terminal.y, radius: 80, time: 90, label: 'Antar ke Terminal Kota (90 dtk)' },
    ],
  },
  {
    id: 'kurir-senja',
    title: 'Kurir Senja',
    briefing: 'Bu Sari: "Ada motor merah pesanan di Terminal Kota — motor, bukan mobil. Bawa ke bengkel sebelum senja. Hati-hati, motor itu lebih cepat dari kelihatannya."',
    reward: 550,
    vehicle: 'bike',
    steps: [
      { type: 'steal', x: PLACES.terminal.x, y: PLACES.terminal.y, radius: 90, label: 'Ambil motor merah di Terminal Kota' },
      { type: 'deliverCar', x: PLACES.garage.x, y: PLACES.garage.y, radius: 110, label: 'Bawa motornya ke Bengkel Sari' },
    ],
  },
  {
    id: 'legenda-neon',
    title: 'Legenda Neon',
    briefing: 'Bu Sari: "Satu paket terakhir, Nara. Dari bengkel ke Menara Jam, 75 detik, dengan seluruh kota mengejarmu. Kalau ini berhasil, namamu jadi legenda."',
    reward: 800,
    wanted: 4,
    steps: [
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 70, label: 'Ambil paket legenda di bengkel' },
      { type: 'timed', x: PLACES.tower.x, y: PLACES.tower.y, radius: 80, time: 75, label: 'Antar ke Menara Jam (75 dtk)' },
    ],
  },
  {
    id: 'balapan-tengah-malam',
    title: 'Balapan Tengah Malam',
    briefing: 'Bu Sari: "Ada yang menantangmu balapan, Nara. Lewati semua checkpoint — Bandara, Stadion, Terminal, Menara — dalam 110 detik. Polisi ikut menonton, jadi jangan berhenti."',
    reward: 650,
    wanted: 2,
    steps: [
      {
        type: 'race', time: 110, label: 'Balapan Tengah Malam (110 dtk)',
        checkpoints: [
          { x: PLACES.airport.x, y: PLACES.airport.y, radius: 80, label: 'Checkpoint 1: Bandara Neon' },
          { x: PLACES.stadium.x, y: PLACES.stadium.y, radius: 80, label: 'Checkpoint 2: Stadion Kota' },
          { x: PLACES.terminal.x, y: PLACES.terminal.y, radius: 80, label: 'Checkpoint 3: Terminal Kota' },
          { x: PLACES.tower.x, y: PLACES.tower.y, radius: 80, label: 'Finis: Menara Jam' },
        ],
      },
    ],
  },
  {
    id: 'pengiriman-terakhir',
    title: 'Pengiriman Terakhir',
    briefing: 'Bu Sari: "Paket VIP mendarat di Bandara Neon. Antar ke Stadion Kota — 120 detik, dan seluruh kota mengawasi. Ini yang terakhir, Nara. Buatlah berarti."',
    reward: 900,
    wanted: 3,
    steps: [
      { type: 'goto', x: PLACES.airport.x, y: PLACES.airport.y, radius: 80, label: 'Ambil paket VIP di Bandara Neon' },
      { type: 'timed', x: PLACES.stadium.x, y: PLACES.stadium.y, radius: 80, time: 120, label: 'Antar ke Stadion Kota (120 dtk)' },
    ],
  },
];

/** Sun-soaked palette: warm sand, teal sea, coral and amber buildings, neon signs. */
export const PALETTE = {
  backdrop: '#1c2438',
  grass: '#7fae62',
  grassDark: '#6d9c54',
  sand: '#e8c98f',
  sea: '#2e8fa3',
  seaDeep: '#227184',
  asphalt: '#3d3f4a',
  asphaltDark: '#33353f',
  lane: '#e8d98a',
  sidewalk: '#b9b3a4',
  building: ['#e07856', '#e8a04c', '#d9c27a', '#7fb3a8', '#c96f6f', '#8fa8c9', '#d98cb0', '#a8b878'],
  roof: ['#a34d33', '#9c6a2e', '#8f7a3e', '#4f7d72', '#8f4a4a', '#5f748f', '#9c5f7e', '#6f8350'],
  park: '#5d8f4e',
  tree: '#3f7a34',
  treeLight: '#5da24a',
  player: '#2ec4b6',
  playerDark: '#1d8a80',
  police: '#2b4acb',
  policeLight: '#5b7ef0',
  ped: ['#e8b04b', '#c96f9e', '#7fb069', '#e07a5f', '#6a8caf', '#d9a05b'],
  car: ['#d94f3d', '#3d7bd9', '#e8c53a', '#7a4fd9', '#e8e8e8', '#3aa655', '#e07a9e', '#2b2b33'],
  text: '#f5efe0',
  muted: '#c9c2ae',
  gold: '#f2c94c',
  red: '#e5534b',
  panel: '#232a3d',
  panelEdge: '#3a4560',
  minimap: '#1a2132',
  neonPink: '#ff5da2',
  neonCyan: '#4de8e8',
  neonAmber: '#ffb347',
  lampGlow: '#ffd98a',
  headlight: '#fff6b0',
  nightShade: '#080c1c',
};

/** Where the best cash is kept between visits (this browser only). */
export const BEST_KEY = 'kota-neon.best';
export const SAVE_KEY = 'kota-neon.save';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
