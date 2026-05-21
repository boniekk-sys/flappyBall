/**
 * Bouncing Ball — side-scrolling endless runner.
 * The ball runs forward; the camera follows smoothly.
 * Press SPACE (or tap) to jump over obstacles.
 */

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const gameArea = document.getElementById("gameArea");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("finalScore");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// ----- Display size (logical pixels) -----
const WIDTH = 480;
const HEIGHT = 320;

// ----- Physics & pacing (kept slow and smooth) -----
const GRAVITY = 0.38;
const JUMP_FORCE = -7.8;
const RUN_SPEED = 2.6;
const BALL_RADIUS = 18;
const GROUND_HEIGHT = 56;
const CAMERA_LERP = 0.07;

// Ball stays near this screen X; world scrolls past
const BALL_SCREEN_X = 110;

const ball = {
  worldY: 0,
  vy: 0,
  onGround: false,
};

let state = "ready";
let score = 0;
let distance = 0;
let cameraX = 0;
let targetCameraX = 0;
let lastTime = 0;
let spawnTimer = 0;
const obstacles = [];

// Decorative background hills (world positions)
const hills = [];
for (let i = 0; i < 12; i++) {
  hills.push({ x: i * 180, h: 40 + Math.random() * 50 });
}

/**
 * Resize canvas for crisp rendering on high-DPI screens.
 */
function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(
    dpr * (rect.width / WIDTH),
    0,
    0,
    dpr * (rect.height / HEIGHT),
    0,
    0
  );
}

function getGroundY() {
  return HEIGHT - GROUND_HEIGHT;
}

function resetGame() {
  ball.worldY = 0;
  ball.vy = 0;
  ball.onGround = true;
  score = 0;
  distance = 0;
  cameraX = 0;
  targetCameraX = 0;
  spawnTimer = 0;
  obstacles.length = 0;
  scoreEl.textContent = "0";
}

function startGame() {
  resetGame();
  state = "playing";
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  lastTime = performance.now();
}

function endGame() {
  state = "dead";
  finalScoreEl.textContent = score;
  gameOverOverlay.classList.remove("hidden");
}

/**
 * Jump when on the ground (or close to it for forgiving feel).
 */
function jump() {
  if (state === "ready") {
    startGame();
    ball.vy = JUMP_FORCE;
    ball.onGround = false;
    return;
  }
  if (state !== "playing") return;
  if (ball.onGround) {
    ball.vy = JUMP_FORCE;
    ball.onGround = false;
  }
}

/** Obstacle types: low, medium, tall blocks to jump over */
const OBSTACLE_TYPES = [
  { w: 28, h: 32, color: "#00c8d8" },
  { w: 36, h: 48, color: "#7b5cff" },
  { w: 42, h: 64, color: "#ff5588" },
  { w: 50, h: 38, color: "#00f5ff" },
];

function spawnObstacle() {
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  const groundY = getGroundY();
  const spawnX = cameraX + WIDTH + 80 + Math.random() * 60;

  obstacles.push({
    worldX: spawnX,
    y: groundY - type.h,
    w: type.w,
    h: type.h,
    color: type.color,
    scored: false,
  });
}

/**
 * Circle vs axis-aligned rectangle collision.
 */
function hitsObstacle() {
  const groundY = getGroundY();
  const ballWorldX = cameraX + BALL_SCREEN_X;
  const bob = state === "ready" ? Math.sin(performance.now() / 400) * 4 : 0;
  const ballY = groundY - BALL_RADIUS + ball.worldY + bob;

  if (ballY + BALL_RADIUS > groundY + 4) {
    return true;
  }

  for (const obs of obstacles) {
    if (
      circleRectCollision(
        ballWorldX,
        ballY,
        BALL_RADIUS,
        obs.worldX,
        obs.y,
        obs.w,
        obs.h
      )
    ) {
      return true;
    }
  }
  return false;
}

function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function update(dt) {
  if (state !== "playing") return;

  distance += RUN_SPEED;
  targetCameraX = distance;

  // Smooth camera follow
  cameraX += (targetCameraX - cameraX) * CAMERA_LERP;

  // Ball physics (worldY: 0 = on ground, negative = up)
  ball.vy += GRAVITY;
  ball.worldY += ball.vy;

  const floorY = 0;
  if (ball.worldY >= floorY) {
    ball.worldY = floorY;
    ball.vy = 0;
    ball.onGround = true;
  } else {
    ball.onGround = false;
  }

  // Fall off the bottom of the play area
  if (ball.worldY > 120) {
    endGame();
    return;
  }

  spawnTimer += dt;
  const spawnInterval = Math.max(1.4, 2.2 - score * 0.04);
  if (spawnTimer >= spawnInterval) {
    spawnObstacle();
    spawnTimer = 0;
  }

  const ballWorldX = cameraX + BALL_SCREEN_X;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    if (!obs.scored && obs.worldX + obs.w < ballWorldX - BALL_RADIUS) {
      obs.scored = true;
      score++;
      scoreEl.textContent = score;
    }
    if (obs.worldX < cameraX - 100) {
      obstacles.splice(i, 1);
    }
  }

  if (hitsObstacle()) {
    endGame();
  }
}

function worldToScreen(worldX) {
  return worldX - cameraX;
}

function draw() {
  setupCanvas();
  const groundY = getGroundY();
  const ballWorldX = cameraX + BALL_SCREEN_X;
  const ballScreenX = BALL_SCREEN_X;
  const bob = state === "ready" ? Math.sin(performance.now() / 400) * 4 : 0;
  const ballY = groundY - BALL_RADIUS + ball.worldY + bob;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#0c0c18");
  sky.addColorStop(1, "#141428");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Parallax hills
  hills.forEach((hill) => {
    const sx = worldToScreen(hill.x) * 0.4;
    ctx.fillStyle = "rgba(179, 102, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx + 90, groundY - hill.h);
    ctx.lineTo(sx + 180, groundY);
    ctx.fill();
  });

  // Ground
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, groundY, WIDTH, GROUND_HEIGHT);
  ctx.strokeStyle = "rgba(0, 245, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(WIDTH, groundY);
  ctx.stroke();

  // Obstacles
  obstacles.forEach((obs) => {
    const sx = worldToScreen(obs.worldX);
    if (sx > WIDTH + 60 || sx + obs.w < -60) return;

    ctx.fillStyle = obs.color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(sx, obs.y, obs.w, obs.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(sx + 4, obs.y + 4, obs.w - 8, 6);
  });

  // Ball
  const grad = ctx.createRadialGradient(
    ballScreenX - 5,
    ballY - 5,
    2,
    ballScreenX,
    ballY,
    BALL_RADIUS
  );
  grad.addColorStop(0, "#ff88aa");
  grad.addColorStop(1, "#ff2244");
  ctx.beginPath();
  ctx.arc(ballScreenX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "#ff3366";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (state === "playing") {
    update(dt);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    jump();
  }
});

gameArea.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  e.preventDefault();
  jump();
});

startBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  jump();
});

restartBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startGame();
  ball.vy = JUMP_FORCE;
  ball.onGround = false;
});

window.addEventListener("resize", setupCanvas);

resetGame();
setupCanvas();
lastTime = performance.now();
requestAnimationFrame(gameLoop);
