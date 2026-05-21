/**
 * Neon Flap — Flappy Bird-style game with a red ball.
 * Uses requestAnimationFrame, canvas rendering, and Web Audio for sounds.
 */

// ----- DOM -----
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameArea = document.getElementById("gameArea");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const finalScoreEl = document.getElementById("finalScore");
const finalBestEl = document.getElementById("finalBest");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// ----- Logical game size (portrait, mobile-friendly) -----
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;

// ----- Physics -----
const GRAVITY = 0.42;
const JUMP_FORCE = -7.5;
const BALL_RADIUS = 18;

// ----- Pipes -----
const PIPE_WIDTH = 58;
const PIPE_GAP_START = 155;
const PIPE_GAP_MIN = 115;
const PIPE_SPAWN_INTERVAL = 1.65;
const PIPE_SPEED_BASE = 2.4;

// ----- State -----
let state = "ready"; // ready | playing | dead
let score = 0;
let bestScore = 0;
let lastTime = 0;
let pipeTimer = 0;
let difficulty = 0;
let animationId = null;

const ball = { x: 90, y: GAME_HEIGHT / 2, vy: 0, rotation: 0 };
const pipes = [];
const particles = [];

// Parallax star layers (x offset scrolls with game)
const parallax = [
  { speed: 0.15, stars: [] },
  { speed: 0.35, stars: [] },
  { speed: 0.6, stars: [] },
];

// ----- Audio (simple synthesized sounds, no files needed) -----
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = "sine", volume = 0.12) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function soundJump() {
  playTone(520, 0.08, "sine", 0.1);
}

function soundScore() {
  playTone(880, 0.1, "square", 0.08);
}

function soundHit() {
  playTone(120, 0.25, "sawtooth", 0.15);
}

// ----- Best score persistence -----
function loadBestScore() {
  const saved = localStorage.getItem("neonFlapBest");
  bestScore = saved ? parseInt(saved, 10) : 0;
  bestScoreEl.textContent = bestScore;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("neonFlapBest", String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
}

// ----- Canvas sizing: map logical 400×600 coords to screen pixels -----
function setupContext() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(
    dpr * (rect.width / GAME_WIDTH),
    0,
    0,
    dpr * (rect.height / GAME_HEIGHT),
    0,
    0
  );
}

// ----- Parallax background stars -----
function initParallax() {
  parallax.forEach((layer) => {
    layer.stars = [];
    const count = layer.speed < 0.3 ? 25 : layer.speed < 0.5 ? 18 : 12;
    for (let i = 0; i < count; i++) {
      layer.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: 1 + Math.random() * 2 * layer.speed,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }
  });
}

function updateParallax(dt) {
  parallax.forEach((layer) => {
    const move = layer.speed * 60 * dt;
    layer.stars.forEach((star) => {
      star.x -= move;
      if (star.x < 0) {
        star.x = GAME_WIDTH;
        star.y = Math.random() * GAME_HEIGHT;
      }
    });
  });
}

// ----- Particles -----
function spawnParticles(x, y, count, color, speed = 4) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.5 + Math.random());
    const life = 0.4 + Math.random() * 0.35;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life,
      maxLife: life,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ----- Pipes -----
function getPipeGap() {
  const shrink = Math.min(difficulty * 4, PIPE_GAP_START - PIPE_GAP_MIN);
  return PIPE_GAP_START - shrink;
}

function getPipeSpeed() {
  return PIPE_SPEED_BASE + difficulty * 0.08;
}

function spawnPipe() {
  const gap = getPipeGap();
  const margin = 60;
  const maxTop = GAME_HEIGHT - margin - gap - margin;
  const topHeight = margin + Math.random() * Math.max(40, maxTop - margin);

  pipes.push({
    x: GAME_WIDTH + PIPE_WIDTH,
    topHeight,
    gap,
    scored: false,
  });
}

// ----- Collision -----
function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function checkCollisions() {
  // Ceiling and floor
  if (ball.y - BALL_RADIUS <= 0 || ball.y + BALL_RADIUS >= GAME_HEIGHT) {
    return true;
  }

  for (const pipe of pipes) {
    const bottomY = pipe.topHeight + pipe.gap;
    const hitTop = circleRectCollision(
      ball.x,
      ball.y,
      BALL_RADIUS,
      pipe.x,
      0,
      PIPE_WIDTH,
      pipe.topHeight
    );
    const hitBottom = circleRectCollision(
      ball.x,
      ball.y,
      BALL_RADIUS,
      pipe.x,
      bottomY,
      PIPE_WIDTH,
      GAME_HEIGHT - bottomY
    );
    if (hitTop || hitBottom) return true;
  }
  return false;
}

// ----- Game flow -----
function resetGame() {
  ball.y = GAME_HEIGHT / 2;
  ball.vy = 0;
  ball.rotation = 0;
  pipes.length = 0;
  particles.length = 0;
  score = 0;
  pipeTimer = 0;
  difficulty = 0;
  scoreEl.textContent = "0";
}

