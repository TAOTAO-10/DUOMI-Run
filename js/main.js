const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

const shell = document.querySelector(".game-shell");
const scoreHud = document.querySelector("#scoreHud");
const bestHud = document.querySelector("#bestHud");
const bestStat = document.querySelector("#bestStat");
const recordSpark = document.querySelector("#recordSpark");
const soundBtn = document.querySelector("#soundBtn");
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
    sunLight: "#fff0ac",
    sunShade: "#d99f4c",
    ink: "#394a46",
    ground: "#d7e2d5",
    groundMark: "#a5b9a6",
    grass: "#4f7658",
    grassLight: "#729578",
    branch: "#73533f",
    branchLight: "#9b7455",
    leaf: "#4f7658",
    leafLight: "#76a06f",
    bird: "#73979c",
    dust: "#8e8069",
    dustLight: "#c8b995",
  },
};

const PLAYER = {
  width: 120,
  runHeight: 82,
  slideHeight: 72,
};

const SLIDE_SCALE = 0.44;

const SLIDE_ACTION = {
  enterFrameTime: 0.075,
  exitFrameTime: 0.085,
  holdFrame: 3,
  exitStartFrame: 4,
  lastFrame: 5,
};

const INPUT = {
  swipeDistance: 10,
};

const JUMP = {
  velocity: -765,
  smallArcTime: 0.09,
  decisionTime: 0.15,
  heldGravity: 1740,
  smallRiseGravity: 3600,
  releasedGravity: 2520,
  fastFallGravity: 4300,
};

const STORAGE_KEY = "domi-run-best-v2";
const SOUND_KEY = "domi-run-sound-v1";
const MUSIC_STEP_SECONDS = 0.25;
const MUSIC_MELODY = Object.freeze([
  67, null, 71, 74, null, 71, 69, null,
  64, 67, null, 72, 71, null, 67, null,
  71, null, 74, 76, 74, null, 69, 67,
  69, 71, null, 74, 69, null, 62, null,
  67, 69, 71, null, 76, 74, 71, null,
  72, null, 71, 69, 64, 67, null, 69,
  71, 74, null, 79, 76, 74, null, 69,
  67, 71, 69, null, 74, 71, 67, null,
]);
const MUSIC_BASS_ROOTS = Object.freeze([43, 48, 40, 50, 43, 48, 50, 43]);
const spriteSheet = new Image();
spriteSheet.src = "assets/sprites/domi-steve-sprites-v1.png";
const runCycleSheet = new Image();
runCycleSheet.src = "assets/sprites/domi-run-cycle-v2.png";
const slideRunSheet = new Image();
slideRunSheet.src = "assets/sprites/domi-slide-run.png?v=1";
const obstacleSheet = new Image();
obstacleSheet.src = "assets/sprites/domi-obstacles-v1.png";

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

const SLIDE_RUN_SPRITES = [
  { x: 52, y: 302, w: 279, h: 168 },
  { x: 413, y: 303, w: 310, h: 167 },
  { x: 782, y: 347, w: 302, h: 123 },
  { x: 1152, y: 366, w: 345, h: 104 },
  { x: 1532, y: 350, w: 265, h: 120 },
  { x: 1869, y: 329, w: 227, h: 141 },
];

const OBSTACLE_SPRITES = {
  chestnut: { x: 74, y: 419, w: 533, h: 185 },
  bramble: { x: 670, y: 424, w: 501, h: 183 },
  stump: { x: 1238, y: 168, w: 449, h: 483 },
  backpack: { x: 1744, y: 197, w: 351, h: 453 },
};

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
  recordTarget: 0,
  recordCelebrated: false,
  clearChimePending: false,
  speed: 410,
  nextSpawn: 500,
  nextObstacleKind: "",
  lastObstacle: "",
  sameObstacleStreak: 0,
  lastGapType: "",
  shake: 0,
  obstacles: [],
  clouds: [],
  birds: [],
  nextBirdAt: 0,
  dust: [],
  player: {
    x: 110,
    y: WORLD.ground,
    vy: 0,
    grounded: true,
    ducking: false,
    downHeld: false,
    jumpHeld: false,
    jumpCutQueued: false,
    jumpMode: "ground",
    jumpStartedAt: 0,
    jumpVelocityDebt: 0,
    jumpPositionDebt: 0,
    jumpBuffer: 0,
    fastFallUntil: 0,
    coyote: 0,
    landing: 0,
    dustTimer: 0,
    slideState: "idle",
    slideFrame: 0,
    slideTimer: 0,
    slideReleaseQueued: false,
  },
};

let audioContext = null;
let audioMaster = null;
let musicBus = null;
let sfxBus = null;
let recordTimer = 0;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
let lastFrame = 0;
let resizeFrame = 0;
let wakeLock = null;
let jumpKeyHeld = false;

const musicPlayback = {
  timer: 0,
  nextTime: 0,
  step: 0,
};

