const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const overlayStats = document.getElementById('overlayStats');
const startBtn = document.getElementById('startBtn');

// --- Áudio Chiptune Sintetizado (Web Audio API) ---
class RetroSound {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  tone(freq, type, duration, vol = 0.08, slideTo = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  jump() { this.tone(320, 'square', 0.16, 0.07, 640); }
  spring() { this.tone(260, 'triangle', 0.28, 0.1, 880); }
  candy() { this.tone(740, 'sine', 0.11, 0.08, 1080); }
  flower() {
    this.tone(523, 'triangle', 0.12, 0.09);
    setTimeout(() => this.tone(659, 'triangle', 0.12, 0.09), 80);
    setTimeout(() => this.tone(1046, 'triangle', 0.22, 0.09), 160);
  }
  powerup() {
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.tone(f, 'square', 0.12, 0.07), i * 65);
    });
  }
  shoot() { this.tone(880, 'square', 0.09, 0.06, 420); }
  stomp() { this.tone(180, 'square', 0.14, 0.09, 90); }
  hurt() { this.tone(280, 'sawtooth', 0.3, 0.09, 110); }
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => this.tone(f, 'triangle', 0.18, 0.09), i * 110);
    });
  }
}

const sfx = new RetroSound();

// --- Constantes e Estado Global ---
const GRAVITY = 0.55;
const LEVEL_WIDTH = 3400;
const INITIAL_TIME = 150;

let gameState = 'menu'; // 'menu' | 'playing' | 'gameover' | 'victory'
let cameraX = 0;
let timeLeft = INITIAL_TIME;
let lastTimestamp = 0;
let timerAccumulator = 0;

let lives = 3;
let candies = 0;
let score = 0;
let flowersCollected = [false, false, false, false, false];

const keys = {};

// --- Entidades do Jogo ---
let player = {};
let platforms = [];
let mysteryBlocks = [];
let springs = [];
let items = [];
let flowerPickups = [];
let powerups = [];
let enemies = [];
let stars = [];
let particles = [];
let goal = {};

function createPlayer() {
  return {
    x: 70,
    y: 280,
    w: 28,
    h: 34,
    vx: 0,
    vy: 0,
    speed: 4.1,
    jumpPower: -11.4,
    onGround: false,
    facing: 1,
    big: false,
    hasWand: false,
    invuln: 0,
    shootCooldown: 0,
    animFrame: 0
  };
}

