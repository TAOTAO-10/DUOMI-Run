const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

const shell = document.querySelector(".game-shell");
const scoreHud = document.querySelector("#scoreHud");
const bestHud = document.querySelector("#bestHud");
const readyPrompt = document.querySelector("#readyPrompt");
const gameOverPanel = document.querySelector("#gameOverPanel");
const restartBtn = document.querySelector("#restartBtn");
const jumpBtn = document.querySelector("#jumpBtn");
const duckBtn = document.querySelector("#duckBtn");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

const WORLD = {
  height: 420,
  ground: 305,
};

const PALETTES = {
  day: {
    sky: "#a9d8e8",
    cloud: "#f7f4ea",
    cloudShade: "#dce9e5",
    sun: "#f3cf72",
    ink: "#394a46",
    ground: "#d7e2d5",
    groundMark: "#a5b9a6",
    grass: "#4f7658",
    grassLight: "#729578",
    pot: "#b9684e",
    potDark: "#7e493b",
    scratch: "#c58a5b",
    scratchLight: "#e1b37c",
    scratchDark: "#76513f",
    moth: "#e6b85e",
    mothAccent: "#8c6a3d",
    dust: "#71857a",
  },
};

const PLAYER = {
  width: 120,
  runHeight: 82,
  duckHeight: 56,
};

const STORAGE_KEY = "domi-run-best-v2";
const spriteSheet = new Image();
spriteSheet.src = "assets/sprites/domi-steve-sprites-v1.png";
const runCycleSheet = new Image();
runCycleSheet.src = "assets/sprites/domi-run-cycle-v2.png";

const SPRITES = [
  { x: 60, y: 273, w: 288, h: 220 },
  { x: 417, y: 273, w: 306, h: 220 },
  { x: 784, y: 245, w: 293, h: 196 },
  { x: 1090, y: 332, w: 339, h: 158 },
  { x: 1496, y: 320, w: 301, h: 170 },
  { x: 1831, y: 328, w: 291, h: 178 },
];

const RUN_SPRITES = [
  { x: 103, y: 221, w: 360, h: 262 },
  { x: 593, y: 212, w: 438, h: 229, lift: 5 },
  { x: 1678, y: 226, w: 406, h: 278 },
  { x: 1141, y: 243, w: 406, h: 261 },
];

const view = {
  width: window.innerWidth,
  height: window.innerHeight,
  worldWidth: 1200,
  scale: 1,
  offsetY: 0,
  dpr: 1,
};

const game = {
  state: "ready",
  time: 0,
  runTime: 0,
  distance: 0,
  score: 0,
  shownScore: -1,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  speed: 410,
  nextSpawn: 500,
  lastObstacle: "",
  milestone: 0,
  shake: 0,
  obstacles: [],
  clouds: [],
  dust: [],
  player: {
    x: 110,
    y: WORLD.ground,
    vy: 0,
    grounded: true,
    ducking: false,
    downHeld: false,
    jumpHeld: false,
    jumpBuffer: 0,
    coyote: 0,
    landing: 0,
  },
};

let audioContext = null;
let lastFrame = 0;
let resizeFrame = 0;
let wakeLock = null;

function resize() {
  const viewport = window.visualViewport;
  view.width = Math.round(viewport?.width || document.documentElement.clientWidth || window.innerWidth);
  view.height = Math.round(viewport?.height || document.documentElement.clientHeight || window.innerHeight);
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);

  const widthScale = view.width / 1200;
  const mobileScale = Math.min(0.72, view.width / 520);
  view.scale = Math.min(Math.max(widthScale, mobileScale), view.height / 520, 2);
  view.worldWidth = view.width / view.scale;
  view.offsetY = Math.round((view.height - WORLD.height * view.scale) / 2);

  canvas.width = Math.round(view.width * view.dpr);
  canvas.height = Math.round(view.height * view.dpr);
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;

  game.player.x = Math.min(110, Math.max(64, view.worldWidth * 0.105));
}