const pointerGesture = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startedAt: 0,
  duckStartedAt: 0,
  mode: "idle",
  commitFrame: 0,
};

function resize() {
  const viewport = window.visualViewport;
  const shellRect = shell.getBoundingClientRect();
  view.width = Math.ceil(
    Math.max(viewport?.width || 0, shellRect.width || 0, document.documentElement.clientWidth || window.innerWidth),
  );
  view.height = Math.ceil(
    Math.max(viewport?.height || 0, shellRect.height || 0, document.documentElement.clientHeight || window.innerHeight),
  );
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
  stopMusic(0.08);
  game.state = state;
  game.runTime = 0;
  game.distance = 0;
  game.score = 0;
  game.shownScore = -1;
  game.recordTarget = game.best;
  game.recordCelebrated = false;
  game.clearChimePending = false;
  game.speed = 410;
  game.nextSpawn = Math.max(440, view.worldWidth * 0.46);
  game.nextObstacleKind = "";
  game.lastObstacle = "";
  game.sameObstacleStreak = 0;
  game.lastGapType = "";
  game.shake = 0;
  game.obstacles.length = 0;
  game.dust.length = 0;
  clearRecordCelebration();

  const p = game.player;
  p.y = WORLD.ground;
  p.vy = 0;
  p.grounded = true;
  p.ducking = false;
  p.downHeld = false;
  p.jumpHeld = false;
  p.jumpCutQueued = false;
  p.jumpMode = "ground";
  p.jumpStartedAt = 0;
  p.jumpVelocityDebt = 0;
  p.jumpPositionDebt = 0;
  p.jumpBuffer = 0;
  p.fastFallUntil = 0;
  p.coyote = 0;
  p.landing = 0;
  p.dustTimer = 0;
  resetSlide(p);

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

  startMusic();
  keepScreenAwake();
}

function endRun() {
  if (game.state !== "running") return;

  game.state = "over";
  game.shake = 0.16;
  game.player.jumpHeld = false;
  game.player.jumpMode = "ground";
  game.player.jumpStartedAt = 0;
  game.player.downHeld = false;
  game.player.ducking = false;
  resetSlide(game.player);
  game.clearChimePending = false;
  stopMusic(0.22);

  if (game.score > game.best) {
    game.best = game.score;
  }
  localStorage.setItem(STORAGE_KEY, String(game.best));

  tone(92, 0.12, 0.05, "square");
  tone(62, 0.16, 0.04, "square", 0.09);
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
  resetSlide(game.player);
  game.player.jumpBuffer = 0.13;
  game.player.jumpHeld = true;
  game.player.jumpCutQueued = false;
  return true;
}

function releaseJump() {
  const p = game.player;
  if (!p.grounded && p.jumpMode === "deciding" && game.time - p.jumpStartedAt >= JUMP.decisionTime) {
    commitHighJump(p);
  }
  p.jumpHeld = false;
  if (p.jumpBuffer > 0) p.jumpCutQueued = true;
}

function commitHighJump(p) {
  p.y -= p.jumpPositionDebt;
  p.vy -= p.jumpVelocityDebt;
  p.jumpVelocityDebt = 0;
  p.jumpPositionDebt = 0;
  p.jumpMode = "high";
}

function pressDown() {
  unlockAudio();
  if (game.state === "ready") beginRun(false);
  if (game.state !== "running") return;
  const p = game.player;
  p.jumpBuffer = 0;
  p.jumpHeld = false;
  p.jumpCutQueued = false;
  p.downHeld = true;
  if (!p.grounded) {
    p.fastFallUntil = Math.max(p.fastFallUntil, game.time + 0.2);
    p.vy = Math.max(p.vy, 300);
  } else if (p.slideState === "idle") {
    startSlide(p);
  }
}

function releaseDown() {
  const p = game.player;
  p.downHeld = false;
  if (p.slideState === "entering") {
    p.slideReleaseQueued = true;
  } else if (p.slideState === "holding") {
    p.slideState = "exiting";
    p.slideFrame = SLIDE_ACTION.exitStartFrame;
    p.slideTimer = 0;
  }
}

function startSlide(p) {
  p.slideState = "entering";
  p.slideFrame = 0;
  p.slideTimer = 0;
  p.slideReleaseQueued = !p.downHeld;
  p.ducking = true;
  p.dustTimer = 0.055;
  if (game.state === "running" && p.grounded) {
    spawnDust(p.x - 12, WORLD.ground - 5, 8, "slideBurst");
  }
}

function resetSlide(p) {
  p.slideState = "idle";
  p.slideFrame = 0;
  p.slideTimer = 0;
  p.slideReleaseQueued = false;
  p.ducking = false;
}

