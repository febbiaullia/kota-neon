// The city of Kota Neon, generated once from a seed: its roads, blocks, buildings, park,
// beach, pier and named places. Everything is deterministic, so the same seed builds the
// same city for every player and every screenshot.
import { BEACH, PALETTE, PLACES, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

/** The road half-width, used by traffic, pedestrians and collision. */
export const ROAD_HALF = ROADS.width / 2;

/** Is the point on a road (avenue or street)? */
export function onRoad(x, y) {
  for (const avenue of ROADS.avenues) {
    if (Math.abs(x - avenue) <= ROAD_HALF) return true;
  }
  for (const street of ROADS.streets) {
    if (Math.abs(y - street) <= ROAD_HALF) return true;
  }
  return false;
}

/** Is the point in the sea (not walkable, not drivable)? */
export function inSea(x, y) {
  return y >= BEACH.seaTop;
}

/** Is the point on the sand (walkable, slow for cars)? */
export function onSand(x, y) {
  return y >= BEACH.sandTop && y < BEACH.seaTop;
}

/** Is the point on the pier (walkable)? */
export function onPier(x, y) {
  return Math.abs(x - PLACES.pier.x) <= 30 && y >= BEACH.sandTop && y <= 2580;
}

/** The nearest point on a road centreline to (x, y), for spawning traffic. */
export function nearestRoadPoint(x, y) {
  let best = { x: ROADS.avenues[0], y, axis: 'v', road: ROADS.avenues[0] };
  let bestDistance = Math.abs(x - ROADS.avenues[0]);
  for (const avenue of ROADS.avenues) {
    const distance = Math.abs(x - avenue);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: avenue, y, axis: 'v', road: avenue };
    }
  }
  for (const street of ROADS.streets) {
    const distance = Math.abs(y - street);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x, y: street, axis: 'h', road: street };
    }
  }
  return best;
}

function blockRanges() {
  const xs = [0, ...ROADS.avenues, WORLD.width];
  const ys = [0, ...ROADS.streets, BEACH.sandTop];
  const ranges = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + (i === 0 ? 0 : ROAD_HALF) + 8;
      const x1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 0 : ROAD_HALF) - 8;
      const y0 = ys[j] + (j === 0 ? 0 : ROAD_HALF) + 8;
      const y1 = ys[j + 1] - (j + 1 === ys.length - 1 ? 0 : ROAD_HALF) - 8;
      if (x1 - x0 > 60 && y1 - y0 > 60) ranges.push({ x0, y0, x1, y1 });
    }
  }
  return ranges;
}

/** The park block and the clock-tower plaza, fixed by their place coordinates. */
function specialBlock(block, random) {
  const park = { x0: 970, y0: 870, x1: 1430, y1: 1230 };
  const plaza = { x0: 1570, y0: 1370, x1: 2030, y1: 1730 };
  const airport = { x0: 3000, y0: 100, x1: 3560, y1: 480 };
  const stadium = { x0: 100, y0: 100, x1: 560, y1: 480 };
  const centreX = (block.x0 + block.x1) / 2;
  const centreY = (block.y0 + block.y1) / 2;
  if (centreX > park.x0 && centreX < park.x1 && centreY > park.y0 && centreY < park.y1) return 'park';
  if (centreX > plaza.x0 && centreX < plaza.x1 && centreY > plaza.y0 && centreY < plaza.y1) return 'plaza';
  if (centreX > airport.x0 && centreX < airport.x1 && centreY > airport.y0 && centreY < airport.y1) return 'airport';
  if (centreX > stadium.x0 && centreX < stadium.x1 && centreY > stadium.y0 && centreY < stadium.y1) return 'stadium';
  if (random() < 0.12) return 'empty';
  return 'buildings';
}

/** The airport district: a runway strip and a terminal slab, fixed so the
 * renderer and the missions can find them without searching the blocks. */
export const AIRPORT = { x: 3300, y: 300, w: 420, h: 220, runway: { x: 3150, y: 250, w: 300, h: 56 } };

/** The stadium district: an oval field with stands, at the north-west corner. */
export const STADIUM = { x: 300, y: 300, rx: 175, ry: 115 };

/** True when the point is on the airport apron (drivable, flat). */
export function inAirport(x, y) {
  return x > AIRPORT.x - AIRPORT.w / 2 && x < AIRPORT.x + AIRPORT.w / 2
    && y > AIRPORT.y - AIRPORT.h / 2 && y < AIRPORT.y + AIRPORT.h / 2;
}

/** True when the point is inside the stadium bowl. */
export function inStadium(x, y) {
  const dx = (x - STADIUM.x) / STADIUM.rx;
  const dy = (y - STADIUM.y) / STADIUM.ry;
  return dx * dx + dy * dy < 1;
}

/** Where the car services are: the SPBU pump and the garage workshop. The world
 * checks these for refuelling and repairs; the renderer draws their signs. */
