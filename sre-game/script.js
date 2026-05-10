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

// --- Scanlines ---
function addScanlines() {
  const el = document.createElement('div');
  el.className = 'scanlines';
  document.body.appendChild(el);
}

// --- Particle Network Background ---
function initParticleNetwork() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const connectionDist = 200;
  const particles = [];
  const pulses = [];
  const count = 80;
  const ambientBlobs = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Create ambient glow blobs
  for (let i = 0; i < 4; i++) {
    ambientBlobs.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 150 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      color: Math.random() < 0.2 ? 'red' : 'green',
      alpha: 0.02 + Math.random() * 0.02,
    });
  }

  // Create particles — some are hub nodes (larger, more connections)
  for (let i = 0; i < count; i++) {
    const isHub = Math.random() < 0.1;
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * (isHub ? 0.2 : 0.5),
      vy: (Math.random() - 0.5) * (isHub ? 0.2 : 0.5),
      r: isHub ? 3 + Math.random() * 2 : Math.random() * 2 + 1,
      isHub,
      color: Math.random() < 0.15 ? 'red' : 'green',
      pulseTimer: Math.random() * 300,
      glowPhase: Math.random() * Math.PI * 2,
      glowSpeed: 0.01 + Math.random() * 0.02,
    });
  }

  let time = 0;

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    time += 0.016;

    // --- Ambient glow blobs ---
    ambientBlobs.forEach(blob => {
      blob.x += blob.vx;
      blob.y += blob.vy;
      if (blob.x < -blob.r) blob.x = canvas.width + blob.r;
      if (blob.x > canvas.width + blob.r) blob.x = -blob.r;
      if (blob.y < -blob.r) blob.y = canvas.height + blob.r;
      if (blob.y > canvas.height + blob.r) blob.y = -blob.r;

      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      if (blob.color === 'red') {
        grad.addColorStop(0, `rgba(239, 68, 68, ${blob.alpha})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        grad.addColorStop(0, `rgba(34, 197, 94, ${blob.alpha})`);
        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    });

    // --- Update positions ---
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Launch pulses
      p.pulseTimer--;
      if (p.pulseTimer <= 0) {
        p.pulseTimer = p.isHub ? 30 + Math.random() * 80 : 100 + Math.random() * 400;
        let nearest = null;
        let nearestDist = Infinity;
        particles.forEach(other => {
          if (other === p) return;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < connectionDist && d < nearestDist) {
            nearest = other;
            nearestDist = d;
          }
        });
        if (nearest) {
          pulses.push({
            x: p.x,
            y: p.y,
            tx: nearest.x,
            ty: nearest.y,
            progress: 0,
            speed: 0.02 + Math.random() * 0.03,
            color: p.color,
            trail: [],
          });
        }
      }
    });

    // --- Draw connections ---
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if (d < connectionDist) {
          const alpha = (1 - d / connectionDist) * 0.35;
          ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // --- Draw pulses with trail ---
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) {
        pulses.splice(i, 1);
        continue;
      }

      const px = pulse.x + (pulse.tx - pulse.x) * pulse.progress;
      const py = pulse.y + (pulse.ty - pulse.y) * pulse.progress;
      pulse.trail.push({ x: px, y: py });
      if (pulse.trail.length > 8) pulse.trail.shift();

      // Draw trail
      for (let t = 0; t < pulse.trail.length; t++) {
        const trailAlpha = (t / pulse.trail.length) * 0.8;
        const trailR = 1 + (t / pulse.trail.length) * 2;
        const baseColor = pulse.color === 'red' ? '239, 68, 68' : '34, 197, 94';
        ctx.beginPath();
        ctx.arc(pulse.trail[t].x, pulse.trail[t].y, trailR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${trailAlpha * (1 - pulse.progress * 0.5)})`;
        ctx.fill();
      }

      // Glow around pulse head
      const baseColor = pulse.color === 'red' ? '239, 68, 68' : '34, 197, 94';
      const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, 12);
      glowGrad.addColorStop(0, `rgba(${baseColor}, ${0.6 * (1 - pulse.progress)})`);
      glowGrad.addColorStop(1, `rgba(${baseColor}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Draw glowing nodes ---
    particles.forEach(p => {
      const glowPulse = Math.sin(time * p.glowSpeed * 60 + p.glowPhase) * 0.3 + 0.7;
      const baseColor = p.color === 'red' ? '239, 68, 68' : '34, 197, 94';

      // Outer glow
      const glowR = p.isHub ? 20 : 10;
      const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      glowGrad.addColorStop(0, `rgba(${baseColor}, ${0.3 * glowPulse})`);
      glowGrad.addColorStop(1, `rgba(${baseColor}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${baseColor}, ${0.6 * glowPulse + 0.2})`;
      ctx.fill();
    });

    // --- Vignette ---
    const vignetteGrad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.9
    );
    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
initParticleNetwork();
addScanlines();