function resetRun(state = "ready") {
  game.state = state;
  game.runTime = 0;
  game.distance = 0;
  game.score = 0;
  game.shownScore = -1;
  game.speed = 410;
  game.nextSpawn = Math.max(440, view.worldWidth * 0.46);
  game.lastObstacle = "";
  game.milestone = 0;
  game.shake = 0;
  game.obstacles.length = 0;
  game.dust.length = 0;

  const p = game.player;
  p.y = WORLD.ground;
  p.vy = 0;
  p.grounded = true;
  p.ducking = false;
  p.downHeld = false;
  p.jumpHeld = false;
  p.jumpBuffer = 0;
  p.coyote = 0;
  p.landing = 0;

  themeColorMeta?.setAttribute("content", PALETTES.day.sky);
  readyPrompt.hidden = state !== "ready";
  gameOverPanel.hidden = true;
  updateHud(true);
}

function beginRun(withJump) {
  if (game.state === "over") {
    resetRun("running");
  } else if (game.state === "ready") {
    game.state = "running";
    readyPrompt.hidden = true;
  }

  if (withJump) {
    game.player.jumpBuffer = 0.13;
    game.player.jumpHeld = true;
  }

  keepScreenAwake();
}

function endRun() {
  if (game.state !== "running") return;

  game.state = "over";
  game.shake = 0.16;
  game.player.jumpHeld = false;
  game.player.downHeld = false;
  game.player.ducking = false;

  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem(STORAGE_KEY, String(game.best));
  }

  tone(92, 0.12, 0.05, "square");
  window.setTimeout(() => tone(62, 0.16, 0.04, "square"), 90);
  haptic([32, 24, 48]);
  releaseWakeLock();
  gameOverPanel.hidden = false;
  updateHud(true);
}

function pressJump() {
  unlockAudio();
  if (game.state === "over") {
    beginRun(false);
    return;
  }

  if (game.state === "ready") {
    beginRun(true);
    return;
  }

  game.player.jumpBuffer = 0.13;
  game.player.jumpHeld = true;
}

function releaseJump() {
  const p = game.player;
  p.jumpHeld = false;
  if (p.vy < -280) p.vy *= 0.55;
}

function pressDown() {
  unlockAudio();
  if (game.state === "ready") beginRun(false);
  if (game.state !== "running") return;
  game.player.downHeld = true;
}

function releaseDown() {
  game.player.downHeld = false;
  game.player.ducking = false;
}

function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt);
  updateClouds(dt);
  updateDust(dt);

  if (game.state !== "running") return;

  game.runTime += dt;
  game.distance += game.speed * dt;
  game.score = Math.floor(game.distance / 16);
  game.speed = Math.min(820, 410 + game.score * 0.24);

  const milestone = Math.floor(game.score / 100);
  if (milestone > game.milestone) {
    game.milestone = milestone;
    if (milestone > 0) {
      tone(880, 0.055, 0.025, "square");
    }
  }

  updatePlayer(dt);

  if (game.distance >= game.nextSpawn) {
    spawnObstacle();
  }

  for (const obstacle of game.obstacles) {
    obstacle.x -= game.speed * dt;
    obstacle.phase += dt * (obstacle.kind === "moth" ? 13 : 4);
  }
  game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -80);

  checkCollisions();
  updateHud();
}

function updatePlayer(dt) {
  const p = game.player;
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.coyote = p.grounded ? 0.075 : Math.max(0, p.coyote - dt);
  p.landing = Math.max(0, p.landing - dt);

  if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
    p.vy = -765;
    p.grounded = false;
    p.ducking = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    spawnDust(p.x + 28, WORLD.ground - 2, 5);
    tone(230, 0.035, 0.018, "square");
    haptic(8);
  }

  p.ducking = p.grounded && p.downHeld;

  if (!p.grounded) {
    const gravity = p.jumpHeld && p.vy < 0 ? 1740 : 2520;
    p.vy += gravity * dt;
    if (p.downHeld) p.vy += 2600 * dt;
    p.y += p.vy * dt;

    if (p.y >= WORLD.ground) {
      const hardLanding = p.vy > 520;
      p.y = WORLD.ground;
      p.vy = 0;
      p.grounded = true;
      p.landing = hardLanding ? 0.09 : 0.04;
      if (hardLanding) spawnDust(p.x + 42, WORLD.ground - 1, 7);
    }
  }

  if (p.grounded && game.runTime > 0.2 && Math.floor(game.runTime * 11) % 7 === 0) {
    if (Math.random() < 0.22) spawnDust(p.x + 16, WORLD.ground, 1);
  }
}