function buildLevel() {
  cameraX = 0;
  timeLeft = INITIAL_TIME;
  timerAccumulator = 0;
  candies = 0;
  score = 0;
  flowersCollected = [false, false, false, false, false];

  player = createPlayer();
  stars = [];
  particles = [];
  powerups = [];

  // Chão e plataformas flutuantes
  platforms = [
    { x: 0, y: 390, w: 680, h: 60, type: 'ground' },
    { x: 750, y: 390, w: 540, h: 60, type: 'ground' },
    { x: 1370, y: 390, w: 660, h: 60, type: 'ground' },
    { x: 2120, y: 390, w: 520, h: 60, type: 'ground' },
    { x: 2720, y: 390, w: 680, h: 60, type: 'ground' },

    // Plataformas de bolo / nuvem
    { x: 230, y: 295, w: 120, h: 20, type: 'cake' },
    { x: 430, y: 235, w: 120, h: 20, type: 'cake' },
    { x: 860, y: 285, w: 130, h: 20, type: 'cake' },
    { x: 1060, y: 215, w: 120, h: 20, type: 'cake' },
    { x: 1510, y: 280, w: 140, h: 20, type: 'cake' },
    { x: 1740, y: 210, w: 130, h: 20, type: 'cake' },
    { x: 2240, y: 275, w: 120, h: 20, type: 'cake' },
    { x: 2450, y: 210, w: 120, h: 20, type: 'cake' },

    // Plataforma móvel
    { x: 1960, y: 310, w: 110, h: 18, type: 'moving', baseX: 1960, range: 95, dir: 1, speed: 1.6 }
  ];

  // Blocos Interrogação (?)
  mysteryBlocks = [
    { x: 275, y: 205, w: 30, h: 30, used: false, reward: 'strawberry' },
    { x: 910, y: 195, w: 30, h: 30, used: false, reward: 'wand' },
    { x: 1565, y: 190, w: 30, h: 30, used: false, reward: 'candy_burst' },
    { x: 2285, y: 185, w: 30, h: 30, used: false, reward: 'wand' }
  ];

  // Molas de coração
  springs = [
    { x: 615, y: 368, w: 32, h: 22, bounceTimer: 0 },
    { x: 1890, y: 368, w: 32, h: 22, bounceTimer: 0 },
    { x: 2630, y: 368, w: 32, h: 22, bounceTimer: 0 }
  ];

  // Doces colecionáveis
  items = [];
  const candyRows = [
    [130, 355, 4], [245, 260, 3], [445, 200, 3],
    [800, 355, 5], [1075, 180, 3], [1420, 355, 5],
    [1755, 175, 4], [2160, 355, 4], [2465, 175, 3], [2780, 355, 5]
  ];
  candyRows.forEach(([startX, y, count]) => {
    for (let i = 0; i < count; i++) {
      items.push({ x: startX + i * 32, y, r: 9, collected: false });
    }
  });

  // 5 Flores Secretas (estilo moedas estrela do Lep's World)
  flowerPickups = [
    { id: 0, x: 480, y: 155, collected: false },
    { id: 1, x: 1110, y: 135, collected: false },
    { id: 2, x: 1795, y: 130, collected: false },
    { id: 3, x: 2495, y: 130, collected: false },
    { id: 4, x: 2980, y: 245, collected: false }
  ];

  // Inimigos fofos (Slimes Roxos e Abelhinhas)
  enemies = [
    { type: 'slime', x: 420, y: 362, w: 30, h: 28, vx: -1.2, minX: 310, maxX: 580, alive: true },
    { type: 'slime', x: 980, y: 362, w: 30, h: 28, vx: 1.4, minX: 780, maxX: 1240, alive: true },
    { type: 'bee', x: 1320, y: 240, w: 30, h: 26, vx: -1.6, minX: 1220, maxX: 1480, baseY: 240, phase: 0, alive: true },
    { type: 'slime', x: 1650, y: 362, w: 30, h: 28, vx: -1.5, minX: 1400, maxX: 1850, alive: true },
    { type: 'bee', x: 2150, y: 220, w: 30, h: 26, vx: 1.7, minX: 2050, maxX: 2380, baseY: 220, phase: 1.5, alive: true },
    { type: 'slime', x: 2400, y: 362, w: 30, h: 28, vx: -1.6, minX: 2150, maxX: 2590, alive: true },
    { type: 'slime', x: 2920, y: 362, w: 30, h: 28, vx: -1.8, minX: 2760, maxX: 3120, alive: true }
  ];

  // Castelo Final
  goal = { x: 3220, y: 250, w: 96, h: 140 };
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.8) * 6,
      life: 26 + Math.random() * 14,
      color,
      size: 4 + Math.random() * 4
    });
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function damagePlayer() {
  if (player.invuln > 0) return;

  if (player.hasWand) {
    player.hasWand = false;
    player.invuln = 80;
    sfx.hurt();
    spawnParticles(player.x + 14, player.y + 16, '#facc15', 14);
    return;
  }

  if (player.big) {
    player.big = false;
    player.h = 34;
    player.y += 10;
    player.invuln = 80;
    sfx.hurt();
    spawnParticles(player.x + 14, player.y + 16, '#ff5da2', 14);
    return;
  }

  lives--;
  sfx.hurt();
  spawnParticles(player.x + 14, player.y + 16, '#fb7185', 18);

  if (lives <= 0) {
    endGame(false, 'Suas vidas acabaram! Que tal tentar novamente?');
  } else {
    player.x = Math.max(60, player.x - 120);
    player.y = 200;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 100;
  }
}

function shootStar() {
  if (!player.hasWand || player.shootCooldown > 0 || gameState !== 'playing') return;
  player.shootCooldown = 22;
  sfx.shoot();
  stars.push({
    x: player.facing === 1 ? player.x + player.w : player.x - 12,
    y: player.y + player.h * 0.45,
    w: 14,
    h: 14,
    vx: player.facing * 7.5,
    vy: 1.5,
    bounces: 3
  });
}

