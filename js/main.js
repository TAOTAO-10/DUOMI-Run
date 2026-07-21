const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

const shell = document.querySelector(".game-shell");
const scoreHud = document.querySelector("#scoreHud");
const bestHud = document.querySelector("#bestHud");
const readyPrompt = document.querySelector("#readyPrompt");
const gameOverPanel = document.querySelector("#gameOverPanel");
const restartBtn = document.querySelector("#restartBtn");
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
    water: "#6db9d1",
    waterLight: "#d8f1f4",
    planter: "#9a6148",
    planterLight: "#c7835e",
    planterDark: "#684438",
    flowerPink: "#e8949d",
    flowerYellow: "#f1cf68",
    branch: "#73533f",
    branchLight: "#9b7455",
    leaf: "#4f7658",
    leafLight: "#76a06f",
    dust: "#71857a",
  },
};

const PLAYER = {
  width: 120,
  runHeight: 82,
  duckHeight: 56,
};

const INPUT = {
  gestureDelay: 65,
  highJumpHold: 185,
  swipeDistance: 25,
  shortDuck: 0.34,
};

const JUMP = {
  smallVelocity: -540,
  highVelocity: -650,
  gravity: 2400,
  fastFallGravity: 4300,
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
    jumpBuffer: 0,
    jumpStage: "none",
    jumpAge: 0,
    duckUntil: 0,
    fastFallUntil: 0,
    coyote: 0,
    landing: 0,
  },
};

let audioContext = null;
let lastFrame = 0;
let resizeFrame = 0;
let wakeLock = null;
let jumpKeyHeld = false;
let jumpKeyTimer = 0;

const pointerGesture = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startedAt: 0,
  duckStartedAt: 0,
  mode: "idle",
  jumpTimer: 0,
  highTimer: 0,
};

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
  p.jumpBuffer = 0;
  p.jumpStage = "none";
  p.jumpAge = 0;
  p.duckUntil = 0;
  p.fastFallUntil = 0;
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
  }

  keepScreenAwake();
}

function endRun() {
  if (game.state !== "running") return;

  game.state = "over";
  game.shake = 0.16;
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
    return false;
  }

  if (game.state === "ready") {
    beginRun(false);
  }

  game.player.downHeld = false;
  game.player.duckUntil = 0;
  game.player.jumpBuffer = 0.13;
  return true;
}

function releaseJump() {
  // Jump height is intentionally discrete: tap is small, hold is high.
}

function promoteHighJump() {
  const p = game.player;
  if (game.state !== "running" || p.grounded || p.jumpStage !== "small" || p.jumpAge > 0.34) return;
  p.vy = Math.min(p.vy, JUMP.highVelocity);
  p.jumpStage = "high";
  tone(310, 0.025, 0.012, "square");
}

function pressDown() {
  unlockAudio();
  if (game.state === "ready") beginRun(false);
  if (game.state !== "running") return;
  const p = game.player;
  p.jumpBuffer = 0;
  p.downHeld = true;
  p.duckUntil = 0;
  if (!p.grounded) {
    p.fastFallUntil = Math.max(p.fastFallUntil, game.time + 0.2);
    p.vy = Math.max(p.vy, 300);
  }
}