export function servicePoints() {
  return [
    { type: 'gas', x: PLACES.gasStation.x, y: PLACES.gasStation.y, name: PLACES.gasStation.name },
    { type: 'repair', x: PLACES.garage.x, y: PLACES.garage.y, name: PLACES.garage.name },
  ];
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parking = [];
  const blocks = blockRanges();

  for (const block of blocks) {
    const kind = specialBlock(block, random);
    if (kind === 'park') {
      for (let i = 0; i < 26; i += 1) {
        trees.push({
          x: range(random, block.x0 + 20, block.x1 - 20),
          y: range(random, block.y0 + 20, block.y1 - 20),
          r: range(random, 12, 20),
        });
      }
      continue;
    }
    if (kind === 'plaza') {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        trees.push({ x: 1800 + Math.cos(angle) * 150, y: 1550 + Math.sin(angle) * 110, r: 14 });
      }
      continue;
    }
    if (kind === 'airport') {
      // The runway stays clear of buildings: a few trees at the apron edge only.
      for (let i = 0; i < 6; i += 1) {
        trees.push({ x: range(random, 3100, 3500), y: range(random, 430, 470), r: 12 });
      }
      continue;
    }
    if (kind === 'stadium') {
      // Floodlight poles around the bowl, drawn by the renderer at night.
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        trees.push({ x: 300 + Math.cos(angle) * 200, y: 300 + Math.sin(angle) * 140, r: 10 });
      }
      continue;
    }
    if (kind === 'empty') {
      parking.push({ x: (block.x0 + block.x1) / 2, y: (block.y0 + block.y1) / 2 });
      continue;
    }
    const count = 1 + Math.floor(random() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = range(random, 90, 190);
      const h = range(random, 80, 160);
      const x = range(random, block.x0 + 10, Math.max(block.x0 + 11, block.x1 - w - 10));
      const y = range(random, block.y0 + 10, Math.max(block.y0 + 11, block.y1 - h - 10));
      const color = pick(random, PALETTE.building);
      const roof = pick(random, PALETTE.roof);
      buildings.push({ x, y, w, h, color, roof, floors: 1 + Math.floor(random() * 3) });
    }
  }

  // The garage is a landmark, not a random building: a wide yard with a workshop.
  buildings.push({ x: 480, y: 470, w: 240, h: 150, color: '#c96f4a', roof: '#7a3b26', floors: 1, landmark: 'garage' });
  // A few palm trees along the beach.
  for (let x = 200; x < WORLD.width; x += 260) {
    trees.push({ x: x + range(random, -40, 40), y: range(random, 2330, 2420), r: 16, palm: true });
  }

  // Parking spots along the roads where cars can sit.
  for (const avenue of ROADS.avenues) {
    for (const street of ROADS.streets) {
      parking.push({ x: avenue + ROAD_HALF + 34, y: street - 120 });
      parking.push({ x: avenue - ROAD_HALF - 34, y: street + 120 });
    }
  }
  parking.push({ x: PLACES.beachParking.x - 60, y: PLACES.beachParking.y });
  parking.push({ x: PLACES.beachParking.x + 60, y: PLACES.beachParking.y });
  parking.push({ x: PLACES.beachParking.x, y: PLACES.beachParking.y - 60 });
  // Spots by the new districts and the SPBU, so cars wait where the story goes.
  parking.push({ x: PLACES.airport.x - 240, y: PLACES.airport.y + 60 });
  parking.push({ x: PLACES.airport.x + 240, y: PLACES.airport.y - 60 });
  parking.push({ x: PLACES.stadium.x + 220, y: PLACES.stadium.y });
  parking.push({ x: PLACES.stadium.x - 220, y: PLACES.stadium.y + 60 });
  parking.push({ x: PLACES.gasStation.x + 120, y: PLACES.gasStation.y });
  parking.push({ x: PLACES.gasStation.x - 120, y: PLACES.gasStation.y + 40 });

  return { buildings, trees, parking, airport: AIRPORT, stadium: STADIUM };
}

/** True when the point is on a sidewalk: on a block, but not inside a building. */
export function onSidewalk(city, x, y) {
  return !onRoad(x, y) && !insideBuilding(city, x, y) && !inSea(x, y) && !onSand(x, y);
}

/** The street-lamp positions: one at the sidewalk corner of every avenue/street
 * crossing. They only shine at night, but their places are fixed by the city.
 * The corner alternates by crossing, so the lamps do not all sit on one side. */
export function streetLampPositions() {
  const lamps = [];
  ROADS.avenues.forEach((avenue, ai) => {
    ROADS.streets.forEach((street, si) => {
      const side = (ai + si) % 2 === 0 ? 1 : -1;
      lamps.push({ x: avenue + side * (ROAD_HALF + 16), y: street + ROAD_HALF + 16 });
    });
  });
  return lamps;
}

/** True when the point is inside any building (solid). */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

/** True when a circle of radius r at (x, y) touches any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