function endGame(victory, subtitle) {
  gameState = victory ? 'victory' : 'gameover';
  const flowerCount = flowersCollected.filter(Boolean).length;
  const timeBonus = victory ? timeLeft * 10 : 0;
  const finalScore = score + timeBonus;

  overlayTitle.textContent = victory ? '🎉 Fase Concluída!' : '💔 Fim de Jogo!';
  overlaySubtitle.textContent = subtitle;
  overlayStats.classList.remove('hidden');
  overlayStats.innerHTML = `
    🍬 Doces: ${candies} &nbsp;|&nbsp; 🌸 Flores: ${flowerCount}/5<br>
    ⏱️ Bônus de Tempo: +${timeBonus} pts<br>
    ⭐ Pontuação Final: ${finalScore} pts
  `;
  startBtn.textContent = victory ? '🔄 Jogar Novamente' : '💖 Tentar de Novo';
  overlay.classList.remove('hidden');
}

// --- Atualização Lógica ---
function update(dt) {
  if (gameState !== 'playing') return;

  // Cronômetro regressivo estilo Lep's World
  timerAccumulator += dt;
  if (timerAccumulator >= 1) {
    timerAccumulator -= 1;
    timeLeft--;
    if (timeLeft <= 0) {
      timeLeft = 0;
      lives = 0;
      sfx.hurt();
      endGame(false, 'O tempo acabou antes de chegar ao castelo!');
      return;
    }
  }

  if (player.invuln > 0) player.invuln--;
  if (player.shootCooldown > 0) player.shootCooldown--;

  // Plataformas móveis
  platforms.forEach(p => {
    if (p.type === 'moving') {
      p.x += p.speed * p.dir;
      if (p.x > p.baseX + p.range) p.dir = -1;
      if (p.x < p.baseX - p.range) p.dir = 1;
    }
  });

  // Movimento horizontal
  const moveLeft = keys['ArrowLeft'] || keys['KeyA'];
  const moveRight = keys['ArrowRight'] || keys['KeyD'];

  if (moveLeft) {
    player.vx = -player.speed;
    player.facing = -1;
    player.animFrame += 0.2;
  } else if (moveRight) {
    player.vx = player.speed;
    player.facing = 1;
    player.animFrame += 0.2;
  } else {
    player.vx *= 0.78;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
  }

  // Pulo
  const jumpPressed = keys['ArrowUp'] || keys['KeyW'] || keys['Space'];
  if (jumpPressed && player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
    sfx.jump();
    spawnParticles(player.x + player.w / 2, player.y + player.h, '#ffffff', 6);
  }

  // Aplicar física X
  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.w;

  const solidBlocks = [...platforms, ...mysteryBlocks];
  solidBlocks.forEach(b => {
    if (rectsOverlap(player, b)) {
      if (player.vx > 0) player.x = b.x - player.w;
      else if (player.vx < 0) player.x = b.x + b.w;
    }
  });

  // Aplicar gravidade e física Y
  player.vy += GRAVITY;
  player.y += player.vy;
  player.onGround = false;

  solidBlocks.forEach(b => {
    if (rectsOverlap(player, b)) {
      if (player.vy > 0) {
        player.y = b.y - player.h;
        player.vy = 0;
        player.onGround = true;
        if (b.type === 'moving') {
          player.x += b.speed * b.dir;
        }
      } else if (player.vy < 0) {
        player.y = b.y + b.h;
        player.vy = 0;
        if (b.reward && !b.used) {
          triggerMysteryBlock(b);
        }
      }
    }
  });

  // Queda em buraco
  if (player.y > canvas.height + 40) {
    lives--;
    sfx.hurt();
    if (lives <= 0) {
      endGame(false, 'Mochi caiu em um buraco de algodão-doce!');
      return;
    } else {
      player.x = Math.max(70, player.x - 180);
      player.y = 140;
      player.vx = 0;
      player.vy = 0;
      player.invuln = 90;
    }
  }

  // Molas
  springs.forEach(sp => {
    if (sp.bounceTimer > 0) sp.bounceTimer--;
    if (rectsOverlap(player, sp) && player.vy >= 0) {
      player.vy = -16.2;
      player.onGround = false;
      sp.bounceTimer = 14;
      sfx.spring();
      spawnParticles(sp.x + 16, sp.y, '#ff5da2', 12);
    }
  });

  // Coletar Doces
  items.forEach(c => {
    if (c.collected) return;
    const box = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (rectsOverlap(player, box)) {
      c.collected = true;
      candies++;
      score += 50;
      sfx.candy();
      spawnParticles(c.x, c.y, '#ff85b8', 7);
      if (candies % 25 === 0) {
        lives = Math.min(5, lives + 1);
        sfx.powerup();
      }
    }
  });

  // Coletar 5 Flores Mágicas
  flowerPickups.forEach(fl => {
    if (fl.collected) return;
    const box = { x: fl.x - 14, y: fl.y - 14, w: 28, h: 28 };
    if (rectsOverlap(player, box)) {
      fl.collected = true;
      flowersCollected[fl.id] = true;
      score += 300;
      sfx.flower();
      spawnParticles(fl.x, fl.y, '#fde047', 16);
    }
  });

  // Power-ups ativos
  powerups.forEach(pw => {
    if (pw.collected) return;
    pw.vy += 0.35;
    pw.x += pw.vx;
    pw.y += pw.vy;

    solidBlocks.forEach(b => {
      if (rectsOverlap(pw, b) && pw.vy > 0) {
        pw.y = b.y - pw.h;
        pw.vy = 0;
      }
    });

    if (rectsOverlap(player, pw)) {
      pw.collected = true;
      sfx.powerup();
      score += 250;
      if (pw.type === 'strawberry') {
        if (!player.big) {
          player.big = true;
          player.y -= 10;
          player.h = 44;
        } else {
          lives = Math.min(5, lives + 1);
        }
        spawnParticles(pw.x + 12, pw.y + 12, '#fb7185', 16);
      } else if (pw.type === 'wand') {
        player.hasWand = true;
        spawnParticles(pw.x + 12, pw.y + 12, '#facc15', 16);
      }
    }
  });

  // Projéteis de estrela
  stars.forEach(st => {
    st.x += st.vx;
    st.vy += 0.35;
    st.y += st.vy;

    solidBlocks.forEach(b => {
      if (rectsOverlap(st, b)) {
        if (st.vy > 0) {
          st.y = b.y - st.h;
          st.vy = -5.5;
          st.bounces--;
        } else {
          st.bounces = 0;
        }
      }
    });

    enemies.forEach(en => {
      if (en.alive && rectsOverlap(st, en)) {
        en.alive = false;
        st.bounces = 0;
        score += 150;
        sfx.stomp();
        spawnParticles(en.x + 15, en.y + 14, '#c084fc', 14);
      }
    });
  });
  stars = stars.filter(st => st.bounces > 0 && st.x > cameraX - 40 && st.x < cameraX + canvas.width + 40);

  // Inimigos
  enemies.forEach(en => {
    if (!en.alive) return;
    en.x += en.vx;
    if (en.x < en.minX || en.x > en.maxX) en.vx *= -1;
    if (en.type === 'bee') {
      en.phase += 0.08;
      en.y = en.baseY + Math.sin(en.phase) * 18;
    }

    if (rectsOverlap(player, en)) {
      const stomped = player.vy > 0 && player.y + player.h - player.vy <= en.y + 12;
      if (stomped) {
        en.alive = false;
        player.vy = -9.5;
        score += 150;
        sfx.stomp();
        spawnParticles(en.x + 15, en.y + 14, '#d8b4fe', 14);
      } else {
        damagePlayer();
      }
    }
  });

  // Partículas
  particles.forEach(pt => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.2;
    pt.life--;
  });
  particles = particles.filter(pt => pt.life > 0);

  // Vitória ao tocar no Castelo
  if (rectsOverlap(player, goal)) {
    sfx.win();
    endGame(true, 'Mochi chegou em segurança ao Castelo de Morango!');
    return;
  }

  // Câmera suave
  const targetCam = player.x - canvas.width * 0.35;
  cameraX += (targetCam - cameraX) * 0.12;
  cameraX = Math.max(0, Math.min(LEVEL_WIDTH - canvas.width, cameraX));
}