function releaseDown(shortDuck = false) {
  const p = game.player;
  p.downHeld = false;
  if (shortDuck) {
    p.duckUntil = Math.max(p.duckUntil, game.time + INPUT.shortDuck);
    p.fastFallUntil = Math.max(p.fastFallUntil, game.time + 0.16);
  } else if (game.time >= p.duckUntil) {
    p.ducking = false;
  }
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
    obstacle.phase += dt * 4;
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
    p.vy = JUMP.smallVelocity;
    p.grounded = false;
    p.ducking = false;
    p.jumpStage = "small";
    p.jumpAge = 0;
    p.coyote = 0;
    p.jumpBuffer = 0;
    spawnDust(p.x + 28, WORLD.ground - 2, 5);
    tone(230, 0.035, 0.018, "square");
    haptic(8);
  }

  p.ducking = p.grounded && (p.downHeld || game.time < p.duckUntil);

  if (!p.grounded) {
    p.jumpAge += dt;
    const fastFalling = p.downHeld || game.time < p.fastFallUntil;
    const gravity = fastFalling ? JUMP.fastFallGravity : JUMP.gravity;
    p.vy += gravity * dt;
    p.y += p.vy * dt;

    if (p.y >= WORLD.ground) {
      const hardLanding = p.vy > 520;
      p.y = WORLD.ground;
      p.vy = 0;
      p.grounded = true;
      p.jumpStage = "none";
      p.jumpAge = 0;
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
  const choices = ["puddle"];
  if (game.score > 70) choices.push("planter");
  if (game.score > 150) choices.push("branch");

  let kind = choices[Math.floor(Math.random() * choices.length)];
  if (kind === game.lastObstacle && Math.random() < 0.62) {
    kind = choices[(choices.indexOf(kind) + 1) % choices.length];
  }

  const previousKind = game.lastObstacle;
  const obstacle = makeObstacle(kind);
  obstacle.x = view.worldWidth + 55;
  game.obstacles.push(obstacle);
  game.lastObstacle = kind;

  let reactionTime = random(0.9, 1.18 - difficulty * 0.06);
  if (kind === "planter" || previousKind === "planter") reactionTime += 0.28;
  const extra = random(80, 135) + obstacle.w;
  game.nextSpawn = game.distance + game.speed * reactionTime + extra;
}

function makeObstacle(kind) {
  if (kind === "puddle") {
    return { kind, x: 0, y: WORLD.ground - 11, w: 90, h: 11, hit: [6, 4, 78, 7], phase: 0 };
  }
  if (kind === "planter") {
    return { kind, x: 0, y: WORLD.ground - 94, w: 62, h: 94, hit: [6, 7, 50, 87], phase: 0 };
  }
  return { kind: "branch", x: 0, y: -18, w: 110, h: 278, hit: [8, 0, 96, 276], phase: 0 };
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

  ctx.fillStyle = colors.grassLight;
  ctx.fillRect(0, WORLD.ground - 3, view.worldWidth, 6);
  ctx.fillStyle = colors.ink;
  ctx.fillRect(0, WORLD.ground, view.worldWidth, 3);

  const offset = game.distance % 126;
  for (let x = -offset; x < view.worldWidth + 130; x += 126) {
    ctx.fillStyle = colors.groundMark;
    ctx.fillRect(Math.round(x + 5), WORLD.ground + 17, 34, 3);
    ctx.fillRect(Math.round(x + 57), WORLD.ground + 34, 22, 3);
    ctx.fillRect(Math.round(x + 96), WORLD.ground + 55, 12, 3);
    ctx.fillStyle = colors.grass;
    ctx.fillRect(Math.round(x + 43), WORLD.ground - 7, 3, 7);
    ctx.fillRect(Math.round(x + 47), WORLD.ground - 4, 3, 4);
  }
}

function drawObstacles(colors) {
  for (const obstacle of game.obstacles) {
    const x = Math.round(obstacle.x);
    if (obstacle.kind === "puddle") drawPuddle(x, colors, obstacle.phase);
    if (obstacle.kind === "planter") drawPlanter(x, obstacle.y, colors, obstacle.phase);
    if (obstacle.kind === "branch") drawLowBranch(x, colors, obstacle.phase);
  }
}

function drawPuddle(x, colors, phase) {
  const shimmer = Math.sin(phase * 1.7) > 0 ? 5 : 0;
  ctx.fillStyle = colors.groundMark;
  ctx.fillRect(x + 5, WORLD.ground - 2, 80, 5);
  ctx.fillStyle = colors.water;
  ctx.fillRect(x + 7, WORLD.ground - 8, 76, 8);
  ctx.fillRect(x + 17, WORLD.ground - 11, 56, 3);
  ctx.fillRect(x + 1, WORLD.ground - 5, 88, 5);
  ctx.fillStyle = colors.waterLight;
  ctx.fillRect(x + 18 + shimmer, WORLD.ground - 8, 23, 3);
  ctx.fillRect(x + 53 - shimmer, WORLD.ground - 5, 15, 2);
}

function drawPlanter(x, y, colors, phase) {
  const sway = Math.round(Math.sin(phase * 1.2) * 2);
  const boxTop = WORLD.ground - 43;

  ctx.fillStyle = colors.planterDark;
  ctx.fillRect(x + 4, boxTop, 54, 43);
  ctx.fillRect(x, boxTop + 4, 62, 8);
  ctx.fillStyle = colors.planter;
  ctx.fillRect(x + 8, boxTop + 7, 46, 31);
  ctx.fillStyle = colors.planterLight;
  ctx.fillRect(x + 11, boxTop + 10, 3, 25);
  ctx.fillRect(x + 31, boxTop + 10, 3, 25);
  ctx.fillRect(x + 50, boxTop + 10, 3, 25);

  ctx.fillStyle = colors.grass;
  ctx.fillRect(x + 14, y + 23, 4, boxTop - y - 22);
  ctx.fillRect(x + 29, y + 10, 4, boxTop - y - 9);
  ctx.fillRect(x + 44, y + 20, 4, boxTop - y - 19);
  ctx.fillStyle = colors.leaf;
  ctx.fillRect(x + 7 + sway, y + 34, 13, 7);
  ctx.fillRect(x + 16 - sway, y + 48, 14, 7);
  ctx.fillRect(x + 33 + sway, y + 30, 15, 7);
  ctx.fillRect(x + 41 - sway, y + 44, 13, 7);
  ctx.fillStyle = colors.leafLight;
  ctx.fillRect(x + 18 + sway, y + 25, 10, 5);
  ctx.fillRect(x + 35 - sway, y + 54, 11, 5);

  drawPixelFlower(x + 16, y + 18, colors.flowerPink, colors.flowerYellow);
  drawPixelFlower(x + 31, y + 5, colors.flowerYellow, colors.flowerPink);
  drawPixelFlower(x + 46, y + 15, colors.flowerPink, colors.cloud);
}

function drawPixelFlower(x, y, petal, center) {
  ctx.fillStyle = petal;
  ctx.fillRect(x - 5, y, 4, 4);
  ctx.fillRect(x + 3, y, 4, 4);
  ctx.fillRect(x - 1, y - 4, 4, 4);
  ctx.fillRect(x - 1, y + 4, 4, 4);
  ctx.fillStyle = center;
  ctx.fillRect(x - 1, y, 4, 4);
}

function drawLowBranch(x, colors, phase) {
  const sway = Math.round(Math.sin(phase) * 2);
  const bottom = WORLD.ground - 45;

  ctx.fillStyle = colors.branch;
  ctx.fillRect(x + 76, -18, 18, bottom + 18);
  ctx.fillRect(x + 57, 88, 25, 12);
  ctx.fillRect(x + 35, 129, 48, 12);
  ctx.fillRect(x + 13, 183, 70, 13);
  ctx.fillRect(x + 2, 232, 86, 15);
  ctx.fillStyle = colors.branchLight;
  ctx.fillRect(x + 80, -18, 5, bottom + 11);
  ctx.fillRect(x + 20, 235, 58, 4);

  ctx.fillStyle = colors.leaf;
  ctx.fillRect(x + 50 + sway, 58, 28, 17);
  ctx.fillRect(x + 84 - sway, 82, 25, 18);
  ctx.fillRect(x + 28 - sway, 111, 31, 18);
  ctx.fillRect(x + 66 + sway, 148, 37, 20);
  ctx.fillRect(x + 7 + sway, 166, 33, 20);
  ctx.fillRect(x + 44 - sway, 203, 39, 21);
  ctx.fillStyle = colors.leafLight;
  ctx.fillRect(x + 58 + sway, 63, 14, 6);
  ctx.fillRect(x + 35 - sway, 116, 16, 6);
  ctx.fillRect(x + 74 + sway, 154, 18, 6);
  ctx.fillRect(x + 14 + sway, 172, 17, 6);
  ctx.fillRect(x + 53 - sway, 209, 20, 6);
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
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic and older pointer implementations may not support capture.
  }
}