function updateSlide(p, dt) {
  if (!p.grounded) {
    resetSlide(p);
    return;
  }

  if (p.slideState === "idle") {
    p.ducking = false;
    if (p.downHeld) startSlide(p);
    return;
  }

  p.ducking = true;
  p.slideTimer += dt;

  if (p.slideState === "entering") {
    while (p.slideTimer >= SLIDE_ACTION.enterFrameTime) {
      p.slideTimer -= SLIDE_ACTION.enterFrameTime;
      if (p.slideFrame < SLIDE_ACTION.holdFrame) {
        p.slideFrame += 1;
      }
      if (p.slideFrame === SLIDE_ACTION.holdFrame) {
        if (p.downHeld && !p.slideReleaseQueued) {
          p.slideState = "holding";
          p.slideTimer = 0;
        } else {
          p.slideState = "exiting";
          p.slideTimer = 0;
        }
        break;
      }
    }
    return;
  }

  if (p.slideState === "holding") {
    p.slideFrame = SLIDE_ACTION.holdFrame;
    p.slideTimer = 0;
    return;
  }

  while (p.slideTimer >= SLIDE_ACTION.exitFrameTime) {
    p.slideTimer -= SLIDE_ACTION.exitFrameTime;
    if (p.slideFrame < SLIDE_ACTION.lastFrame) {
      p.slideFrame += 1;
    } else {
      resetSlide(p);
      if (p.downHeld) startSlide(p);
      break;
    }
  }
}

function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt);
  updateClouds(dt);
  updateBirds(dt);
  updateDust(dt);

  if (game.state !== "running") return;

  game.runTime += dt;
  game.distance += game.speed * dt;
  game.score = Math.floor(game.distance / 16);
  game.speed = speedForScore(game.score);

  if (!game.recordCelebrated && game.recordTarget > 0 && game.score > game.recordTarget) {
    game.recordCelebrated = true;
    game.best = game.score;
    celebrateRecord();
  } else if (game.recordCelebrated && game.score > game.best) {
    game.best = game.score;
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
  if (game.state === "running") checkPassedObstacles();
  updateHud();
}

function updatePlayer(dt) {
  const p = game.player;
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.coyote = p.grounded ? 0.075 : Math.max(0, p.coyote - dt);
  p.landing = Math.max(0, p.landing - dt);

  if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
    p.vy = JUMP.velocity;
    p.grounded = false;
    resetSlide(p);
    p.jumpMode = "deciding";
    p.jumpStartedAt = game.time;
    p.jumpVelocityDebt = 0;
    p.jumpPositionDebt = 0;
    if (p.jumpCutQueued) p.jumpHeld = false;
    p.jumpCutQueued = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    spawnDust(p.x + 28, WORLD.ground - 4, 7, "takeoff");
    tone(230, 0.035, 0.018, "square");
    haptic(8);
  }

  if (!p.grounded) {
    const fastFalling = p.downHeld || game.time < p.fastFallUntil;
    const jumpElapsed = game.time - p.jumpStartedAt;
    if (p.jumpMode === "deciding" && jumpElapsed >= JUMP.decisionTime) {
      if (p.jumpHeld) {
        commitHighJump(p);
      } else {
        p.jumpMode = "small";
        p.jumpVelocityDebt = 0;
        p.jumpPositionDebt = 0;
      }
    }
    const rising = p.vy < 0;
    const shapingSmallArc =
      rising &&
      p.jumpMode === "deciding" &&
      jumpElapsed >= JUMP.smallArcTime;
    const gravity = fastFalling
      ? JUMP.fastFallGravity
      : rising && (p.jumpMode === "small" || shapingSmallArc)
        ? JUMP.smallRiseGravity
        : rising
          ? JUMP.heldGravity
          : JUMP.releasedGravity;
    p.vy += gravity * dt;
    p.y += p.vy * dt;
    if (shapingSmallArc && !fastFalling) {
      p.jumpVelocityDebt += (JUMP.smallRiseGravity - JUMP.heldGravity) * dt;
      p.jumpPositionDebt += p.jumpVelocityDebt * dt;
    }

    if (p.y >= WORLD.ground) {
      const hardLanding = p.vy > 520;
      p.y = WORLD.ground;
      p.vy = 0;
      p.grounded = true;
      p.jumpHeld = false;
      p.jumpCutQueued = false;
      p.jumpMode = "ground";
      p.jumpStartedAt = 0;
      p.jumpVelocityDebt = 0;
      p.jumpPositionDebt = 0;
      p.landing = hardLanding ? 0.09 : 0.04;
      if (p.downHeld) startSlide(p);
      spawnDust(p.x + 46, WORLD.ground - 4, hardLanding ? 10 : 7, "landing");
      if (game.clearChimePending) {
        game.clearChimePending = false;
        playObstacleClearChime();
      }
    }
  }

  updateSlide(p, dt);

  p.dustTimer = Math.max(0, p.dustTimer - dt);
  if (p.grounded && game.state === "running" && game.runTime > 0.2 && p.dustTimer <= 0) {
    if (p.ducking) {
      spawnDust(p.x - 20, WORLD.ground - 5, 3, "slide");
      p.dustTimer = 0.078;
    } else {
      spawnDust(p.x + 20, WORLD.ground - 3, 2, "step");
      p.dustTimer = Math.max(0.095, 0.135 - (game.speed - 410) / 7500);
    }
  }
}