function triggerMysteryBlock(block) {
  block.used = true;
  sfx.powerup();
  score += 100;
  spawnParticles(block.x + 15, block.y, '#fde047', 10);

  if (block.reward === 'candy_burst') {
    for (let i = -2; i <= 2; i++) {
      items.push({ x: block.x + 15 + i * 24, y: block.y - 26, r: 9, collected: false });
    }
  } else {
    powerups.push({
      type: block.reward,
      x: block.x + 3,
      y: block.y - 26,
      w: 24,
      h: 24,
      vx: 1.4,
      vy: -2,
      collected: false
    });
  }
}

// --- Renderização Pixel Art ---
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#ffd6ec');
  grad.addColorStop(0.65, '#ffeaf5');
  grad.addColorStop(1, '#ffc2e2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Colinas em paralaxe
  ctx.fillStyle = '#ffb3d9';
  for (let i = 0; i < 12; i++) {
    const hx = i * 380 - (cameraX * 0.25) % 380;
    ctx.beginPath();
    ctx.arc(hx + 120, 410, 170, Math.PI, 0);
    ctx.fill();
  }

  // Nuvens fofas
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 14; i++) {
    const cx = i * 310 - (cameraX * 0.4) % 310;
    const cy = 75 + (i % 3) * 28;
    ctx.fillRect(cx, cy, 64, 18);
    ctx.fillRect(cx + 12, cy - 10, 40, 12);
  }
}