function clearPointerTimers() {
  window.clearTimeout(pointerGesture.jumpTimer);
  window.clearTimeout(pointerGesture.highTimer);
  pointerGesture.jumpTimer = 0;
  pointerGesture.highTimer = 0;
}

function resetPointerGesture() {
  clearPointerTimers();
  pointerGesture.active = false;
  pointerGesture.pointerId = null;
  pointerGesture.mode = "idle";
}

function beginPointerGesture(event) {
  if (pointerGesture.active || (event.button !== undefined && event.button !== 0)) return;

  event.preventDefault();
  capturePointer(event);
  pointerGesture.active = true;
  pointerGesture.pointerId = event.pointerId;
  pointerGesture.startX = event.clientX;
  pointerGesture.startY = event.clientY;
  pointerGesture.startedAt = performance.now();
  pointerGesture.duckStartedAt = 0;
  pointerGesture.mode = "pending";

  pointerGesture.jumpTimer = window.setTimeout(() => {
    if (!pointerGesture.active || pointerGesture.mode !== "pending") return;
    pointerGesture.mode = "jump";
    pressJump();
  }, INPUT.gestureDelay);

  pointerGesture.highTimer = window.setTimeout(() => {
    if (!pointerGesture.active || pointerGesture.mode !== "jump") return;
    promoteHighJump();
  }, INPUT.highJumpHold);
}

