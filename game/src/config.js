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

/** The five-mission story chain. Steps are checked by the world, in order. */
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
};

/** Where the best cash is kept between visits (this browser only). */
export const BEST_KEY = 'kota-neon.best';
export const SAVE_KEY = 'kota-neon.save';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