function drawPlatforms() {
  platforms.forEach(p => {
    const sx = Math.floor(p.x - cameraX);
    if (sx + p.w < -20 || sx > canvas.width + 20) return;

    if (p.type === 'ground') {
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(sx, p.y, p.w, p.h);
      // Cobertura de glacê rosa claro
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(sx, p.y, p.w, 12);
      ctx.fillStyle = '#be185d';
      ctx.fillRect(sx, p.y, p.w, 3);
    } else {
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#fff1f2';
      ctx.fillRect(sx, p.y, p.w, 6);
    }
  });

  mysteryBlocks.forEach(b => {
    const sx = Math.floor(b.x - cameraX);
    ctx.fillStyle = b.used ? '#d6a2b8' : '#facc15';
    ctx.fillRect(sx, b.y, b.w, b.h);
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, b.y + 1, b.w - 2, b.h - 2);

    ctx.fillStyle = b.used ? '#831843' : '#be185d';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText(b.used ? '•' : '?', sx + 9, b.y + 21);
  });

  springs.forEach(sp => {
    const sx = Math.floor(sp.x - cameraX);
    const squash = sp.bounceTimer > 0 ? 6 : 0;
    ctx.fillStyle = '#9d174d';
    ctx.fillRect(sx + 6, sp.y + 10 + squash, sp.w - 12, 12 - squash);
    ctx.fillStyle = '#ff4791';
    ctx.fillRect(sx, sp.y + squash, sp.w, 10);
  });
}

