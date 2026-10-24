// The desktop background: a particle network drawn on #bg-canvas (port of
// the particle script at the end of index.astro). It reads its colours from
// the CSS variables the preferences set (--desktop-bg-color,
// --particle-primary-rgb, --particle-secondary-rgb) and reacts to music:
// every frame asks window.__pepoMusicController?.requestAudioFrame?.() for
// levels, which the Music player answers with a desktop:music-audio-frame
// event ({ playing, low, mid, high, energy }, each 0 to 1).
//
// It animates only while the background effect is on, the desktop is shown
// and the tab is visible. With prefers-reduced-motion it paints one still
// frame instead. The frame loop's function is named "draw" (tests count
// requestAnimationFrame callbacks by name), set explicitly so minification
// cannot rename it.

interface AudioLevels {
  playing: boolean;
  low: number;
  mid: number;
  high: number;
  energy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  isHub: boolean;
  color: "cyan" | "green";
  pulseTimer: number;
  glowPhase: number;
  glowSpeed: number;
}

interface Pulse {
  x: number;
  y: number;
  tx: number;
  ty: number;
  progress: number;
  speed: number;
  color: "cyan" | "green";
  audioBoost: number;
  trail: { x: number; y: number }[];
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  color: "cyan" | "green";
}

interface Blob {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  color: "cyan" | "green";
  alpha: number;
}

const CONNECTION_DIST = 180;
const PARTICLE_COUNT = 70;
const clamp01 = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));

export interface ParticleNetwork {
  /** Re-reads the colours (after a preferences change) and the effect switch. */
  setPreferences(backgroundEffect: boolean): void;
  /** Pauses in website mode, resumes in desktop mode. */
  setSiteMode(mode: "desktop" | "website"): void;
  destroy(): void;
}