function spawnObstacle() {
  const difficulty = Math.min(1, game.score / 900);
  const choices = ["grassSmall", "grassTall", "grassPair"];
  if (game.score > 130) choices.push("scratchPost");
  if (game.score > 260) choices.push("moth");

  let kind = choices[Math.floor(Math.random() * choices.length)];
  if (kind === game.lastObstacle && Math.random() < 0.62) {
    kind = choices[(choices.indexOf(kind) + 1) % choices.length];
  }
  if (game.lastObstacle === "moth" && kind === "moth") kind = "grassSmall";

  const obstacle = makeObstacle(kind);
  obstacle.x = view.worldWidth + 55;
  game.obstacles.push(obstacle);
  game.lastObstacle = kind;

  const reactionTime = random(0.82, 1.24 - difficulty * 0.08);
  const extra = random(75, 145) + obstacle.w;
  game.nextSpawn = game.distance + game.speed * reactionTime + extra;
}

function makeObstacle(kind) {
  if (kind === "grassSmall") {
    return { kind, x: 0, y: WORLD.ground - 50, w: 30, h: 50, hit: [5, 5, 20, 45], phase: 0 };
  }
  if (kind === "grassTall") {
    return { kind, x: 0, y: WORLD.ground - 75, w: 38, h: 75, hit: [6, 4, 26, 71], phase: 0 };
  }
  if (kind === "grassPair") {
    return { kind, x: 0, y: WORLD.ground - 58, w: 72, h: 58, hit: [3, 6, 65, 52], phase: 0 };
  }
  if (kind === "scratchPost") {
    return { kind, x: 0, y: WORLD.ground - 82, w: 45, h: 82, hit: [5, 3, 35, 79], phase: 0 };
  }
  return { kind: "moth", x: 0, y: WORLD.ground - 78, w: 48, h: 25, hit: [4, 3, 40, 19], phase: 0 };
}

function checkCollisions() {
  const playerBox = getPlayerBox();
  for (const obstacle of game.obstacles) {
    const [hx, hy, hw, hh] = obstacle.hit;
    const obstacleBox = {
      x: obstacle.x + hx,
      y: obstacle.y + hy,
      w: hw,
      h: hh,
    };
    if (overlap(playerBox, obstacleBox)) {
      endRun();
      return;
    }
  }
}

function getPlayerBox() {
  const p = game.player;
  if (p.ducking) {
    return { x: p.x + 10, y: p.y - 42, w: 101, h: 38 };
  }
  return { x: p.x + 18, y: p.y - 72, w: 82, h: 66 };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildClouds() {
  game.clouds = Array.from({ length: 4 }, (_, index) => ({
    x: index * 340 + random(80, 230),
    y: random(68, 150),
    scale: random(0.72, 1.12),
  }));
}

function updateClouds(dt) {
  for (const cloud of game.clouds) {
    const drift = game.state === "running" ? game.speed * 0.045 : 8;
    cloud.x -= drift * dt;
    if (cloud.x < -100) {
      cloud.x = view.worldWidth + random(120, 360);
      cloud.y = random(68, 150);
    }
  }
}

function spawnDust(x, y, count) {
  for (let i = 0; i < count; i += 1) {
    game.dust.push({
      x: x + random(-8, 8),
      y: y + random(-3, 3),
      vx: random(-72, -20),
      vy: random(-30, -8),
      size: random(2, 5),
      life: random(0.18, 0.4),
    });
  }
}

function updateDust(dt) {
  for (let i = game.dust.length - 1; i >= 0; i -= 1) {
    const dust = game.dust[i];
    dust.life -= dt;
    dust.x += dust.vx * dt;
    dust.y += dust.vy * dt;
    dust.vy += 70 * dt;
    if (dust.life <= 0) game.dust.splice(i, 1);
  }
}

function updateHud(force = false) {
  if (!force && game.score === game.shownScore) return;
  game.shownScore = game.score;
  scoreHud.textContent = formatScore(game.score);
  bestHud.textContent = `HI ${formatScore(game.best)}`;
}

function draw() {
  const colors = PALETTES.day;

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, view.width, view.height);

  const shakeX = game.shake > 0 ? random(-3, 3) * (game.shake / 0.16) : 0;
  const shakeY = game.shake > 0 ? random(-2, 2) * (game.shake / 0.16) : 0;
  ctx.setTransform(
    view.dpr * view.scale,
    0,
    0,
    view.dpr * view.scale,
    view.dpr * shakeX,
    view.dpr * (view.offsetY + shakeY),
  );
  ctx.imageSmoothingEnabled = false;

  drawSky(colors);
  drawGround(colors);
  drawObstacles(colors);
  drawDomi();
  drawDust(colors.dust);
}

