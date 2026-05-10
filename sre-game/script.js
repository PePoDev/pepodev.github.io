// ===== CHAOS GAME ENGINE =====

// --- Boot Sequence ---
const bootLines = [
  { text: '$ ssh production-cluster.prod.internal', cls: '', delay: 300 },
  { text: 'Connecting to 10.0.42.1...', cls: 'dim', delay: 500 },
  { text: 'Authenticated. Welcome to prod.', cls: 'info', delay: 400 },
  { text: '', cls: '', delay: 200 },
  { text: '$ kubectl get nodes', cls: '', delay: 600 },
  { text: 'NAME           STATUS   ROLES    AGE   VERSION', cls: 'dim', delay: 300 },
  { text: 'prod-node-01   Ready    master   45d   v1.28.3', cls: '', delay: 200 },
  { text: 'prod-node-02   Ready    worker   45d   v1.28.3', cls: '', delay: 200 },
  { text: 'prod-node-03   Ready    worker   45d   v1.28.3', cls: '', delay: 200 },
  { text: '', cls: '', delay: 200 },
  { text: '$ systemctl status monitoring', cls: '', delay: 500 },
  { text: '● prometheus.service - Prometheus Monitoring', cls: '', delay: 200 },
  { text: '   Active: active (running) since Mon 2024-01-15', cls: '', delay: 200 },
  { text: '', cls: '', delay: 200 },
  { text: 'All systems nominal. No alerts.', cls: 'info', delay: 400 },
  { text: '', cls: '', delay: 200 },
  { text: "You're on call. The dashboard is green.", cls: '', delay: 600 },
  { text: 'For now...', cls: 'warn', delay: 800 },
];

// --- Alert Definitions (escalating chaos) ---
const alerts = [
  {
    severity: 'warning',
    title: '⚠ High Memory Usage Detected',
    desc: 'prod-node-02 memory at 87%. Pod evictions imminent.',
    timer: 15,
    damage: 8,
    actions: [
      { text: 'Restart pods', result: 'Pods restarted. Memory dropped... then spiked higher. +12% usage.', success: false },
      { text: 'Scale horizontally', result: 'New pods scheduled. Node now at 94% with scheduling overhead.', success: false },
      { text: 'Kill top consumer', result: 'Killed memhog process. It was a critical cache. Latency tripled.', success: false },
    ]
  },
  {
    severity: 'warning',
    title: '⚠ Latency Spike on API Gateway',
    desc: 'p99 latency jumped from 120ms to 2.4s. Users reporting slow responses.',
    timer: 14,
    damage: 10,
    actions: [
      { text: 'Enable circuit breaker', result: 'Circuit breaker tripped. Now 40% of requests are failing outright.', success: false },
      { text: 'Rollback last deploy', result: 'Rollback complete. The latency was infrastructure-level, not code.', success: false },
      { text: 'Add rate limiting', result: 'Rate limiter engaged. Legitimate traffic now being throttled too.', success: false },
    ]
  },
  {
    severity: 'critical',
    title: '🔴 Disk I/O Saturation',
    desc: 'prod-node-03 disk utilization at 100%. Write operations queueing.',
    timer: 12,
    damage: 12,
    actions: [
      { text: 'Clear old logs', result: 'Logs cleared. Application started writing audit logs at 10x rate.', success: false },
      { text: 'Move to faster storage', result: 'Storage migration started. I/O spiked during the transition.', success: false },
      { text: 'Enable write coalescing', result: 'Writes coalesced. Data consistency checks now failing.', success: false },
    ]
  },
  {
    severity: 'critical',
    title: '🔴 Certificate Expiring in 2h',
    desc: 'TLS cert for *.prod.internal expires soon. Auto-renewal failed.',
    timer: 10,
    damage: 12,
    actions: [
      { text: 'Manual cert renewal', result: 'Renewed cert. ACME challenge failed for internal DNS zone.', success: false },
      { text: 'Switch to internal CA', result: 'Internal CA signed it. Browser trust store doesn\'t recognize the root.', success: false },
      { text: 'Extend validity window', result: 'Cannot extend expired cert. The window has closed.', success: false },
    ]
  },
  {
    severity: 'critical',
    title: '🔴 Database Connection Pool Exhausted',
    desc: 'PostgreSQL primary: 450/450 connections used. New connections being rejected.',
    timer: 10,
    damage: 14,
    actions: [
      { text: 'Increase pool size', result: 'Pool expanded to 600. Server ran out of shared memory.', success: false },
      { text: 'Kill idle connections', result: 'Killed 200 connections. Hit the replication lag monitors.', success: false },
      { text: 'Enable PgBouncer', result: 'PgBouncer deployed. Transaction retry storms began.', success: false },
    ]
  },
  {
    severity: 'catastrophic',
    title: '💀 Cascading Failure Detected',
    desc: 'Service mesh sidecars crashing. 12 microservices affected. Error propagation across all zones.',
    timer: 8,
    damage: 16,
    actions: [
      { text: 'Emergency rollback all', result: 'Rollback triggered dependency conflicts. More services down.', success: false },
      { text: 'Isolate affected zones', result: 'Zones isolated. Cross-zone replication broke. Data divergence detected.', success: false },
      { text: 'Full cluster restart', result: 'Restart initiated. Boot storm caused DNS resolution failures.', success: false },
    ]
  },
  {
    severity: 'catastrophic',
    title: '💀 CRITICAL: Cluster Unstable',
    desc: 'CoreDNS flapping. Etcd quorum at risk. Multiple nodes NotReady. This is it.',
    timer: 6,
    damage: 20,
    actions: [
      { text: 'Attempt etcd restore', result: 'Restore started from 4h-old backup. 4 hours of data loss.', success: false },
      { text: 'Failover to DR site', result: 'DR site activated. Replication was stale. Partial data available.', success: false },
      { text: 'Call for help...', result: 'You need more than a runbook. You need an SRE who lives for this.', success: false },
    ]
  },
];