function startGame() {
  initAudio();
  resetGame();
  state = "playing";
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function flap() {
  if (state === "ready") {
    startGame();
    ball.vy = JUMP_FORCE;
    soundJump();
    spawnParticles(ball.x, ball.y + BALL_RADIUS, 8, "#ff6688", 3);
    return;
  }
  if (state !== "playing") return;
  ball.vy = JUMP_FORCE;
  soundJump();
  spawnParticles(ball.x, ball.y + BALL_RADIUS, 8, "#ff6688", 3);
}

function endGame() {
  state = "dead";
  soundHit();
  spawnParticles(ball.x, ball.y, 24, "#ff3366", 6);
  saveBestScore();
  finalScoreEl.textContent = score;
  finalBestEl.textContent = bestScore;
  gameOverOverlay.classList.remove("hidden");
}

// ----- Update -----
function update(dt) {
  if (state !== "playing") {
    updateParticles(dt);
    updateParallax(dt * 0.3);
    return;
  }

  difficulty += dt * 0.15;

  ball.vy += GRAVITY;
  ball.y += ball.vy;
  ball.rotation = Math.max(-0.5, Math.min(1.2, ball.vy * 0.08));

  pipeTimer += dt;
  if (pipeTimer >= Math.max(0.9, PIPE_SPAWN_INTERVAL - difficulty * 0.02)) {
    spawnPipe();
    pipeTimer = 0;
  }

  const speed = getPipeSpeed();
  for (let i = pipes.length - 1; i >= 0; i--) {
    const pipe = pipes[i];
    pipe.x -= speed;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < ball.x) {
      pipe.scored = true;
      score++;
      scoreEl.textContent = score;
      soundScore();
      spawnParticles(ball.x + 20, ball.y, 6, "#00f5ff", 2.5);
    }

    if (pipe.x + PIPE_WIDTH < -20) {
      pipes.splice(i, 1);
    }
  }

  if (checkCollisions()) {
    endGame();
  }

  updateParticles(dt);
  updateParallax(dt);
}

// ----- Draw -----
function drawParallax() {
  const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  bg.addColorStop(0, "#0a0a18");
  bg.addColorStop(0.5, "#0f1022");
  bg.addColorStop(1, "#121228");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  parallax.forEach((layer, idx) => {
    const hue = idx === 0 ? "0, 245, 255" : idx === 1 ? "179, 102, 255" : "255, 51, 102";
    layer.stars.forEach((star) => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hue}, ${star.alpha})`;
      ctx.fill();
    });
  });
}

function drawPipes() {
  pipes.forEach((pipe) => {
    const bottomY = pipe.topHeight + pipe.gap;
    const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, GAME_HEIGHT);
    grad.addColorStop(0, "#00c8d8");
    grad.addColorStop(1, "#b366ff");

    ctx.fillStyle = grad;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 14;

    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, GAME_HEIGHT - bottomY);

    // Neon caps on pipe ends
    ctx.fillStyle = "rgba(0, 245, 255, 0.5)";
    ctx.fillRect(pipe.x - 2, pipe.topHeight - 8, PIPE_WIDTH + 4, 8);
    ctx.fillRect(pipe.x - 2, bottomY, PIPE_WIDTH + 4, 8);
    ctx.shadowBlur = 0;
  });
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.rotation);

  const grad = ctx.createRadialGradient(-6, -6, 2, 0, 0, BALL_RADIUS);
  grad.addColorStop(0, "#ff88aa");
  grad.addColorStop(1, "#ff2244");

  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "#ff3366";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawReadyBall() {
  const bob = Math.sin(performance.now() / 400) * 6;
  ball.y = GAME_HEIGHT / 2 + bob;
  drawBall();
}

function draw() {
  setupContext();
  drawParallax();
  drawPipes();
  if (state === "ready") {
    drawReadyBall();
  } else {
    drawBall();
  }
  drawParticles();

  // Large score in center while playing (subtle)
  if (state === "playing" && score > 0) {
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.textAlign = "center";
    ctx.fillText(String(score), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
  }
}

// ----- Main loop -----
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  draw();

  if (state === "playing" || state === "dead" || state === "ready") {
    animationId = requestAnimationFrame(gameLoop);
  }
}

// ----- Input -----
function onAction(e) {
  if (e.type === "keydown" && e.code !== "Space") return;
  if (e.type === "keydown") e.preventDefault();
  flap();
}

document.addEventListener("keydown", onAction);
gameArea.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  e.preventDefault();
  flap();
});
startBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  flap();
});
restartBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startGame();
  ball.vy = JUMP_FORCE;
  soundJump();
});

window.addEventListener("resize", () => {
  setupContext();
});

// ----- Init -----
loadBestScore();
initParallax();
resetGame();
setupContext();
state = "ready";
lastTime = performance.now();
requestAnimationFrame(gameLoop);