function drawSky(colors) {
  for (const cloud of game.clouds) {
    const x = Math.round(cloud.x);
    const y = Math.round(cloud.y);
    const unit = Math.max(2, Math.round(3 * cloud.scale));
    ctx.fillStyle = colors.cloud;
    ctx.fillRect(x + unit * 2, y, unit * 8, unit);
    ctx.fillRect(x + unit, y + unit, unit * 11, unit);
    ctx.fillRect(x, y + unit * 2, unit * 13, unit);
    ctx.fillRect(x + unit * 2, y + unit * 3, unit * 9, unit);
    ctx.fillStyle = colors.cloudShade;
    ctx.fillRect(x + unit * 3, y + unit * 3, unit * 7, unit);
  }

  const sunX = view.worldWidth - 118;
  ctx.fillStyle = colors.sun;
  ctx.fillRect(sunX + 5, 64, 18, 26);
  ctx.fillRect(sunX, 69, 28, 16);
}

function drawGround(colors) {
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, WORLD.ground + 3, view.worldWidth, view.height / view.scale + 40);

  ctx.fillStyle = colors.ink;
  ctx.fillRect(0, WORLD.ground, view.worldWidth, 3);

  const offset = game.distance % 108;
  for (let x = -offset; x < view.worldWidth + 110; x += 108) {
    ctx.fillStyle = colors.ink;
    ctx.fillRect(Math.round(x), WORLD.ground + 11, 42, 3);
    ctx.fillStyle = colors.groundMark;
    ctx.fillRect(Math.round(x + 66), WORLD.ground + 22, 18, 3);
    ctx.fillRect(Math.round(x + 91), WORLD.ground + 35, 7, 3);
  }
}

function drawObstacles(colors) {
  for (const obstacle of game.obstacles) {
    const x = Math.round(obstacle.x);
    if (obstacle.kind === "grassSmall") drawGrassPot(x, obstacle.y, 1, colors);
    if (obstacle.kind === "grassTall") drawGrassPot(x, obstacle.y, 1.35, colors);
    if (obstacle.kind === "grassPair") {
      drawGrassPot(x, WORLD.ground - 48, 0.95, colors);
      drawGrassPot(x + 31, WORLD.ground - 58, 1.08, colors);
    }
    if (obstacle.kind === "scratchPost") drawScratchPost(x, obstacle.y, colors, obstacle.phase);
    if (obstacle.kind === "moth") drawMoth(x, obstacle.y, colors, obstacle.phase);
  }
}

