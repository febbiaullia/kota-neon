// Drawing only: the world's state and the current screen in, pixels out. The camera shows a
// 1280x720 window of the 3600x2600 city, scaled to fit the browser window. Canvas shapes and
// text only: every building, car, palm tree and neon sign is drawn in code.
import { BEACH, CAR, DASH, FONT, PALETTE, PLACES, PLAYER, ROADS, VIEW, WORLD } from './config.js';
import { ROAD_HALF, onRoad, streetLampPositions } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_STORY = 'story';

const MAP = { x: VIEW.width - 216, y: 16, w: 200, h: 145 };

function roundedRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(`p${size}`)) fonts.set(`p${size}`, `${size}px ${FONT}`);
    context.font = fonts.get(`p${size}`);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    const cam = state.camera;
    const x0 = Math.max(0, cam.x - 40);
    const y0 = Math.max(0, cam.y - 40);
    const x1 = Math.min(WORLD.width, cam.x + VIEW.width + 40);
    const y1 = Math.min(WORLD.height, cam.y + VIEW.height + 40);
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Sand and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0, Math.max(y0, BEACH.sandTop), x1 - x0, Math.max(0, Math.min(y1, BEACH.seaTop) - Math.max(y0, BEACH.sandTop)));
    context.fillStyle = PALETTE.sea;
    context.fillRect(x0, Math.max(y0, BEACH.seaTop), x1 - x0, Math.max(0, y1 - Math.max(y0, BEACH.seaTop)));
    // Wave lines on the sea.
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 3;
    for (let y = BEACH.seaTop + 40; y < y1; y += 70) {
      context.beginPath();
      for (let x = x0; x <= x1; x += 90) {
        const wave = Math.sin((x + state.elapsed * 30) * 0.02) * 6;
        if (x === x0) context.moveTo(x, y + wave);
        else context.lineTo(x, y + wave);
      }
      context.stroke();
    }
    // Roads: asphalt with sidewalk edges and dashed centre lines.
    for (const avenue of ROADS.avenues) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(avenue - ROAD_HALF - 10, y0, ROADS.width + 20, y1 - y0);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(avenue - ROAD_HALF, y0, ROADS.width, y1 - y0);
      context.strokeStyle = PALETTE.lane;
      context.lineWidth = 4;
      context.setLineDash([26, 30]);
      context.beginPath();
      context.moveTo(avenue, y0);
      context.lineTo(avenue, y1);
      context.stroke();
      context.setLineDash([]);
    }
    for (const street of ROADS.streets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x0, street - ROAD_HALF - 10, x1 - x0, ROADS.width + 20);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(x0, street - ROAD_HALF, x1 - x0, ROADS.width);
      context.strokeStyle = PALETTE.lane;
      context.lineWidth = 4;
      context.setLineDash([26, 30]);
      context.beginPath();
      context.moveTo(x0, street);
      context.lineTo(x1, street);
      context.stroke();
      context.setLineDash([]);
    }
    // Park and plaza grass.
    context.fillStyle = PALETTE.park;
    context.fillRect(970, 870, 460, 360);
    context.fillStyle = '#c9b896';
    context.fillRect(1570, 1370, 460, 360);
    // The pier.
    context.fillStyle = '#8a6a44';
    context.fillRect(PLACES.pier.x - 30, BEACH.sandTop, 60, 2580 - BEACH.sandTop);
    context.fillStyle = '#a87f52';
    for (let y = BEACH.sandTop + 20; y < 2560; y += 44) {
      context.fillRect(PLACES.pier.x - 30, y, 60, 6);
    }
  }

  function drawCity(state) {
    const city = state.city;
    // Trees (park, plaza, palms).
    for (const tree of city.trees) {
      context.fillStyle = tree.palm ? '#6b4a2a' : '#4a3520';
      context.fillRect(tree.x - 3, tree.y - 4, 6, 12);
      context.fillStyle = tree.palm ? PALETTE.treeLight : PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y - 10, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(tree.x - tree.r * 0.3, tree.y - 10 - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2);
      context.fill();
    }
    // Buildings: shadow, walls, roof edge, windows, and the garage's neon sign.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, 12);
      context.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 40));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c + r) % 3 === 0) continue;
          context.fillRect(b.x + 10 + c * 34, b.y + 22 + r * 40, 16, 20);
        }
      }
      if (b.landmark === 'garage') {
        context.fillStyle = PALETTE.neonPink;
        roundedRect(context, b.x + 20, b.y - 26, 200, 30, 6);
        context.fill();
        text('BENGKEL SARI', b.x + 120, b.y - 4, 18, '#fff', 'center');
      }
    }
    // The clock tower on the plaza.
    context.fillStyle = '#e8dcc0';
    context.fillRect(PLACES.tower.x - 26, PLACES.tower.y - 90, 52, 130);
    context.fillStyle = '#b33a2e';
    context.beginPath();
    context.moveTo(PLACES.tower.x - 32, PLACES.tower.y - 90);
    context.lineTo(PLACES.tower.x, PLACES.tower.y - 122);
    context.lineTo(PLACES.tower.x + 32, PLACES.tower.y - 90);
    context.closePath();
    context.fill();
    context.fillStyle = '#fff8e0';
    context.beginPath();
    context.arc(PLACES.tower.x, PLACES.tower.y - 58, 20, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#222';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(PLACES.tower.x, PLACES.tower.y - 58);
    context.lineTo(PLACES.tower.x + 10, PLACES.tower.y - 66);
    context.moveTo(PLACES.tower.x, PLACES.tower.y - 58);
    context.lineTo(PLACES.tower.x, PLACES.tower.y - 72);
    context.stroke();
    // Place labels.
    textPlain('Taman Neon', 1200, 1050, 20, 'rgba(255,255,255,0.75)', 'center');
    textPlain('Pantai Senja', 900, 2400, 22, 'rgba(120,70,20,0.8)', 'center');
    textPlain('Dermaga Senja', PLACES.pier.x, 2345, 18, 'rgba(255,255,255,0.85)', 'center');
  }

  function drawCarShape(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.wrecked) context.globalAlpha = 0.85;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    roundedRect(context, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 8);
    context.fill();
    // Wheels.
    context.fillStyle = '#151515';
    context.fillRect(-22, -CAR.width / 2 - 3, 16, 7);
    context.fillRect(8, -CAR.width / 2 - 3, 16, 7);
    context.fillRect(-22, CAR.width / 2 - 4, 16, 7);
    context.fillRect(8, CAR.width / 2 - 4, 16, 7);
    // Body.
    context.fillStyle = car.color;
    roundedRect(context, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    context.fill();
    // Cabin + windshield.
    context.fillStyle = 'rgba(20,30,44,0.85)';
    roundedRect(context, -8, -CAR.width / 2 + 5, 22, CAR.width - 10, 5);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.7)';
    context.fillRect(12, -CAR.width / 2 + 7, 5, CAR.width - 14);
    // Headlights.
    context.fillStyle = '#fff6b0';
    context.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 4, 4, 6);
    context.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 10, 4, 6);
    // Police livery.
    if (car.kind === 'police') {
      context.fillStyle = '#fff';
      context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 2, CAR.length - 12, 6);
      context.fillStyle = '#e5534b';
      context.fillRect(-6, -CAR.width / 2 - 6, 12, 6);
      context.fillStyle = '#3d7bd9';
      context.fillRect(8, -CAR.width / 2 - 6, 12, 6);
    }
    if (car.missionCar) {
      context.fillStyle = PALETTE.gold;
      context.fillRect(-CAR.length / 2 + 10, CAR.width / 2 - 8, 18, 5);
    }
    context.restore();
  }

  function drawCars(state) {
    for (const car of state.cars) {
      if (car.vehicle === 'bike') drawBikeShape(car);
      else drawCarShape(car);
    }
  }

  /** A motorcycle: a slim body, a rider leaning over it, two wheels, one headlight.
   * Smaller and quicker-looking than any car, and much easier to spot in traffic. */
  function drawBikeShape(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.wrecked) context.globalAlpha = 0.85;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    roundedRect(context, -20 + 4, -6 + 5, 40, 12, 6);
    context.fill();
    // Wheels.
    context.fillStyle = '#151515';
    context.beginPath();
    context.arc(-15, 0, 7, 0, Math.PI * 2);
    context.arc(15, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#888';
    context.beginPath();
    context.arc(-15, 0, 3, 0, Math.PI * 2);
    context.arc(15, 0, 3, 0, Math.PI * 2);
    context.fill();
    // Frame and tank.
    context.fillStyle = car.color;
    roundedRect(context, -20, -6, 40, 12, 6);
    context.fill();
    context.fillStyle = 'rgba(20,30,44,0.85)';
    roundedRect(context, -4, -5, 12, 10, 4);
    context.fill();
    // Headlight.
    context.fillStyle = '#fff6b0';
    context.fillRect(18, -3, 4, 6);
    // The rider: a leaning body and a helmet in the bike's own colour.
    context.fillStyle = '#2ec4b6';
    context.beginPath();
    context.arc(-2, -8, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = car.color;
    context.beginPath();
    context.arc(6, -10, 5, 0, Math.PI * 2);
    context.fill();
    if (car.missionCar) {
      context.fillStyle = PALETTE.gold;
      context.fillRect(-14, 4, 14, 4);
    }
    context.restore();
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        context.fillStyle = ped.color;
        context.beginPath();
        context.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath();
      context.ellipse(ped.x, ped.y + 10, 10, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(ped.x, ped.y - 4, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const officer of state.officers) {
      if (officer.downTimer > 0) {
        context.fillStyle = PALETTE.police;
        context.beginPath();
        context.ellipse(officer.x, officer.y, 14, 8, officer.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = PALETTE.police;
      context.beginPath();
      context.arc(officer.x, officer.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(officer.x, officer.y - 4, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.policeLight;
      context.fillRect(officer.x - 8, officer.y - 2, 16, 4);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar !== null) return;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(player.x, player.y + 12, 12, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(6, 0, 7, -1.1, 1.1);
    context.lineTo(6, 0);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(2, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Dash streaks: cyan motion lines behind the player while dashing.
    if (state.dashTimer > 0) {
      const dx = state.dashDir.x;
      const dy = state.dashDir.y;
      context.strokeStyle = 'rgba(77,232,232,0.85)';
      context.lineWidth = 4;
      for (let i = -1; i <= 1; i += 1) {
        const ox = -dy * i * 12;
        const oy = dx * i * 12;
        context.beginPath();
        context.moveTo(player.x - dx * 26 + ox, player.y - dy * 26 + oy);
        context.lineTo(player.x - dx * 54 + ox, player.y - dy * 54 + oy);
        context.stroke();
      }
    }
    // Punch arc flash.
    if (player.punchCooldown > PLAYER.punchCooldown - 0.12) {
      context.strokeStyle = 'rgba(255,255,255,0.8)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(player.x, player.y, 44, player.angle - 0.9, player.angle + 0.9);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawMarker(state) {
    const marker = state.marker;
    if (!marker) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
    // Beacon column of light.
    const gradient = context.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
    gradient.addColorStop(0, 'rgba(242,201,76,0)');
    gradient.addColorStop(1, 'rgba(242,201,76,0.5)');
    context.fillStyle = gradient;
    context.fillRect(marker.x - 14, marker.y - 260, 28, 260);
    // Pulsing diamond on the ground.
    context.save();
    context.translate(marker.x, marker.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.gold;
    const size = 26 * pulse;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.strokeRect(-size / 2, -size / 2, size, size);
    context.restore();
    // Distance label.
    const d = Math.round(Math.hypot(state.player.x - marker.x, state.player.y - marker.y));
    text(`${d}m`, marker.x, marker.y - 46, 20, '#fff', 'center');
  }

  function drawTaxi(state) {
    // A waiting passenger: a person with a gold taxi sign above their head.
    if (state.taxiHail) {
      const h = state.taxiHail;
      const bob = Math.sin(state.elapsed * 4) * 3;
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath();
      context.ellipse(h.x, h.y + 12, 10, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8b04b';
      context.beginPath();
      context.arc(h.x, h.y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(h.x, h.y - 4, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.gold;
      roundedRect(context, h.x - 22, h.y - 44 + bob, 44, 20, 5);
      context.fill();
      text('TAXI', h.x, h.y - 29 + bob, 13, '#232a3d', 'center');
    }
    // The fare destination: a teal diamond beacon, like the mission marker.
    if (state.taxiActive && state.taxiDropoff) {
      const d = state.taxiDropoff;
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
      const gradient = context.createLinearGradient(d.x, d.y - 200, d.x, d.y);
      gradient.addColorStop(0, 'rgba(77,232,232,0)');
      gradient.addColorStop(1, 'rgba(77,232,232,0.45)');
      context.fillStyle = gradient;
      context.fillRect(d.x - 12, d.y - 200, 24, 200);
      context.save();
      context.translate(d.x, d.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.neonCyan;
      const size = 22 * pulse;
      context.fillRect(-size / 2, -size / 2, size, size);
      context.strokeStyle = '#fff';
      context.lineWidth = 3;
      context.strokeRect(-size / 2, -size / 2, size, size);
      context.restore();
    }
  }

  /** Night: a dark shade over the city, pools of warm light at every street lamp,
   * and a headlight cone in front of the player's vehicle. */
  function drawNight(state) {
    const f = state.nightFactor;
    if (f <= 0) return;
    const cam = state.camera;
    context.fillStyle = `rgba(8,12,28,${(0.45 * f).toFixed(3)})`;
    context.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    // Street lamps at every avenue/street crossing, on the sidewalk corner.
    for (const { x: lx, y: ly } of streetLampPositions()) {
      if (lx < cam.x - 80 || lx > cam.x + VIEW.width + 80 || ly < cam.y - 80 || ly > cam.y + VIEW.height + 80) continue;
      const glow = context.createRadialGradient(lx, ly, 4, lx, ly, 70);
      glow.addColorStop(0, `rgba(255,217,138,${(0.55 * f).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255,217,138,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lx, ly, 70, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a3a3a';
      context.fillRect(lx - 2, ly - 14, 4, 16);
      context.fillStyle = PALETTE.lampGlow;
      context.beginPath();
      context.arc(lx, ly - 14, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Headlights: a cone of light ahead of the player's car or bike.
    const car = state.cars.find((c) => c.id === state.player.inCar);
    if (car && f > 0.25) {
      const reach = car.vehicle === 'bike' ? 220 : 260;
      const spread = 0.42;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      const px = -fy;
      const py = fx;
      context.fillStyle = `rgba(255,246,176,${(0.20 * f).toFixed(3)})`;
      context.beginPath();
      context.moveTo(car.x + fx * 20, car.y + fy * 20);
      context.lineTo(car.x + fx * reach + px * reach * spread, car.y + fy * reach + py * reach * spread);
      context.lineTo(car.x + fx * reach - px * reach * spread, car.y + fy * reach - py * reach * spread);
      context.closePath();
      context.fill();
      context.fillStyle = `rgba(255,246,176,${(0.7 * f).toFixed(3)})`;
      context.beginPath();
      context.arc(car.x + fx * 24, car.y + fy * 24, 7, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawMinimap(state) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.fillStyle = 'rgba(20,26,40,0.85)';
    roundedRect(context, MAP.x - 6, MAP.y - 6, MAP.w + 12, MAP.h + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    roundedRect(context, MAP.x, MAP.y, MAP.w, MAP.h, 4);
    context.clip();
    context.fillStyle = PALETTE.minimap;
    context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    context.fillStyle = PALETTE.sea;
    context.fillRect(MAP.x, MAP.y + BEACH.seaTop * sy, MAP.w, MAP.h - BEACH.seaTop * sy);
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 2;
    for (const avenue of ROADS.avenues) {
      context.beginPath();
      context.moveTo(MAP.x + avenue * sx, MAP.y);
      context.lineTo(MAP.x + avenue * sx, MAP.y + MAP.h);
      context.stroke();
    }
    for (const street of ROADS.streets) {
      context.beginPath();
      context.moveTo(MAP.x, MAP.y + street * sy);
      context.lineTo(MAP.x + MAP.w, MAP.y + street * sy);
      context.stroke();
    }
    if (state.marker) {
      context.fillStyle = PALETTE.gold;
      context.save();
      context.translate(MAP.x + state.marker.x * sx, MAP.y + state.marker.y * sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') {
        context.fillStyle = '#ff5b4d';
        context.beginPath();
        context.arc(MAP.x + car.x * sx, MAP.y + car.y * sy, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(MAP.x + state.player.x * sx, MAP.y + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
    context.fillStyle = 'rgba(20,26,40,0.8)';
    roundedRect(context, MAP.x + MAP.w / 2 - 52, MAP.y + MAP.h + 8, 104, 20, 8);
    context.fill();
    text('KOTA NEON', MAP.x + MAP.w / 2, MAP.y + MAP.h + 23, 13, PALETTE.muted, 'center');
  }

  function drawHud(state) {
    // Top-left: cash, wanted stars, health.
    context.fillStyle = 'rgba(20,26,40,0.8)';
    roundedRect(context, 16, 14, 300, 96, 10);
    context.fill();
    text(`$${state.cash}`, 32, 48, 30, PALETTE.gold, 'left');
    for (let i = 0; i < 5; i += 1) {
      text('★', 32 + i * 30, 84, 26, i < state.wanted ? '#ffcf3f' : 'rgba(255,255,255,0.22)', 'left');
    }
    // Health bar.
    context.fillStyle = 'rgba(255,255,255,0.18)';
    roundedRect(context, 196, 66, 104, 14, 7);
    context.fill();
    context.fillStyle = state.player.hp > 30 ? '#58d68d' : '#e5534b';
    roundedRect(context, 196, 66, 104 * Math.max(0, state.player.hp / 100), 14, 7);
    context.fill();
    // Speed when driving.
    if (state.player.inCar !== null) {
      const kmh = Math.round(state.speed * 0.32);
      context.fillStyle = 'rgba(20,26,40,0.8)';
      roundedRect(context, VIEW.width - 150, VIEW.height - 76, 134, 60, 10);
      context.fill();
      text(`${kmh}`, VIEW.width - 82, VIEW.height - 36, 30, '#fff', 'center');
      text('km/jam', VIEW.width - 82, VIEW.height - 20, 13, PALETTE.muted, 'center');
      // Nitro meter above the speedometer (Shift while driving).
      const nbX = VIEW.width - 150;
      const nbY = VIEW.height - 100;
      text('NITRO', nbX + 67, nbY - 4, 12, state.nitroActive ? PALETTE.neonAmber : PALETTE.muted, 'center');
      context.fillStyle = 'rgba(20,26,40,0.8)';
      roundedRect(context, nbX - 4, nbY + 2, 142, 16, 8);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      roundedRect(context, nbX, nbY + 6, 134, 8, 4);
      context.fill();
      const nfrac = Math.max(0, Math.min(1, state.nitro));
      context.fillStyle = state.nitroCooldown > 0 ? '#e5534b' : (state.nitroActive ? PALETTE.neonAmber : PALETTE.neonCyan);
      if (nfrac > 0) {
        roundedRect(context, nbX, nbY + 6, 134 * nfrac, 8, 4);
        context.fill();
      }
    } else {
      // Dash readiness on foot (F): cyan when ready, grey while cooling down.
      const ready = state.dashCooldown <= 0;
      context.fillStyle = 'rgba(20,26,40,0.8)';
      roundedRect(context, 16, VIEW.height - 44, 110, 28, 8);
      context.fill();
      context.fillStyle = ready ? PALETTE.neonCyan : 'rgba(255,255,255,0.25)';
      const dfill = ready ? 1 : Math.max(0, 1 - state.dashCooldown / DASH.cooldown);
      roundedRect(context, 22, VIEW.height - 36, 98 * dfill, 12, 6);
      context.fill();
      text('F: DASH', 71, VIEW.height - 24, 12, '#fff', 'center');
    }
    // Taxi fare meter, top centre: the running fare and the destination.
    if (state.taxiActive && state.taxiDropoff) {
      const label = `TARIF $${Math.round(state.taxiFare)}  →  ${state.taxiDropoff.place}`;
      context.fillStyle = 'rgba(20,26,40,0.85)';
      const w = Math.min(520, 40 + label.length * 9);
      roundedRect(context, (VIEW.width - w) / 2, 14, w, 36, 10);
      context.fill();
      text(label, VIEW.width / 2, 39, 19, PALETTE.neonCyan, 'center');
    }
    // A waiting passenger: a hint so the player knows where the hail is.
    if (state.taxiHail) {
      const hint = `Penumpang menunggu taksi di ${state.taxiHail.place} — dekati dengan mobil.`;
      context.fillStyle = 'rgba(20,26,40,0.85)';
      const w = Math.min(640, 40 + hint.length * 8.5);
      roundedRect(context, (VIEW.width - w) / 2, 14, w, 34, 10);
      context.fill();
      text(hint, VIEW.width / 2, 38, 17, PALETTE.gold, 'center');
    }
    // Mission objective, bottom centre.
    if (state.missionLabel) {
      context.fillStyle = 'rgba(20,26,40,0.8)';
      const w = Math.min(760, 40 + state.missionLabel.length * 9.5);
      roundedRect(context, (VIEW.width - w) / 2, VIEW.height - 52, w, 36, 10);
      context.fill();
      text(state.missionLabel, VIEW.width / 2, VIEW.height - 27, 19, '#fff', 'center');
    }
    // Toast, above the objective.
    if (state.toastTimer > 0) {
      context.fillStyle = 'rgba(242,201,76,0.92)';
      const w = Math.min(820, 40 + state.toast.length * 9);
      roundedRect(context, (VIEW.width - w) / 2, VIEW.height - 100, w, 34, 10);
      context.fill();
      text(state.toast, VIEW.width / 2, VIEW.height - 76, 18, '#232a3d', 'center');
    }
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 720;
    const height = 150 + lines.length * 34 + 66;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(18,22,36,0.92)';
    roundedRect(context, x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.neonCyan;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 76, 52, accent || PALETTE.neonCyan, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      textPlain(lines[i], VIEW.width / 2, y + 128 + i * 34, 21, PALETTE.text, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Kota Neon, kota pesisir yang tak pernah tidur.',
    'Kamu Nara, kurir yang berutang pada Bu Sari.',
    'Antar paketnya, curi mobilnya, kabur dari polisinya —',
    'dan jadilah legenda jalanan Kota Neon.',
    '',
    'WASD / panah: jalan & nyetir   Shift: lari / nitro di mobil   E: masuk mobil',
    'Spasi: pukul   F: dash   H: klakson   P: jeda   M: suara',
  ];

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, best, saveExists) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - state.camera.x * view.scale, view.y - state.camera.y * view.scale);
    drawGround(state);
    drawCity(state);
    drawMarker(state);
    drawTaxi(state);
    drawCars(state);
    drawPeds(state);
    drawPlayer(state);
    drawParticles(state);
    drawNight(state);
    // Dusk tint for the mission scene.
    if (state.dusk) {
      context.fillStyle = 'rgba(255,110,40,0.20)';
      context.fillRect(state.camera.x, state.camera.y, VIEW.width, VIEW.height);
      context.fillStyle = 'rgba(40,20,80,0.14)';
      context.fillRect(state.camera.x, state.camera.y, VIEW.width, VIEW.height);
    }
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      const lines = [...TITLE_LINES];
      lines[4] = saveExists ? `Lanjutkan: $${best} terkumpul, misi tersimpan.` : `Rekor kas terbaik: $${best}`;
      drawPanel('KOTA NEON', lines, saveExists ? 'Spasi / klik: Lanjutkan    N: Baru dari awal' : 'Spasi / klik: Mulai', PALETTE.neonPink);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', ['Kota Neon menunggu. Polisinya juga.', ''], 'P: lanjutkan', PALETTE.neonCyan);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('KETANGKAP!', [`Kasmu sekarang $${state.cash}.`, 'Bu Sari sudah menunggu di bengkel.'], 'Spasi / klik: bebas lagi', PALETTE.red);
    } else if (screen === SCREEN_OVER) {
      drawPanel('Cerita Selesai', [`Kas akhir: $${state.cash}.`, 'Kota Neon milikmu sekarang, Nara.'], 'Spasi / klik: main bebas', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