export function startParticleNetwork(canvas: HTMLCanvasElement): ParticleNetwork {
  const ctx = canvas.getContext("2d")!;
  const particles: Particle[] = [];
  const pulses: Pulse[] = [];
  const audioRings: Ring[] = [];
  const ambientBlobs: Blob[] = [];
  let colors = { bg: "#0a0e17", primary: "34, 197, 94", secondary: "6, 182, 212" };
  let musicAudio: AudioLevels = { playing: false, low: 0, mid: 0, high: 0, energy: 0 };
  const smoothedAudio = { low: 0, mid: 0, high: 0, energy: 0 };
  let lastAudioRingAt = 0;
  let backgroundEffectEnabled = document.documentElement.dataset.backgroundEffect !== "off";
  let siteMode = document.documentElement.dataset.siteMode === "website" ? "website" : "desktop";
  let animationId = 0;
  let time = 0;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function getCssVar(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function readColors() {
    colors = {
      bg: getCssVar("--desktop-bg-color", "#0a0e17"),
      primary: getCssVar("--particle-primary-rgb", "34, 197, 94"),
      secondary: getCssVar("--particle-secondary-rgb", "6, 182, 212"),
    };
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const colorOf = (color: "cyan" | "green") => (color === "cyan" ? colors.secondary : colors.primary);

  resize();
  readColors();

  for (let i = 0; i < 4; i++) {
    ambientBlobs.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 150 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      color: Math.random() < 0.3 ? "cyan" : "green",
      alpha: 0.015 + Math.random() * 0.02,
    });
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const isHub = Math.random() < 0.1;
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * (isHub ? 0.2 : 0.4),
      vy: (Math.random() - 0.5) * (isHub ? 0.2 : 0.4),
      r: isHub ? 3 + Math.random() * 2 : Math.random() * 2 + 1,
      isHub,
      color: Math.random() < 0.15 ? "cyan" : "green",
      pulseTimer: Math.random() * 300,
      glowPhase: Math.random() * Math.PI * 2,
      glowSpeed: 0.01 + Math.random() * 0.02,
    });
  }

  const draw = () => {
    // The music player answers with a desktop:music-audio-frame.
    (
      window as typeof window & { __pepoMusicController?: { requestAudioFrame?: () => void } }
    ).__pepoMusicController?.requestAudioFrame?.();
    paintFrame();
    animationId = requestAnimationFrame(draw);
  };
  Object.defineProperty(draw, "name", { value: "draw" });

  function paintFrame() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    time += 0.016;
    smoothedAudio.low += (musicAudio.low - smoothedAudio.low) * 0.16;
    smoothedAudio.mid += (musicAudio.mid - smoothedAudio.mid) * 0.12;
    smoothedAudio.high += (musicAudio.high - smoothedAudio.high) * 0.18;
    smoothedAudio.energy += (musicAudio.energy - smoothedAudio.energy) * 0.14;
    const audioEnergy = musicAudio.playing ? smoothedAudio.energy : 0;
    const lowEnergy = musicAudio.playing ? smoothedAudio.low : 0;
    const midEnergy = musicAudio.playing ? smoothedAudio.mid : 0;
    const highEnergy = musicAudio.playing ? smoothedAudio.high : 0;
    const reactiveConnectionDist = CONNECTION_DIST + audioEnergy * 95;

    ambientBlobs.forEach((blob) => {
      blob.x += blob.vx * (1 + midEnergy * 2.4);
      blob.y += blob.vy * (1 + midEnergy * 2.4);
      if (blob.x < -blob.r) blob.x = canvas.width + blob.r;
      if (blob.x > canvas.width + blob.r) blob.x = -blob.r;
      if (blob.y < -blob.r) blob.y = canvas.height + blob.r;
      if (blob.y > canvas.height + blob.r) blob.y = -blob.r;

      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      const color = colorOf(blob.color);
      grad.addColorStop(0, "rgba(" + color + ", " + (blob.alpha + audioEnergy * 0.045) + ")");
      grad.addColorStop(1, "rgba(" + color + ", 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    });

    particles.forEach((particle) => {
      const audioDrift =
        musicAudio.playing && particle.isHub ? Math.sin(time * 2 + particle.glowPhase) * lowEnergy * 0.35 : 0;
      particle.x += particle.vx * (1 + highEnergy * 3.8) + audioDrift;
      particle.y += particle.vy * (1 + highEnergy * 3.8) + audioDrift * 0.45;
      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;

      particle.pulseTimer -= 1 + audioEnergy * 3.5;
      if (particle.pulseTimer <= 0) {
        particle.pulseTimer = particle.isHub
          ? 30 + Math.random() * 80
          : 100 + Math.random() * 400 - audioEnergy * 120;
        let nearest: Particle | null = null;
        let nearestDist = Infinity;
        particles.forEach((other) => {
          if (other === particle) return;
          const distance = Math.hypot(other.x - particle.x, other.y - particle.y);
          if (distance < reactiveConnectionDist && distance < nearestDist) {
            nearest = other;
            nearestDist = distance;
          }
        });
        const target = nearest as Particle | null;
        if (target) {
          pulses.push({
            x: particle.x,
            y: particle.y,
            tx: target.x,
            ty: target.y,
            progress: 0,
            speed: 0.02 + Math.random() * 0.03 + audioEnergy * 0.035,
            color: particle.color,
            audioBoost: audioEnergy,
            trail: [],
          });
        }
      }
    });

    if (musicAudio.playing && lowEnergy > 0.42 && time - lastAudioRingAt > 0.18) {
      lastAudioRingAt = time;
      const source = particles[Math.floor(Math.random() * particles.length)];
      if (source) {
        audioRings.push({
          x: source.x,
          y: source.y,
          radius: 8,
          alpha: 0.22 + lowEnergy * 0.45,
          speed: 3.5 + lowEnergy * 8,
          color: source.color,
        });
      }
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const distance = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if (distance < reactiveConnectionDist) {
          const alpha = (1 - distance / reactiveConnectionDist) * (0.22 + audioEnergy * 0.42);
          ctx.strokeStyle = "rgba(" + colors.primary + ", " + alpha + ")";
          ctx.lineWidth = 1 + audioEnergy * 1.4;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

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
      const baseColor = colorOf(pulse.color);

      for (let t = 0; t < pulse.trail.length; t++) {
        const trailAlpha = (t / pulse.trail.length) * 0.8;
        const trailR = 1 + (t / pulse.trail.length) * (2 + pulse.audioBoost * 5);
        ctx.beginPath();
        ctx.arc(pulse.trail[t].x, pulse.trail[t].y, trailR, 0, Math.PI * 2);
        ctx.fillStyle =
          "rgba(" +
          baseColor +
          ", " +
          trailAlpha * (1 - pulse.progress * 0.5) * (1 + pulse.audioBoost) +
          ")";
        ctx.fill();
      }

      const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, 12);
      glowGrad.addColorStop(
        0,
        "rgba(" + baseColor + ", " + (0.6 + pulse.audioBoost * 0.35) * (1 - pulse.progress) + ")",
      );
      glowGrad.addColorStop(1, "rgba(" + baseColor + ", 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = audioRings.length - 1; i >= 0; i--) {
      const ring = audioRings[i];
      ring.radius += ring.speed;
      ring.alpha *= 0.94;
      if (ring.alpha < 0.015 || ring.radius > 220) {
        audioRings.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + colorOf(ring.color) + ", " + ring.alpha + ")";
      ctx.lineWidth = 1.5 + lowEnergy * 3;
      ctx.stroke();
    }

    particles.forEach((particle) => {
      const glowPulse = Math.sin(time * particle.glowSpeed * 60 + particle.glowPhase) * 0.3 + 0.7;
      const baseColor = colorOf(particle.color);
      const glowR = (particle.isHub ? 20 : 10) * (1 + audioEnergy * (particle.isHub ? 2.1 : 1.25));
      const glowGrad = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, glowR);
      glowGrad.addColorStop(0, "rgba(" + baseColor + ", " + (0.3 * glowPulse + audioEnergy * 0.28) + ")");
      glowGrad.addColorStop(1, "rgba(" + baseColor + ", 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + baseColor + ", " + (0.6 * glowPulse + 0.2 + highEnergy * 0.38) + ")";
      ctx.fill();
    });

    const vignetteGrad = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.height * 0.3,
      canvas.width / 2,
      canvas.height / 2,
      canvas.height * 0.9,
    );
    vignetteGrad.addColorStop(0, "rgba(10, 14, 23, 0)");
    vignetteGrad.addColorStop(1, "rgba(10, 14, 23, 0.7)");
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function shouldShow() {
    return backgroundEffectEnabled && siteMode === "desktop" && !document.hidden;
  }

  function shouldAnimate() {
    return shouldShow() && !reducedMotionQuery.matches;
  }

  function syncAnimation() {
    if (shouldAnimate()) {
      if (!animationId) draw();
    } else {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = 0;
      }
      // Resizes and new colors clear or change the still frame.
      if (shouldShow()) paintFrame();
    }
  }

  const onResize = () => {
    resize();
    syncAnimation();
  };
  const onAudioFrame = (event: Event) => {
    const detail = (event as CustomEvent<Partial<AudioLevels>>).detail || {};
    musicAudio = {
      playing: Boolean(detail.playing),
      low: clamp01(detail.low),
      mid: clamp01(detail.mid),
      high: clamp01(detail.high),
      energy: clamp01(detail.energy),
    };
  };

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", syncAnimation);
  reducedMotionQuery.addEventListener("change", syncAnimation);
  document.addEventListener("desktop:music-audio-frame", onAudioFrame);
  syncAnimation();

  return {
    setPreferences(backgroundEffect) {
      readColors();
      backgroundEffectEnabled = backgroundEffect;
      syncAnimation();
    },
    setSiteMode(mode) {
      if (mode === siteMode) return;
      siteMode = mode;
      if (mode === "desktop") resize();
      syncAnimation();
    },
    destroy() {
      if (animationId) cancelAnimationFrame(animationId);
      animationId = 0;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotionQuery.removeEventListener("change", syncAnimation);
      document.removeEventListener("desktop:music-audio-frame", onAudioFrame);
    },
  };
}