function drawGrassPot(x, y, scale, colors) {
  const s = scale;
  const baseY = WORLD.ground;
  const potW = Math.round(25 * s);
  const potH = Math.round(18 * s);
  const left = x + Math.round((30 * s - potW) / 2);

  ctx.fillStyle = colors.potDark;
  ctx.fillRect(left - 2, baseY - potH, potW + 4, 5);
  ctx.fillRect(left, baseY - potH + 5, potW, potH - 5);
  ctx.fillStyle = colors.pot;
  ctx.fillRect(left + 3, baseY - potH + 5, potW - 6, potH - 8);

  const rootX = left + Math.floor(potW / 2);
  const top = Math.round(y);
  const grassBase = baseY - potH;
  const stemWidth = Math.max(7, Math.round(7 * s));
  const stemLeft = Math.round(rootX - stemWidth / 2);
  ctx.fillStyle = colors.grass;
  ctx.fillRect(stemLeft, top + 4, stemWidth, grassBase - top);
  ctx.fillRect(stemLeft + 2, top, stemWidth - 4, 5);

  const armWidth = Math.max(6, Math.round(6 * s));
  const leftArmY = Math.round(top + (grassBase - top) * 0.43);
  const rightArmY = Math.round(top + (grassBase - top) * 0.62);
  ctx.fillRect(stemLeft - armWidth - 5, leftArmY, armWidth + 8, 7);
  ctx.fillRect(stemLeft - armWidth - 5, leftArmY - 10, armWidth, 15);
  ctx.fillRect(stemLeft + stemWidth - 3, rightArmY, armWidth + 8, 7);
  ctx.fillRect(stemLeft + stemWidth + 5, rightArmY - 11, armWidth, 16);

  ctx.fillStyle = colors.grassLight;
  ctx.fillRect(stemLeft + 2, top + 7, 2, Math.max(5, grassBase - top - 10));

  ctx.fillStyle = colors.cloud;
  ctx.fillRect(rootX - 5, baseY - 11, 3, 3);
  ctx.fillRect(rootX + 3, baseY - 11, 3, 3);
  ctx.fillRect(rootX - 1, baseY - 7, 3, 3);
}

function drawScratchPost(x, y, colors, phase) {
  const sway = Math.round(Math.sin(phase) * 2);
  ctx.fillStyle = colors.scratchDark;
  ctx.fillRect(x + 4, WORLD.ground - 7, 38, 7);
  ctx.fillRect(x + 11, WORLD.ground - 13, 24, 6);
  ctx.fillRect(x + 19, y + 10, 9, WORLD.ground - y - 23);
  ctx.fillRect(x + 10, y + 4, 27, 9);

  ctx.fillStyle = colors.scratch;
  ctx.fillRect(x + 8, WORLD.ground - 6, 30, 4);
  ctx.fillRect(x + 22, y + 13, 4, WORLD.ground - y - 29);
  ctx.fillRect(x + 14, y + 7, 19, 4);

  ctx.fillStyle = colors.scratchLight;
  for (let ropeY = y + 18; ropeY < WORLD.ground - 18; ropeY += 9) {
    ctx.fillRect(x + 21, ropeY, 5, 3);
  }

  ctx.fillStyle = colors.ink;
  ctx.fillRect(x + 35, y + 8, 3, 28);
  ctx.fillStyle = colors.pot;
  ctx.fillRect(x + 34 + sway, y + 34, 8, 8);
}

function drawMoth(x, y, colors, phase) {
  const wingsUp = Math.sin(phase) > 0;
  ctx.fillStyle = colors.ink;
  ctx.fillRect(x + 21, y + 6, 6, 15);
  ctx.fillRect(x + 18, y + 3, 3, 4);
  ctx.fillRect(x + 27, y + 3, 3, 4);

  ctx.fillStyle = colors.moth;
  if (wingsUp) {
    ctx.fillRect(x + 4, y, 16, 7);
    ctx.fillRect(x + 28, y, 16, 7);
    ctx.fillRect(x + 9, y + 7, 11, 5);
    ctx.fillRect(x + 28, y + 7, 11, 5);
  } else {
    ctx.fillRect(x + 2, y + 9, 19, 8);
    ctx.fillRect(x + 27, y + 9, 19, 8);
    ctx.fillStyle = colors.mothAccent;
    ctx.fillRect(x + 7, y + 11, 7, 3);
    ctx.fillRect(x + 34, y + 11, 7, 3);
  }
}