// --- State ---
let health = 100;
let currentRound = 0;
let alertTimer = null;
let alertTimeLeft = 0;
let gameActive = false;

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// --- Boot Sequence ---
async function runBoot() {
  const output = $('#boot-output');
  for (const line of bootLines) {
    await sleep(line.delay);
    const el = document.createElement('div');
    el.className = `line ${line.cls}`;
    el.textContent = line.text || ' ';
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }
  $('#boot-enter').classList.remove('hidden');
}

$('#boot-enter').addEventListener('click', () => {
  showScreen('#game-screen');
  startGame();
});

// --- Game Engine ---
function startGame() {
  health = 100;
  currentRound = 0;
  gameActive = true;
  updateHealth();
  updateRound();
  updateStatus();
  $('#game-message').innerHTML = `
    <p>Monitoring production...</p>
    <p class="sub">Alerts will appear below. Click an action to mitigate before time runs out.</p>
  `;
  $('#game-actions').innerHTML = '';
  scheduleNextAlert();
}

function scheduleNextAlert() {
  if (!gameActive || currentRound >= alerts.length) return;
  const delay = currentRound === 0 ? 2500 : 1800;
  setTimeout(() => {
    if (gameActive) showAlert(currentRound);
  }, delay);
}

function showAlert(index) {
  const alert = alerts[index];
  alertTimeLeft = alert.timer;

  const gameArea = $('#game-area');
  gameArea.innerHTML = '';

  const card = document.createElement('div');
  card.className = `alert-card severity-${alert.severity}`;
  card.innerHTML = `
    <div class="alert-header">
      <span class="alert-title">${alert.title}</span>
      <span class="alert-severity">${alert.severity}</span>
    </div>
    <div class="alert-desc">${alert.desc}</div>
    <div class="alert-timer" id="alert-timer">Time remaining: ${alertTimeLeft}s</div>
  `;
  gameArea.appendChild(card);

  const actionsDiv = $('#game-actions');
  actionsDiv.innerHTML = '';
  alert.actions.forEach((action, i) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = action.text;
    btn.addEventListener('click', () => handleAction(index, i));
    actionsDiv.appendChild(btn);
  });

  // Start countdown
  clearInterval(alertTimer);
  alertTimer = setInterval(() => {
    alertTimeLeft--;
    const timerEl = $('#alert-timer');
    if (timerEl) timerEl.textContent = `Time remaining: ${alertTimeLeft}s`;
    if (alertTimeLeft <= 0) {
      clearInterval(alertTimer);
      timeExpired(index);
    }
  }, 1000);
}