function speedForScore(score) {
  return 410 + 370 * (1 - Math.exp(-Math.max(0, score) / 2600));
}

function availableObstacleKinds(score) {
  const choices = ["chestnut", "bramble"];
  if (score > 70) choices.push("stump", "backpack");
  if (score > 150) choices.push("branch");
  return choices;
}

function chooseObstacleKind(score) {
  const choices = availableObstacleKinds(score);
  const pool =
    game.sameObstacleStreak >= 2 && game.lastObstacle
      ? choices.filter((choice) => choice !== game.lastObstacle)
      : choices;
  return pool[Math.floor(Math.random() * pool.length)];
}

function chooseGapType() {
  const roll = Math.random();
  if (game.lastGapType === "short") {
    return roll < 0.64 ? "normal" : "long";
  }
  if (roll < 0.2) return "short";
  if (roll < 0.5) return "long";
  return "normal";
}

function chooseGapSeconds(type, currentKind, nextKind) {
  if (type === "short") {
    const needsRecovery =
      currentKind === "branch" ||
      nextKind === "branch" ||
      isHighObstacle(currentKind) ||
      isHighObstacle(nextKind);
    return needsRecovery ? random(0.82, 1.02) : random(0.66, 0.88);
  }
  if (type === "long") return random(1.65, 2.35);
  return random(0.98, 1.42);
}

function spawnObstacle() {
  const kind = game.nextObstacleKind || chooseObstacleKind(game.score);
  const obstacle = makeObstacle(kind);
  obstacle.x = view.worldWidth + 55;
  obstacle.passed = false;
  game.obstacles.push(obstacle);

  if (kind === game.lastObstacle) {
    game.sameObstacleStreak += 1;
  } else {
    game.sameObstacleStreak = 1;
  }
  game.lastObstacle = kind;

  const nextKind = chooseObstacleKind(game.score);
  const gapType = chooseGapType();
  const gapSeconds = chooseGapSeconds(gapType, kind, nextKind);
  obstacle.gapAfter = gapType;
  obstacle.gapSeconds = gapSeconds;
  game.nextObstacleKind = nextKind;
  game.lastGapType = gapType;
  game.nextSpawn = game.distance + obstacle.w + game.speed * gapSeconds;
}

function isHighObstacle(kind) {
  return kind === "stump" || kind === "backpack";
}

function makeObstacle(kind) {
  if (kind === "chestnut") {
    return { kind, x: 0, y: WORLD.ground - 34, w: 94, h: 34, hit: [20, 14, 54, 18], phase: 0 };
  }
  if (kind === "bramble") {
    return { kind, x: 0, y: WORLD.ground - 33, w: 87, h: 33, hit: [18, 14, 51, 18], phase: 0 };
  }
  if (kind === "stump") {
    return { kind, x: 0, y: WORLD.ground - 102, w: 95, h: 102, hit: [4, 6, 87, 96], phase: 0 };
  }
  if (kind === "backpack") {
    return { kind, x: 0, y: WORLD.ground - 100, w: 77, h: 100, hit: [4, 4, 69, 96], phase: 0 };
  }
  return { kind: "branch", x: 0, y: -18, w: 110, h: 265, hit: [8, 0, 96, 265], phase: 0 };
}

function checkCollisions() {
  const playerBox = getPlayerBox();
  for (const obstacle of game.obstacles) {
    const obstacleBox = getObstacleBox(obstacle);
    if (overlap(playerBox, obstacleBox)) {
      endRun();
      return;
    }
  }
}

function getObstacleBox(obstacle) {
  const [hx, hy, hw, hh] = obstacle.hit;
  return {
    x: obstacle.x + hx,
    y: obstacle.y + hy,
    w: hw,
    h: hh,
  };
}

function checkPassedObstacles() {
  const playerBox = getPlayerBox();
  for (const obstacle of game.obstacles) {
    if (obstacle.passed) continue;
    const obstacleBox = getObstacleBox(obstacle);
    if (obstacleBox.x + obstacleBox.w < playerBox.x) {
      obstacle.passed = true;
      if (game.player.grounded) {
        playObstacleClearChime();
      } else {
        game.clearChimePending = true;
      }
    }
  }
}