function drawDomi() {
  if (!spriteSheet.complete || !spriteSheet.naturalWidth) return;

  const p = game.player;
  const squash = p.landing > 0 && p.grounded ? 0.92 : 1;

  if (game.state === "running" && p.grounded && !p.ducking && runCycleSheet.complete && runCycleSheet.naturalWidth) {
    const frameRate = 11 + game.speed / 230;
    const frameIndex = Math.floor(game.runTime * frameRate) % RUN_SPRITES.length;
    const frame = RUN_SPRITES[frameIndex];
    const frameScale = PLAYER.runHeight / frame.h;
    const width = Math.round(frame.w * frameScale);
    const height = Math.round(frame.h * frameScale);
    const rightAnchor = p.x + PLAYER.width - 2;
    const dx = Math.round(rightAnchor - width);
    const dy = Math.round(p.y - height * squash - (frame.lift || 0));

    ctx.drawImage(
      runCycleSheet,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      dx,
      dy,
      width,
      Math.round(height * squash),
    );
    return;
  }

  let frameIndex = 0;
  let maxW = PLAYER.width;
  let maxH = PLAYER.runHeight;

  if (game.state === "over") {
    frameIndex = 5;
    maxH = 70;
  } else if (!p.grounded) {
    frameIndex = 2;
  } else if (p.ducking) {
    frameIndex = 3 + (Math.floor(game.runTime * 11) % 2);
    maxW = 126;
    maxH = PLAYER.duckHeight;
  }

  const frame = SPRITES[frameIndex];
  const frameScale = Math.min(maxW / frame.w, maxH / frame.h);
  const width = Math.round(frame.w * frameScale);
  const height = Math.round(frame.h * frameScale);
  const bob = game.state === "ready" ? Math.round(Math.sin(game.time * 3.2) * 2) : 0;
  const dx = Math.round(p.x + (PLAYER.width - width) / 2);
  const dy = Math.round(p.y - height * squash + bob);

  ctx.drawImage(spriteSheet, frame.x, frame.y, frame.w, frame.h, dx, dy, width, Math.round(height * squash));
}

function drawDust(ink) {
  ctx.fillStyle = ink;
  for (const dust of game.dust) {
    ctx.globalAlpha = Math.min(0.65, dust.life * 2.4);
    ctx.fillRect(Math.round(dust.x), Math.round(dust.y), Math.round(dust.size), Math.round(dust.size));
  }
  ctx.globalAlpha = 1;
}

function unlockAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function tone(frequency, duration, volume, type) {
  if (!audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function haptic(pattern) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

async function keepScreenAwake() {
  if (wakeLock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  const activeLock = wakeLock;
  wakeLock = null;
  activeLock?.release().catch(() => {});
}

function scheduleResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resize();
    lastFrame = 0;
  });
}

function capturePointer(event) {
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function formatScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(5, "0");
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function loop(now) {
  const seconds = now / 1000;
  const dt = Math.min(0.032, seconds - (lastFrame || seconds));
  lastFrame = seconds;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", scheduleResize);
window.visualViewport?.addEventListener("resize", scheduleResize);
window.screen.orientation?.addEventListener("change", scheduleResize);
window.addEventListener("blur", () => {
  releaseJump();
  releaseDown();
});

document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  releaseJump();
  releaseDown();
  if (document.visibilityState === "visible" && game.state === "running") {
    keepScreenAwake();
  } else {
    releaseWakeLock();
  }
});

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(event.code)) {
    event.preventDefault();
  }
  if ((event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") && !event.repeat) {
    pressJump();
  }
  if (event.code === "ArrowDown" || event.code === "KeyS") pressDown();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") releaseJump();
  if (event.code === "ArrowDown" || event.code === "KeyS") releaseDown();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  capturePointer(event);
  pressJump();
});
canvas.addEventListener("pointerup", releaseJump);
canvas.addEventListener("pointercancel", releaseJump);

jumpBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  capturePointer(event);
  pressJump();
});
jumpBtn.addEventListener("pointerup", releaseJump);
jumpBtn.addEventListener("pointercancel", releaseJump);

duckBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  capturePointer(event);
  pressDown();
});
duckBtn.addEventListener("pointerup", releaseDown);
duckBtn.addEventListener("pointercancel", releaseDown);

restartBtn.addEventListener("click", () => {
  unlockAudio();
  beginRun(false);
});

resize();
buildClouds();
resetRun();
window.__domiRun = game;
requestAnimationFrame(loop);
