/**
 * Galaxy Drift — modern neon space shooter
 * Mouse-only horizontal control · auto-fire · particles · combos
 */

/* =============================================================================
   CONFIG & DOM
   ============================================================================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startMenu = document.getElementById("startMenu");
const hud = document.getElementById("hud");
const gameOverPanel = document.getElementById("gameOverPanel");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const scoreDisplay = document.getElementById("scoreDisplay");
const comboDisplay = document.getElementById("comboDisplay");
const waveDisplay = document.getElementById("waveDisplay");
const finalScoreEl = document.getElementById("finalScore");
const bestScoreEl = document.getElementById("bestScore");
const eventBanner = document.getElementById("eventBanner");
const comboBlock = document.querySelector(".combo-block");

const COLORS = {
  cyan: "#00f5ff",
  blue: "#4d7cff",
  purple: "#b366ff",
  pink: "#ff4d9e",
  gold: "#ffd54a",
};

const CONFIG = {
  playerYRatio: 0.88,
  playerSmooth: 0.14,
  fireRate: 0.14,
  bulletSpeed: 14,
  baseEnemySpeed: 1.2,
  comboWindow: 2.2,
  shakeDecay: 0.88,
};

let W = 800;
let H = 600;
let state = "menu";
let score = 0;
let bestScore = 0;
let combo = 1;
let comboTimer = 0;
let wave = 1;
let gameTime = 0;
let shake = 0;
let mouseX = W / 2;
let lastTime = 0;
let spawnTimer = 0;
let fireTimer = 0;
let eventTimer = 15;
let meteorTimer = 0;

/* =============================================================================
   AUDIO (Web Audio API — no external files)
   ============================================================================= */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playSound(freq, duration, type = "sine", vol = 0.08, slide = 0) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

const AudioFX = {
  shoot: () => playSound(880, 0.05, "square", 0.04, 1200),
  hit: () => playSound(200, 0.12, "sawtooth", 0.1),
  explode: () => playSound(80, 0.2, "sawtooth", 0.12, 40),
  golden: () => playSound(1200, 0.15, "sine", 0.1, 2000),
  playerHit: () => playSound(60, 0.35, "square", 0.15),
};

/* =============================================================================
   GAME OBJECT POOLS
   ============================================================================= */
const player = { x: 0, displayX: 0, w: 44, h: 36 };
const bullets = [];
const enemies = [];
const particles = [];
const meteors = [];
const bgStars = [];
const bgPlanets = [];
let nebulaPhase = 0;

/* =============================================================================
   BACKGROUND — stars, nebulas, planets
   ============================================================================= */
function initBackground() {
  bgStars.length = 0;
  for (let i = 0; i < 180; i++) {
    bgStars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 2.2,
      speed: 0.2 + Math.random() * 1.2,
      twinkle: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.6 ? "cyan" : Math.random() > 0.5 ? "purple" : "pink",
    });
  }
  bgPlanets.length = 0;
  for (let i = 0; i < 3; i++) {
    bgPlanets.push({
      x: Math.random() * 1.2 - 0.1,
      y: 0.15 + Math.random() * 0.5,
      r: 40 + Math.random() * 80,
      color: i === 0 ? COLORS.purple : i === 1 ? COLORS.blue : COLORS.pink,
      parallax: 0.15 + i * 0.1,
    });
  }
}

function updateBackground(dt) {
  nebulaPhase += dt * 0.15;
  bgStars.forEach((s) => {
    s.y += (s.speed * dt) / H;
    if (s.y > 1) {
      s.y = 0;
      s.x = Math.random();
    }
    s.twinkle += dt * 3;
  });
}

function renderBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#080818");
  grad.addColorStop(0.5, "#0a0520");
  grad.addColorStop(1, "#050510");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Animated nebula blobs
  const blobs = [
    { cx: 0.3, cy: 0.35, r: 220, c: "rgba(179,102,255,0.12)" },
    { cx: 0.75, cy: 0.55, r: 280, c: "rgba(0,245,255,0.08)" },
    { cx: 0.5, cy: 0.2, r: 200, c: "rgba(255,77,158,0.07)" },
  ];
  blobs.forEach((b, i) => {
    const ox = Math.sin(nebulaPhase + i) * 30;
    const oy = Math.cos(nebulaPhase * 0.7 + i) * 20;
    const g = ctx.createRadialGradient(
      b.cx * W + ox,
      b.cy * H + oy,
      0,
      b.cx * W + ox,
      b.cy * H + oy,
      b.r
    );
    g.addColorStop(0, b.c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

  // Distant planets
  bgPlanets.forEach((p) => {
    const px = p.x * W + Math.sin(nebulaPhase * p.parallax) * 20;
    const py = p.y * H;
    const g = ctx.createRadialGradient(px - p.r * 0.3, py - p.r * 0.3, 0, px, py, p.r);
    g.addColorStop(0, p.color + "44");
    g.addColorStop(0.7, p.color + "18");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Stars
  bgStars.forEach((s) => {
    const alpha = 0.4 + Math.sin(s.twinkle) * 0.35;
    const color =
      s.hue === "cyan" ? COLORS.cyan : s.hue === "purple" ? COLORS.purple : COLORS.pink;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* =============================================================================
   PARTICLES — explosions & trails
   ============================================================================= */
function spawnExplosion(x, y, color, count = 24, power = 6) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = power * (0.4 + Math.random());
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function spawnSparkle(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 0.3,
      maxLife: 0.3,
      size: 3,
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function renderParticles() {
  particles.forEach((p) => {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;
}

/* =============================================================================
   PLAYER — mouse follow at bottom
   ============================================================================= */
function getPlayerY() {
  return H * CONFIG.playerYRatio;
}

function updatePlayer() {
  const targetX = Math.max(player.w / 2, Math.min(W - player.w / 2, mouseX));
  player.displayX += (targetX - player.displayX) * CONFIG.playerSmooth;
  player.x = player.displayX;
}

function renderPlayer() {
  const px = player.displayX;
  const py = getPlayerY();

  ctx.save();
  ctx.translate(px, py);

  // Engine glow trail
  const trail = ctx.createLinearGradient(0, 10, 0, 50);
  trail.addColorStop(0, "rgba(0,245,255,0.5)");
  trail.addColorStop(1, "transparent");
  ctx.fillStyle = trail;
  ctx.fillRect(-8, 8, 16, 40);

  // Ship body
  ctx.fillStyle = COLORS.blue;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, -player.h / 2);
  ctx.lineTo(player.w / 2, player.h / 2);
  ctx.lineTo(0, player.h / 2 - 8);
  ctx.lineTo(-player.w / 2, player.h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(0, -player.h / 2 - 4);
  ctx.lineTo(6, player.h / 4);
  ctx.lineTo(-6, player.h / 4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* =============================================================================
   BULLETS — auto laser fire upward
   ============================================================================= */
function fireBullet() {
  bullets.push({
    x: player.displayX + (Math.random() - 0.5) * 6,
    y: getPlayerY() - player.h / 2,
    w: 4,
    h: 18,
  });
  AudioFX.shoot();
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y -= CONFIG.bulletSpeed;
    if (b.y < -30) bullets.splice(i, 1);
  }
}

function renderBullets() {
  bullets.forEach((b) => {
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y - b.h);
    g.addColorStop(0, COLORS.pink);
    g.addColorStop(0.5, COLORS.cyan);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 12;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h, b.w, b.h);
    ctx.shadowBlur = 0;
  });
}

/* =============================================================================
   ENEMIES — patterns, golden rare, difficulty scaling
   ============================================================================= */
function spawnEnemy(forceGolden = false) {
  const golden = forceGolden || Math.random() < 0.04;
  const patterns = ["straight", "sine", "zigzag"];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const types = golden
    ? { w: 36, h: 36, hp: 2, speed: 1.4, color: COLORS.gold, points: 150 }
    : {
        w: 28 + Math.random() * 16,
        h: 24 + Math.random() * 12,
        hp: 1 + Math.floor(wave / 4),
        speed: CONFIG.baseEnemySpeed + wave * 0.08 + Math.random() * 0.5,
        color: [COLORS.purple, COLORS.pink, COLORS.blue][Math.floor(Math.random() * 3)],
        points: 10 + wave * 2,
      };

  enemies.push({
    x: 40 + Math.random() * (W - 80),
    y: -40,
    baseX: 0,
    w: types.w,
    h: types.h,
    hp: types.hp,
    speed: types.speed,
    color: types.color,
    points: types.points,
    golden,
    pattern,
    phase: Math.random() * Math.PI * 2,
    t: 0,
  });
  enemies[enemies.length - 1].baseX = enemies[enemies.length - 1].x;
}

function updateEnemies(dt) {
  const diff = 1 + gameTime * 0.02;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    e.y += e.speed * diff;

    if (e.pattern === "sine") {
      e.x = e.baseX + Math.sin(e.t * 2.5 + e.phase) * 70;
    } else if (e.pattern === "zigzag") {
      e.x = e.baseX + Math.sin(e.t * 5 + e.phase) * 45;
    }

    if (e.y > H + 60) enemies.splice(i, 1);
  }
}

function renderEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.golden ? 22 : 12;
    ctx.beginPath();
    if (e.golden) {
      ctx.moveTo(0, e.h / 2);
      ctx.lineTo(e.w / 2, -e.h / 2);
      ctx.lineTo(0, -e.h / 4);
      ctx.lineTo(-e.w / 2, -e.h / 2);
    } else {
      ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

/* =============================================================================
   RANDOM EVENTS — meteor shower, banner
   ============================================================================= */
let meteorShowerActive = false;

function triggerEvent(name, duration = 4) {
  eventBanner.textContent = name;
  eventBanner.classList.remove("hidden");
  setTimeout(() => eventBanner.classList.add("hidden"), duration * 1000);
}

function startMeteorShower() {
  meteorShowerActive = true;
  meteorTimer = 5;
  triggerEvent("☄ Meteor Shower!");
  for (let i = 0; i < 12; i++) {
    meteors.push({
      x: Math.random() * W,
      y: -Math.random() * H,
      vx: -2 + Math.random() * 4,
      vy: 6 + Math.random() * 4,
      size: 4 + Math.random() * 8,
    });
  }
}

function updateMeteors(dt) {
  if (meteorShowerActive) {
    meteorTimer -= dt;
    if (Math.random() < 0.15) {
      meteors.push({
        x: Math.random() * W,
        y: -20,
        vx: -1 + Math.random() * 2,
        vy: 5 + Math.random() * 3,
        size: 3 + Math.random() * 6,
      });
    }
    if (meteorTimer <= 0) meteorShowerActive = false;
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx;
    m.y += m.vy;
    if (m.y > H + 20) meteors.splice(i, 1);
  }
}

function renderMeteors() {
  meteors.forEach((m) => {
    const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 4, m.y - m.vy * 4);
    g.addColorStop(0, COLORS.gold);
    g.addColorStop(1, "transparent");
    ctx.strokeStyle = g;
    ctx.lineWidth = m.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5);
    ctx.stroke();
  });
}

/* =============================================================================
   COLLISION DETECTION
   ============================================================================= */
function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function checkCollisions() {
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (
        rectHit(
          b.x - b.w / 2,
          b.y - b.h,
          b.w,
          b.h,
          e.x - e.w / 2,
          e.y - e.h / 2,
          e.w,
          e.h
        )
      ) {
        bullets.splice(bi, 1);
        e.hp--;
        AudioFX.hit();
        if (e.hp <= 0) {
          destroyEnemy(ei);
        } else {
          spawnSparkle(e.x, e.y, e.color);
        }
        break;
      }
    }
  }

  const py = getPlayerY();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (
      rectHit(
        player.displayX - player.w / 2,
        py - player.h / 2,
        player.w,
        player.h,
        e.x - e.w / 2,
        e.y - e.h / 2,
        e.w,
        e.h
      )
    ) {
      endGame();
      return;
    }
  }

  for (const m of meteors) {
    const dx = m.x - player.displayX;
    const dy = m.y - py;
    if (dx * dx + dy * dy < (player.w / 2 + m.size) ** 2) {
      endGame();
      return;
    }
  }
}

function destroyEnemy(index) {
  const e = enemies[index];
  enemies.splice(index, 1);
  const mult = combo;
  const pts = Math.floor(e.points * mult);
  score += pts;
  scoreDisplay.textContent = score;

  comboTimer = CONFIG.comboWindow;
  combo = Math.min(10, combo + (e.golden ? 2 : 1));
  comboDisplay.textContent = `×${combo}`;
  comboBlock.classList.add("pulse");
  setTimeout(() => comboBlock.classList.remove("pulse"), 350);

  shake = e.golden ? 12 : 6;
  spawnExplosion(e.x, e.y, e.color, e.golden ? 40 : 22, e.golden ? 9 : 6);
  if (e.golden) {
    AudioFX.golden();
    spawnExplosion(e.x, e.y, COLORS.gold, 16, 8);
  } else {
    AudioFX.explode();
  }
}

/* =============================================================================
   UI & GAME STATE
   ============================================================================= */
function loadBest() {
  const v = localStorage.getItem("galaxyDriftBest");
  bestScore = v ? parseInt(v, 10) : 0;
  bestScoreEl.textContent = bestScore;
}

function saveBest() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("galaxyDriftBest", String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mouseX = W / 2;
  player.displayX = W / 2;
}

function resetGame() {
  score = 0;
  combo = 1;
  comboTimer = 0;
  wave = 1;
  gameTime = 0;
  shake = 0;
  spawnTimer = 0;
  fireTimer = 0;
  eventTimer = 12 + Math.random() * 8;
  meteorShowerActive = false;
  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  meteors.length = 0;
  scoreDisplay.textContent = "0";
  comboDisplay.textContent = "×1";
  waveDisplay.textContent = "1";
  player.displayX = W / 2;
}

function startGame() {
  initAudio();
  resetGame();
  state = "playing";
  startMenu.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  hud.classList.remove("hidden");
  lastTime = performance.now();
}

function endGame() {
  state = "gameover";
  AudioFX.playerHit();
  shake = 18;
  saveBest();
  finalScoreEl.textContent = score;
  hud.classList.add("hidden");
  gameOverPanel.classList.remove("hidden");
}

function updateUI(dt) {
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      combo = 1;
      comboDisplay.textContent = "×1";
    }
  }
  wave = 1 + Math.floor(gameTime / 25);
  waveDisplay.textContent = wave;
}

/* =============================================================================
   RENDERING — main draw with screen shake
   ============================================================================= */
function render() {
  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= CONFIG.shakeDecay;
  }

  renderBackground();
  renderMeteors();
  renderEnemies();
  renderBullets();
  renderPlayer();
  renderParticles();

  ctx.restore();
}

/* =============================================================================
   MAIN LOOP
   ============================================================================= */
function update(dt) {
  if (state !== "playing") return;

  gameTime += dt;
  updateBackground(dt);
  updatePlayer();

  fireTimer += dt;
  const rate = Math.max(0.06, CONFIG.fireRate - wave * 0.004);
  if (fireTimer >= rate) {
    fireTimer = 0;
    fireBullet();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateMeteors(dt);
  checkCollisions();
  updateUI(dt);

  spawnTimer += dt;
  const interval = Math.max(0.35, 1.1 - wave * 0.05 - gameTime * 0.008);
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    spawnEnemy();
    if (Math.random() < 0.2) spawnEnemy();
  }

  eventTimer -= dt;
  if (eventTimer <= 0) {
    eventTimer = 18 + Math.random() * 12;
    if (Math.random() < 0.45) {
      startMeteorShower();
    } else {
      spawnEnemy(true);
      triggerEvent("✦ Golden Raider!");
    }
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  if (state === "playing") update(dt);
  else if (state === "menu") updateBackground(dt);

  render();
  requestAnimationFrame(loop);
}

/* =============================================================================
   INPUT
   ============================================================================= */
canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (e.touches[0]) mouseX = e.touches[0].clientX;
}, { passive: false });

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

window.addEventListener("resize", resize);

/* =============================================================================
   INIT
   ============================================================================= */
loadBest();
initBackground();
resize();
lastTime = performance.now();
requestAnimationFrame(loop);