function getPlayerBox() {
  const p = game.player;
  if (p.ducking) {
    const frameHeights = [70, 70, 53, 44, 50, 60];
    const height = frameHeights[p.slideFrame] || 44;
    return { x: p.x - 4, y: p.y - height, w: 120, h: height - 4 };
  }
  return { x: p.x + 12, y: p.y - 76, w: 94, h: 70 };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildClouds() {
  game.clouds = Array.from({ length: 4 }, (_, index) => ({
    x: index * 340 + random(80, 230),
    lane: random(0.08, 0.94),
    scale: random(0.72, 1.12),
  }));
}

function updateClouds(dt) {
  for (const cloud of game.clouds) {
    const drift = game.state === "running" ? game.speed * 0.045 : 8;
    cloud.x -= drift * dt;
    if (cloud.x < -100) {
      cloud.x = view.worldWidth + random(120, 360);
      cloud.lane = random(0.08, 0.94);
    }
  }
}

function buildBirds() {
  game.birds.length = 0;
  game.nextBirdAt = game.time + random(6, 10);
}

function updateBirds(dt) {
  if (game.birds.length === 0 && game.time >= game.nextBirdAt) {
    game.birds.push({
      x: view.worldWidth + 70,
      lane: random(0.08, 0.86),
      count: Math.random() < 0.58 ? 2 : 3,
      speed: random(18, 25),
      phase: random(0, 6),
    });
  }

  for (const flock of game.birds) {
    const parallax = game.state === "running" ? game.speed * 0.012 : 4;
    flock.x -= (flock.speed + parallax) * dt;
    flock.phase += dt * 4.2;
  }

  if (game.birds.length > 0 && game.birds[0].x < -105) {
    game.birds.length = 0;
    game.nextBirdAt = game.time + random(13, 20);
  }
}

function spawnDust(x, y, count, kind = "step") {
  const presets = {
    step: { spread: 9, vx: [-72, -24], vy: [-32, -10], size: [3, 5.4], life: [0.25, 0.4], alpha: 0.58 },
    slide: { spread: 18, vx: [-108, -34], vy: [-48, -13], size: [5, 9], life: [0.4, 0.64], alpha: 0.74 },
    slideBurst: { spread: 25, vx: [-128, -12], vy: [-66, -18], size: [5.5, 10], life: [0.42, 0.7], alpha: 0.78 },
    takeoff: { spread: 18, vx: [-104, 18], vy: [-54, -16], size: [3.5, 6.5], life: [0.3, 0.5], alpha: 0.64 },
    landing: { spread: 31, vx: [-132, 66], vy: [-62, -18], size: [4, 7.5], life: [0.34, 0.56], alpha: 0.68 },
  };
  const preset = presets[kind] || presets.step;
  for (let i = 0; i < count; i += 1) {
    const life = random(preset.life[0], preset.life[1]);
    const size = random(preset.size[0], preset.size[1]);
    game.dust.push({
      x: x + random(-preset.spread, preset.spread),
      y: y + random(-2, 2),
      vx: random(preset.vx[0], preset.vx[1]),
      vy: random(preset.vy[0], preset.vy[1]),
      w: size * random(1, kind === "slide" || kind === "slideBurst" ? 1.9 : 1.4),
      h: size,
      life,
      maxLife: life,
      alpha: preset.alpha,
      tone: Math.random() < 0.36 ? "light" : "dark",
      kind,
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
  bestHud.textContent = formatScore(game.best);
}

function clearRecordCelebration() {
  window.clearTimeout(recordTimer);
  recordTimer = 0;
  bestStat?.classList.remove("is-record");
  if (recordSpark) {
    recordSpark.classList.remove("is-active");
    recordSpark.hidden = true;
  }
}

function celebrateRecord() {
  clearRecordCelebration();
  if (recordSpark) {
    recordSpark.hidden = false;
    void recordSpark.offsetWidth;
    recordSpark.classList.add("is-active");
  }
  bestStat?.classList.add("is-record");
  playRecordChime();
  haptic([12, 28, 12]);
  recordTimer = window.setTimeout(clearRecordCelebration, 1050);
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
  drawDust(colors);
  drawDomi();
}

function drawSky(colors) {
  drawBirds(colors.bird);

  for (const cloud of game.clouds) {
    const x = Math.round(cloud.x);
    const y = Math.round(skyLaneY(cloud.lane));
    const unit = Math.max(2, Math.round(3 * cloud.scale));
    ctx.fillStyle = colors.cloud;
    ctx.fillRect(x + unit * 2, y, unit * 8, unit);
    ctx.fillRect(x + unit, y + unit, unit * 11, unit);
    ctx.fillRect(x, y + unit * 2, unit * 13, unit);
    ctx.fillRect(x + unit * 2, y + unit * 3, unit * 9, unit);
    ctx.fillStyle = colors.cloudShade;
    ctx.fillRect(x + unit * 3, y + unit * 3, unit * 7, unit);
  }

  drawPixelSun(colors);
}

function drawBirds(color) {
  ctx.fillStyle = color;
  for (const flock of game.birds) {
    for (let index = 0; index < flock.count; index += 1) {
      const x = Math.round(flock.x - index * 19);
      const y = Math.round(skyLaneY(flock.lane, true) + (index === 1 ? 8 : index === 2 ? 3 : 0));
      const flap = Math.floor(flock.phase + index * 0.7) % 3;
      drawDistantBird(x, y, flap);
    }
  }
}

function drawDistantBird(x, y, flap) {
  ctx.fillRect(x + 5, y + 4, 4, 2);
  if (flap === 0) {
    ctx.fillRect(x + 1, y, 4, 2);
    ctx.fillRect(x + 3, y + 2, 3, 2);
    ctx.fillRect(x + 9, y, 4, 2);
    ctx.fillRect(x + 8, y + 2, 3, 2);
  } else if (flap === 1) {
    ctx.fillRect(x + 1, y + 3, 5, 2);
    ctx.fillRect(x + 8, y + 3, 5, 2);
  } else {
    ctx.fillRect(x + 2, y + 5, 4, 2);
    ctx.fillRect(x + 3, y + 7, 3, 2);
    ctx.fillRect(x + 8, y + 5, 4, 2);
    ctx.fillRect(x + 8, y + 7, 3, 2);
  }
}

function skyLaneY(lane, isBird = false) {
  const top = Math.max(132, Math.min(168, view.height * 0.19));
  const span = Math.max(54, Math.min(isBird ? 78 : 102, view.height * 0.125));
  const screenY = top + span * lane;
  return (screenY - view.offsetY) / view.scale;
}

function drawPixelSun(colors) {
  const pulse = Math.floor(game.time * 1.6) % 2;
  const x = Math.round(view.worldWidth - 112);
  const y = Math.round(skyLaneY(0.03) - 2);

  ctx.fillStyle = colors.sunShade;
  ctx.fillRect(x + 10, y + 5, 16, 30);
  ctx.fillRect(x + 5, y + 10, 26, 20);

  ctx.fillStyle = colors.sun;
  ctx.fillRect(x + 11, y + 7, 14, 26);
  ctx.fillRect(x + 7, y + 11, 22, 18);

  ctx.fillStyle = colors.sunLight;
  ctx.fillRect(x + 11, y + 11, 7, 4);
  ctx.fillRect(x + 9, y + 16, 3, 7);

  const ray = pulse ? 1 : 0;
  ctx.fillStyle = colors.sun;
  ctx.fillRect(x + 16, y - 3 - ray, 4, 6);
  ctx.fillRect(x + 16, y + 37 + ray, 4, 6);
  ctx.fillRect(x - 3 - ray, y + 18, 6, 4);
  ctx.fillRect(x + 33 + ray, y + 18, 6, 4);
  ctx.fillRect(x + 2 - ray, y + 4 - ray, 4, 4);
  ctx.fillRect(x + 30 + ray, y + 4 - ray, 4, 4);
  ctx.fillRect(x + 2 - ray, y + 32 + ray, 4, 4);
  ctx.fillRect(x + 30 + ray, y + 32 + ray, 4, 4);
}

function drawGround(colors) {
  const visibleBottom = (view.height - view.offsetY) / view.scale;
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, WORLD.ground + 3, view.worldWidth, Math.max(4, visibleBottom - WORLD.ground + 12));

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
    if (obstacle.kind === "branch") {
      drawLowBranch(x, colors, obstacle.phase);
    } else {
      drawObstacleSprite(obstacle, x);
    }
  }
}

function drawObstacleSprite(obstacle, x) {
  const sprite = OBSTACLE_SPRITES[obstacle.kind];
  if (!sprite || !obstacleSheet.complete || !obstacleSheet.naturalWidth) return;

  ctx.drawImage(
    obstacleSheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    x,
    obstacle.y,
    obstacle.w,
    obstacle.h,
  );
}

function drawLowBranch(x, colors, phase) {
  const sway = Math.round(Math.sin(phase) * 2);
  const bottom = WORLD.ground - 58;

  ctx.fillStyle = colors.branch;
  ctx.fillRect(x + 76, -18, 18, bottom + 18);
  ctx.fillRect(x + 57, 88, 25, 12);
  ctx.fillRect(x + 35, 129, 48, 12);
  ctx.fillRect(x + 13, 174, 70, 13);
  ctx.fillRect(x + 2, bottom - 19, 86, 19);
  ctx.fillStyle = colors.branchLight;
  ctx.fillRect(x + 80, -18, 5, bottom + 11);
  ctx.fillRect(x + 20, bottom - 16, 58, 4);

  ctx.fillStyle = colors.leaf;
  ctx.fillRect(x + 50 + sway, 58, 28, 17);
  ctx.fillRect(x + 84 - sway, 82, 25, 18);
  ctx.fillRect(x + 28 - sway, 111, 31, 18);
  ctx.fillRect(x + 66 + sway, 145, 37, 20);
  ctx.fillRect(x + 7 + sway, 158, 33, 20);
  ctx.fillRect(x + 44 - sway, bottom - 48, 39, 21);
  ctx.fillStyle = colors.leafLight;
  ctx.fillRect(x + 58 + sway, 63, 14, 6);
  ctx.fillRect(x + 35 - sway, 116, 16, 6);
  ctx.fillRect(x + 74 + sway, 151, 18, 6);
  ctx.fillRect(x + 14 + sway, 164, 17, 6);
  ctx.fillRect(x + 53 - sway, bottom - 42, 20, 6);
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

  if (game.state === "running" && p.grounded && p.ducking && slideRunSheet.complete && slideRunSheet.naturalWidth) {
    const frameIndex = p.slideFrame;
    const frame = SLIDE_RUN_SPRITES[frameIndex];
    const width = Math.round(frame.w * SLIDE_SCALE);
    const height = Math.round(frame.h * SLIDE_SCALE);
    const rightAnchor = p.x + PLAYER.width - 2;
    const dx = Math.round(rightAnchor - width);
    const dy = Math.round(p.y - height * squash);

    ctx.drawImage(
      slideRunSheet,
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
    maxH = PLAYER.slideHeight;
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

function drawDust(colors) {
  for (const dust of game.dust) {
    const fade = Math.min(1, dust.life / Math.max(0.001, dust.maxLife * 0.42));
    ctx.globalAlpha = dust.alpha * fade;
    ctx.fillStyle = dust.tone === "light" ? colors.dustLight : colors.dust;
    const x = Math.round(dust.x);
    const y = Math.round(dust.y);
    const width = Math.max(2, Math.round(dust.w));
    const height = Math.max(2, Math.round(dust.h));
    ctx.fillRect(x, y, width, height);
    if ((dust.kind === "slide" || dust.kind === "slideBurst") && width >= 7) {
      ctx.globalAlpha *= 0.72;
      ctx.fillRect(x + Math.max(2, Math.round(width * 0.55)), y - 3, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function ensureAudioGraph() {
  if (audioContext) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  audioContext = new AudioCtor();
  audioMaster = audioContext.createGain();
  musicBus = audioContext.createGain();
  sfxBus = audioContext.createGain();
  const compressor = audioContext.createDynamicsCompressor();

  audioMaster.gain.value = soundEnabled ? 0.88 : 0.0001;
  musicBus.gain.value = 0.0001;
  sfxBus.gain.value = 1;
  compressor.threshold.value = -22;
  compressor.knee.value = 20;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.22;

  musicBus.connect(audioMaster);
  sfxBus.connect(audioMaster);
  audioMaster.connect(compressor);
  compressor.connect(audioContext.destination);
}

function unlockAudio() {
  ensureAudioGraph();
  if (!audioContext) return;

  const resume = audioContext.state === "suspended" ? audioContext.resume() : Promise.resolve();
  resume
    .then(() => {
      if (soundEnabled && game.state === "running") startMusic();
    })
    .catch(() => {});
}

function updateSoundButton() {
  if (!soundBtn) return;
  soundBtn.classList.toggle("is-muted", !soundEnabled);
  soundBtn.setAttribute("aria-pressed", String(soundEnabled));
  const label = soundEnabled ? "关闭声音" : "开启声音";
  soundBtn.setAttribute("aria-label", label);
  soundBtn.title = label;
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  updateSoundButton();

  if (!enabled) {
    stopMusic(0.08);
    if (audioContext && audioMaster) {
      const now = audioContext.currentTime;
      audioMaster.gain.cancelScheduledValues(now);
      audioMaster.gain.setValueAtTime(Math.max(0.0001, audioMaster.gain.value), now);
      audioMaster.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    }
    return;
  }

  unlockAudio();
  if (audioContext && audioMaster) {
    const now = audioContext.currentTime;
    audioMaster.gain.cancelScheduledValues(now);
    audioMaster.gain.setValueAtTime(Math.max(0.0001, audioMaster.gain.value), now);
    audioMaster.gain.exponentialRampToValueAtTime(0.88, now + 0.08);
  }
}

function startMusic() {
  if (!soundEnabled || !audioContext || audioContext.state !== "running" || game.state !== "running") return;
  if (musicPlayback.timer) return;

  const now = audioContext.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), now);
  musicBus.gain.exponentialRampToValueAtTime(0.82, now + 0.18);
  musicPlayback.step = 0;
  musicPlayback.nextTime = now + 0.06;
  scheduleMusic();
  musicPlayback.timer = window.setInterval(scheduleMusic, 80);
}

function stopMusic(fade = 0.18) {
  window.clearInterval(musicPlayback.timer);
  musicPlayback.timer = 0;
  if (!audioContext || !musicBus) return;

  const now = audioContext.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), now);
  if (fade > 0) {
    musicBus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  } else {
    musicBus.gain.setValueAtTime(0.0001, now);
  }
}

function scheduleMusic() {
  if (!audioContext || audioContext.state !== "running" || game.state !== "running" || !soundEnabled) {
    stopMusic(0.08);
    return;
  }

  if (musicPlayback.nextTime < audioContext.currentTime - 0.4) {
    musicPlayback.nextTime = audioContext.currentTime + 0.05;
  }

  while (musicPlayback.nextTime < audioContext.currentTime + 0.34) {
    scheduleMusicStep(musicPlayback.step, musicPlayback.nextTime);
    musicPlayback.step = (musicPlayback.step + 1) % MUSIC_MELODY.length;
    musicPlayback.nextTime += MUSIC_STEP_SECONDS;
  }
}

function scheduleMusicStep(step, startTime) {
  const bar = Math.floor(step / 8) % MUSIC_BASS_ROOTS.length;
  const stepInBar = step % 8;
  const root = MUSIC_BASS_ROOTS[bar];
  const melody = MUSIC_MELODY[step];

  if (stepInBar === 0 || stepInBar === 4) {
    const bassNote = stepInBar === 0 ? root : root + 7;
    scheduleMusicVoice(midiToFrequency(bassNote), startTime, 0.4, 0.025, "triangle", 680);
    scheduleKick(startTime, stepInBar === 0 ? 0.022 : 0.015);
  }

  if (melody !== null) {
    scheduleMusicVoice(midiToFrequency(melody), startTime, 0.19, 0.016, "square", 1750);
  }
}

function scheduleMusicVoice(frequency, startTime, duration, volume, type, cutoff) {
  if (!audioContext || !musicBus) return;
  const oscillator = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, startTime);
  filter.Q.value = 0.65;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(musicBus);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.025);
}

function scheduleKick(startTime, volume) {
  if (!audioContext || !musicBus) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(118, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(54, startTime + 0.1);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);
  oscillator.connect(gain);
  gain.connect(musicBus);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.13);
}

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function tone(frequency, duration, volume, type, delay = 0) {
  if (!soundEnabled || !audioContext || audioContext.state !== "running" || !sfxBus) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const startTime = audioContext.currentTime + delay;
  const endTime = startTime + duration;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + Math.min(0.008, duration * 0.15));
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  oscillator.connect(gain);
  gain.connect(sfxBus);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

function playRecordChime() {
  tone(783.99, 0.18, 0.035, "triangle");
  tone(987.77, 0.2, 0.032, "triangle", 0.08);
  tone(1174.66, 0.28, 0.03, "sine", 0.16);
}

function playObstacleClearChime() {
  tone(587.33, 0.065, 0.022, "square");
  tone(783.99, 0.1, 0.018, "triangle", 0.045);
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

function clearPointerFrame() {
  cancelAnimationFrame(pointerGesture.commitFrame);
  pointerGesture.commitFrame = 0;
}

function resetPointerGesture() {
  clearPointerFrame();
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

  pointerGesture.commitFrame = requestAnimationFrame(() => {
    if (!pointerGesture.active || pointerGesture.mode !== "pending") return;
    pointerGesture.mode = "jump";
    pressJump();
  });
}

function movePointerGesture(event) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return;

  const dx = event.clientX - pointerGesture.startX;
  const dy = event.clientY - pointerGesture.startY;
  const isDownSwipe = dy >= INPUT.swipeDistance && dy > Math.abs(dx) * 1.15;
  if (!isDownSwipe || pointerGesture.mode === "duck") return;

  event.preventDefault();
  clearPointerFrame();
  const p = game.player;
  const isFreshJump =
    pointerGesture.mode === "jump" &&
    performance.now() - pointerGesture.startedAt < 120 &&
    !p.grounded &&
    p.vy < 0;
  if (isFreshJump) {
    p.y = WORLD.ground;
    p.vy = 0;
    p.grounded = true;
    p.jumpBuffer = 0;
    p.jumpHeld = false;
    p.jumpCutQueued = false;
    p.jumpMode = "ground";
    p.jumpStartedAt = 0;
    p.landing = 0;
  }
  pointerGesture.mode = "duck";
  pointerGesture.duckStartedAt = performance.now();
  releaseJump();
  pressDown();
}

function finishPointerGesture(event) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return;

  if (pointerGesture.mode === "pending") {
    clearPointerFrame();
    pressJump();
    releaseJump();
  } else if (pointerGesture.mode === "jump") {
    releaseJump();
  } else if (pointerGesture.mode === "duck") {
    releaseDown();
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
}

function releaseJumpKey() {
  jumpKeyHeld = false;
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
    if (soundEnabled) {
      if (audioContext?.state === "suspended") {
        audioContext.resume().then(startMusic).catch(() => {});
      } else {
        startMusic();
      }
    }
  } else {
    stopMusic(0.1);
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

soundBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setSoundEnabled(!soundEnabled);
});

restartBtn.addEventListener("click", () => {
  unlockAudio();
  beginRun(false);
});

resize();
buildClouds();
buildBirds();
updateSoundButton();
resetRun();
window.__domiRun = game;
requestAnimationFrame(loop);