function drawCollectiblesAndEnemies() {
  // Doces
  items.forEach(c => {
    if (c.collected) return;
    const sx = Math.floor(c.x - cameraX);
    ctx.fillStyle = '#ff4791';
    ctx.beginPath();
    ctx.arc(sx, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 3, c.y - 3, 4, 4);
  });

  // Flores Mágicas
  flowerPickups.forEach(fl => {
    if (fl.collected) return;
    const sx = Math.floor(fl.x - cameraX);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(sx, fl.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4791';
    ctx.beginPath();
    ctx.arc(sx, fl.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Power-ups
  powerups.forEach(pw => {
    if (pw.collected) return;
    const sx = Math.floor(pw.x - cameraX);
    if (pw.type === 'strawberry') {
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(sx + 2, pw.y + 4, 20, 18);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(sx + 4, pw.y, 16, 5);
    } else {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(sx + 9, pw.y + 6, 6, 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(sx + 4, pw.y, 16, 10);
    }
  });

  // Estrelas disparadas
  stars.forEach(st => {
    const sx = Math.floor(st.x - cameraX);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(sx, st.y, st.w, st.h);
  });

  // Inimigos
  enemies.forEach(en => {
    if (!en.alive) return;
    const sx = Math.floor(en.x - cameraX);
    if (en.type === 'slime') {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(sx, en.y + 6, en.w, en.h - 6);
      ctx.fillRect(sx + 4, en.y, en.w - 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 6, en.y + 10, 5, 5);
      ctx.fillRect(sx + 18, en.y + 10, 5, 5);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(sx, en.y + 4, en.w, en.h - 4);
      ctx.fillStyle = '#581c87';
      ctx.fillRect(sx + 8, en.y + 4, 5, en.h - 4);
      ctx.fillRect(sx + 18, en.y + 4, 5, en.h - 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 6, en.y - 4, 16, 6);
    }
  });

  // Castelo Final
  const gx = Math.floor(goal.x - cameraX);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(gx, goal.y + 30, goal.w, goal.h - 30);
  ctx.fillStyle = '#be185d';
  ctx.fillRect(gx + 34, goal.y + 85, 28, 55);
  ctx.fillStyle = '#ff4791';
  ctx.fillRect(gx + 10, goal.y, 24, 30);
  ctx.fillRect(gx + 62, goal.y, 24, 30);
}

function drawPlayer() {
  if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) return;

  const sx = Math.floor(player.x - cameraX);
  const sy = Math.floor(player.y);

  // Orelhas de coelhinha
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx + 5, sy - 12, 6, 14);
  ctx.fillRect(sx + player.w - 11, sy - 12, 6, 14);
  ctx.fillStyle = '#ff85b8';
  ctx.fillRect(sx + 7, sy - 10, 2, 10);
  ctx.fillRect(sx + player.w - 9, sy - 10, 2, 10);

  // Corpo / Vestido rosa
  ctx.fillStyle = player.hasWand ? '#facc15' : '#ff4791';
  ctx.fillRect(sx, sy + 12, player.w, player.h - 12);

  // Cabeça
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx + 2, sy, player.w - 4, 16);

  // Olhos e bochechas
  ctx.fillStyle = '#4c0519';
  const eyeOffset = player.facing === 1 ? 14 : 6;
  ctx.fillRect(sx + eyeOffset, sy + 6, 4, 5);
  ctx.fillStyle = '#ff85b8';
  ctx.fillRect(sx + eyeOffset - 2, sy + 11, 8, 3);
}

function drawParticles() {
  particles.forEach(pt => {
    const sx = Math.floor(pt.x - cameraX);
    ctx.fillStyle = pt.color;
    ctx.fillRect(sx, pt.y, pt.size, pt.size);
  });
}

// --- HUD Estilo Lep's World ---
function drawHUD() {
  ctx.fillStyle = 'rgba(255, 240, 247, 0.92)';
  ctx.fillRect(12, 10, canvas.width - 24, 42);
  ctx.strokeStyle = '#ff5da2';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 10, canvas.width - 24, 42);

  // Vidas (Corações)
  ctx.font = 'bold 18px Courier New';
  let heartsText = '';
  for (let i = 0; i < 5; i++) {
    heartsText += i < lives ? '❤️' : '🤍';
  }
  ctx.fillStyle = '#be185d';
  ctx.fillText(heartsText, 24, 37);

  // Doces
  ctx.fillText(`🍬 ${String(candies).padStart(2, '0')}`, 185, 37);

  // 5 Flores Secretas
  let flowersHud = '';
  flowersCollected.forEach(got => {
    flowersHud += got ? '🌸' : '⚪';
  });
  ctx.fillText(flowersHud, 285, 37);

  // Pontuação
  ctx.fillText(`PTS:${String(score).padStart(5, '0')}`, 455, 37);

  // Cronômetro regressivo (pisca em vermelho nos últimos 20s)
  const lowTime = timeLeft <= 20;
  ctx.fillStyle = lowTime && Math.floor(Date.now() / 250) % 2 === 0 ? '#dc2626' : '#9d174d';
  ctx.fillText(`⏱️ ${String(timeLeft).padStart(3, '0')}s`, 665, 37);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlatforms();
  drawCollectiblesAndEnemies();
  drawPlayer();
  drawParticles();
  drawHUD();
}

function gameLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0);
  lastTimestamp = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// --- Eventos de Controle ---
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyZ' || e.code === 'KeyX') shootStar();
  if (e.code === 'KeyR' && gameState === 'playing') {
    lives = 3;
    buildLevel();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

function bindTouch(btnId, keyCode, onPress = null) {
  const el = document.getElementById(btnId);
  if (!el) return;
  el.addEventListener('touchstart', e => {
    e.preventDefault();
    keys[keyCode] = true;
    if (onPress) onPress();
  });
  el.addEventListener('touchend', e => {
    e.preventDefault();
    keys[keyCode] = false;
  });
}

bindTouch('btnLeft', 'ArrowLeft');
bindTouch('btnRight', 'ArrowRight');
bindTouch('btnJump', 'Space');
bindTouch('btnShoot', 'KeyZ', shootStar);

startBtn.addEventListener('click', () => {
  sfx.init();
  lives = 3;
  buildLevel();
  overlay.classList.add('hidden');
  gameState = 'playing';
});

// Inicializa visualização inicial
buildLevel();
requestAnimationFrame(gameLoop);