function handleAction(alertIndex, actionIndex) {
  clearInterval(alertTimer);
  const alert = alerts[alertIndex];
  const action = alert.actions[actionIndex];

  // Apply damage regardless
  health -= alert.damage;
  updateHealth();

  const gameArea = $('#game-area');
  const log = document.createElement('div');
  log.className = 'mitigation-log';
  log.innerHTML = `<strong>Mitigation failed:</strong> ${action.result}`;
  gameArea.appendChild(log);

  // Disable action buttons
  $$('.action-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });

  currentRound++;
  updateRound();
  updateStatus();

  if (health <= 0) {
    gameActive = false;
    setTimeout(() => {
      showScreen('#gameover-screen');
    }, 2000);
    return;
  }

  if (currentRound >= alerts.length) {
    gameActive = false;
    setTimeout(() => {
      showScreen('#gameover-screen');
    }, 2000);
    return;
  }

  scheduleNextAlert();
}

function timeExpired(alertIndex) {
  const alert = alerts[alertIndex];
  health -= alert.damage;
  updateHealth();
  updateStatus();

  const gameArea = $('#game-area');
  const log = document.createElement('div');
  log.className = 'mitigation-log';
  log.innerHTML = `<strong>Time expired — alert unresolved.</strong> System absorbed the damage.`;
  gameArea.appendChild(log);

  $$('.action-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });

  currentRound++;
  updateRound();

  if (health <= 0) {
    gameActive = false;
    setTimeout(() => {
      showScreen('#gameover-screen');
    }, 2000);
    return;
  }

  scheduleNextAlert();
}

function updateHealth() {
  health = Math.max(0, Math.min(100, health));
  const fill = $('#health-fill');
  fill.style.width = health + '%';
  fill.style.background = health > 60 ? 'var(--green)' : health > 30 ? 'var(--yellow)' : 'var(--red)';
  $('#health-pct').textContent = health + '%';
}

function updateRound() {
  $('#round-num').textContent = currentRound + 1;
}

function updateStatus() {
  const status = $('#game-status');
  if (health > 60) {
    status.textContent = 'Stable';
    status.className = 'status-ok';
  } else if (health > 30) {
    status.textContent = 'Degraded';
    status.className = 'status-warn';
  } else {
    status.textContent = 'Critical';
    status.className = 'status-crit';
  }
}

// --- Game Over → Solution ---
$('#gameover-reveal').addEventListener('click', () => {
  showScreen('#solution-screen');
});

// --- Replay from solution screen ---
$('#solution-replay').addEventListener('click', () => {
  showScreen('#boot-screen');
  $('#boot-output').innerHTML = '';
  $('#boot-enter').classList.add('hidden');
  runBoot();
});

// --- Background Particles ---
function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  const count = 60;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.3 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34, 211, 238, ${p.a})`;
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.06 * (1 - dist / 120)})`;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }
  draw();
}

// --- Scanlines ---
function addScanlines() {
  const el = document.createElement('div');
  el.className = 'scanlines';
  document.body.appendChild(el);
}

// --- Animated Grid Background ---
function initGridBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const gridSize = 40;
  let cols, rows;
  const cells = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / gridSize);
    rows = Math.ceil(canvas.height / gridSize);
    cells.length = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        cells.push({
          x: x * gridSize,
          y: y * gridSize,
          size: gridSize - 4,
          alpha: Math.random() * 0.05,
          targetAlpha: Math.random() * 0.15,
          speed: 0.002 + Math.random() * 0.008,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  resize();
  window.addEventListener('resize', resize);

  let time = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 0.016;

    cells.forEach(cell => {
      const wave = Math.sin(time * cell.speed * 50 + cell.phase) * 0.5 + 0.5;
      cell.alpha += (cell.targetAlpha * wave - cell.alpha) * 0.05;

      if (cell.alpha > 0.01) {
        ctx.fillStyle = `rgba(34, 197, 94, ${cell.alpha})`;
        ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
      }

      // Swap targets occasionally
      if (Math.random() < 0.001) {
        cell.targetAlpha = Math.random() * 0.25;
        cell.phase = Math.random() * Math.PI * 2;
      }
    });

    requestAnimationFrame(draw);
  }

  draw();
}

// --- Utility ---
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Init ---
runBoot();
initParticles();
initMatrixRain();
addScanlines();
