/**
 * Bouncing Ball — red ball with gravity, wall bounces, and click-to-nudge.
 */

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const WIDTH = 480;
const HEIGHT = 320;
const RADIUS = 20;
const GRAVITY = 0.22;
const BOUNCE = 0.86;
const DRAG = 0.999;
const NUDGE_STRENGTH = 5.5;

let paused = false;
let ball = createBall();
let animationId = null;

function createBall() {
  return {
    x: WIDTH * 0.35,
    y: HEIGHT * 0.4,
    vx: 4.2,
    vy: -3.6,
  };
}

/** Resize canvas for sharp rendering on high-DPI screens */
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

function updatePhysics() {
  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < RADIUS) {
    ball.x = RADIUS;
    ball.vx = Math.abs(ball.vx) * BOUNCE;
  } else if (ball.x > WIDTH - RADIUS) {
    ball.x = WIDTH - RADIUS;
    ball.vx = -Math.abs(ball.vx) * BOUNCE;
  }

  if (ball.y < RADIUS) {
    ball.y = RADIUS;
    ball.vy = Math.abs(ball.vy) * BOUNCE;
  } else if (ball.y > HEIGHT - RADIUS) {
    ball.y = HEIGHT - RADIUS;
    ball.vy = -Math.abs(ball.vy) * BOUNCE;
  }

  ball.vx *= DRAG;
  ball.vy *= DRAG;
}

function draw() {
  setupCanvas();

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0d0d18");
  bg.addColorStop(1, "#151525");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(0, 245, 255, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  const grad = ctx.createRadialGradient(
    ball.x - 6,
    ball.y - 6,
    2,
    ball.x,
    ball.y,
    RADIUS
  );
  grad.addColorStop(0, "#ff88aa");
  grad.addColorStop(1, "#ff2244");

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "#ff3366";
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function gameLoop() {
  if (!paused) {
    updatePhysics();
  }
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function nudgeToward(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  const targetX = (clientX - rect.left) * scaleX;
  const targetY = (clientY - rect.top) * scaleY;
  const dx = targetX - ball.x;
  const dy = targetY - ball.y;
  const dist = Math.hypot(dx, dy) || 1;

  ball.vx += (dx / dist) * NUDGE_STRENGTH;
  ball.vy += (dy / dist) * NUDGE_STRENGTH;
}

function reset() {
  ball = createBall();
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  nudgeToward(e.clientX, e.clientY);
});

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

resetBtn.addEventListener("click", reset);

window.addEventListener("resize", setupCanvas);

reset();
setupCanvas();
gameLoop();