function movePointerGesture(event) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return;

  const dx = event.clientX - pointerGesture.startX;
  const dy = event.clientY - pointerGesture.startY;
  const isDownSwipe = dy >= INPUT.swipeDistance && dy > Math.abs(dx) * 1.15;
  if (!isDownSwipe || pointerGesture.mode === "duck") return;

  event.preventDefault();
  clearPointerTimers();
  pointerGesture.mode = "duck";
  pointerGesture.duckStartedAt = performance.now();
  releaseJump();
  pressDown();
}

function finishPointerGesture(event) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return;

  if (pointerGesture.mode === "pending") {
    clearPointerTimers();
    pressJump();
    releaseJump();
  } else if (pointerGesture.mode === "jump") {
    releaseJump();
  } else if (pointerGesture.mode === "duck") {
    const duckDuration = performance.now() - pointerGesture.duckStartedAt;
    releaseDown(duckDuration < 220);
  }

  resetPointerGesture();
}

function cancelPointerGesture() {
  if (pointerGesture.mode === "jump") releaseJump();
  if (pointerGesture.mode === "duck") releaseDown();
  resetPointerGesture();
}

function pressJumpKey() {
  if (jumpKeyHeld) return;
  jumpKeyHeld = true;
  pressJump();
  window.clearTimeout(jumpKeyTimer);
  jumpKeyTimer = window.setTimeout(() => {
    if (jumpKeyHeld) promoteHighJump();
  }, INPUT.highJumpHold);
}

function releaseJumpKey() {
  jumpKeyHeld = false;
  window.clearTimeout(jumpKeyTimer);
  jumpKeyTimer = 0;
  releaseJump();
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
  cancelPointerGesture();
  releaseJumpKey();
  releaseDown();
});

document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  cancelPointerGesture();
  releaseJumpKey();
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
    pressJumpKey();
  }
  if (event.code === "ArrowDown" || event.code === "KeyS") {
    releaseJumpKey();
    pressDown();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") releaseJumpKey();
  if (event.code === "ArrowDown" || event.code === "KeyS") releaseDown();
});

canvas.addEventListener("pointerdown", beginPointerGesture);
canvas.addEventListener("pointermove", movePointerGesture);
canvas.addEventListener("pointerup", finishPointerGesture);
canvas.addEventListener("pointercancel", cancelPointerGesture);

restartBtn.addEventListener("click", () => {
  unlockAudio();
  beginRun(false);
});

resize();
buildClouds();
resetRun();
window.__domiRun = game;
requestAnimationFrame(loop);
