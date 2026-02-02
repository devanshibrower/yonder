export interface MeteorConfig {
  velocityKmPerSec: number;
  zhr: number;
  radiantX: number;
  radiantY: number;
  colorHue: number;
}

interface Star {
  x: number;
  y: number;
  brightness: number;
  radius: number;
  phase: number;
  twinkleSpeed: number;
  hue: number;
  saturation: number;
  isProminent: boolean;
  depth: number; // 0 = far, 1 = near — controls parallax amount
}

interface NebulaGlow {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  hue: number;
  opacity: number;
}

interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  length: number;
  opacity: number;
  thickness: number;
  hue: number;
  isFireball: boolean;
  life: number;
  maxLife: number;
}

export class MeteorAnimation {
  private config: MeteorConfig;
  private stars: Star[] = [];
  private nebulae: NebulaGlow[] = [];
  private meteors: Meteor[] = [];
  private spawnAccumulator = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  // Mouse: target is set instantly by events, current lerps toward it each frame
  private mouseTargetX = 0.5;
  private mouseTargetY = 0.5;
  private mouseX = 0.5;
  private mouseY = 0.5;

  constructor(config: MeteorConfig) {
    this.config = { ...config };
  }

  updateConfig(config: Partial<MeteorConfig>) {
    Object.assign(this.config, config);
  }

  /** Set normalized mouse target (0–1 each axis, 0.5 = center) */
  setMouse(x: number, y: number) {
    this.mouseTargetX = x;
    this.mouseTargetY = y;
  }

  setSize(width: number, height: number) {
    const needsStars = this.width === 0 && this.height === 0;
    this.width = width;
    this.height = height;
    if (needsStars) {
      this.generateStars();
      this.generateNebulae();
    }
  }

  private generateStars() {
    const count = 120 + Math.floor(Math.random() * 40);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      // ~20% of stars get a warm or cool tint
      let hue = 0;
      let saturation = 0;
      if (Math.random() < 0.2) {
        if (Math.random() < 0.5) {
          hue = 30 + Math.random() * 20;
          saturation = 20 + Math.random() * 15;
        } else {
          hue = 200 + Math.random() * 20;
          saturation = 20 + Math.random() * 15;
        }
      }

      // ~5% are prominent bright stars
      const isProminent = Math.random() < 0.05;

      const radius = isProminent
        ? 0.9 + Math.random() * 0.5
        : 0.3 + Math.random() * 0.7;

      // Depth correlates loosely with size — bigger/brighter stars feel closer
      const depth = isProminent
        ? 0.7 + Math.random() * 0.3
        : radius < 0.6 ? Math.random() * 0.3 : 0.2 + Math.random() * 0.5;

      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        brightness: isProminent
          ? 0.8 + Math.random() * 0.2
          : 0.15 + Math.random() * 0.75,
        radius,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() < 0.15
          ? 1.5 + Math.random() * 2.0
          : 0.2 + Math.random() * 0.5,
        hue,
        saturation,
        isProminent,
        depth,
      });
    }
  }

  private generateNebulae() {
    // 2-3 faint nebula-like glow patches for depth
    const count = 2 + Math.floor(Math.random() * 2);
    this.nebulae = [];
    for (let i = 0; i < count; i++) {
      this.nebulae.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        radiusX: 80 + Math.random() * 120,
        radiusY: 60 + Math.random() * 100,
        hue: Math.random() < 0.5
          ? 220 + Math.random() * 30   // blue-purple
          : 340 + Math.random() * 30,  // pink-red
        opacity: 0.02 + Math.random() * 0.02,
      });
    }
  }

  private spawnMeteor() {
    const { radiantX, radiantY, velocityKmPerSec, colorHue } = this.config;

    // Radiant position in pixels
    const rx = radiantX * this.width;
    const ry = radiantY * this.height;

    // Spawn at a random position across the entire canvas
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;

    // Direction: away from radiant
    const angle = Math.atan2(y - ry, x - rx);

    const baseSpeed = (velocityKmPerSec / 40) * 4;
    const speedVariance = 0.7 + Math.random() * 0.6;
    const speed = baseSpeed * speedVariance;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const isFireball = Math.random() < 0.05;

    // Wide size variation: small faint streaks to bold bright ones
    const sizeRoll = Math.random();
    let length: number;
    let thickness: number;

    if (isFireball) {
      length = 90 + Math.random() * 70;
      thickness = 3.0 + Math.random() * 2.5;
    } else if (sizeRoll < 0.4) {
      // Small/faint
      length = 12 + Math.random() * 20;
      thickness = 0.4 + Math.random() * 0.4;
    } else if (sizeRoll < 0.85) {
      // Medium
      length = 30 + Math.random() * 35;
      thickness = 0.8 + Math.random() * 0.8;
    } else {
      // Large/bold
      length = 60 + Math.random() * 40;
      thickness = 1.6 + Math.random() * 1.2;
    }

    // Shorter maxLife: ~1.5-2s of travel at 60fps
    const maxLife = 90 + Math.random() * 30;

    this.meteors.push({
      x,
      y,
      dx,
      dy,
      speed,
      length,
      opacity: isFireball ? 1.0 : sizeRoll < 0.4 ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
      thickness,
      hue: colorHue + (Math.random() - 0.5) * 20,
      isFireball,
      life: 0,
      maxLife,
    });
  }

  render(ctx: CanvasRenderingContext2D, timestamp: number) {
    if (this.width === 0 || this.height === 0) return;

    const dt = this.lastTime === 0 ? 16 : Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;

    // Smoothly interpolate mouse position toward target
    // 0.92^1 per frame at 60fps ≈ closes ~8% of the gap each frame
    const lerpSpeed = 1 - Math.pow(0.92, dt / 16);
    this.mouseX += (this.mouseTargetX - this.mouseX) * lerpSpeed;
    this.mouseY += (this.mouseTargetY - this.mouseY) * lerpSpeed;

    // Clear the entire canvas each frame — no ghosting overlay
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw sky gradient (subtle horizon glow)
    this.drawSkyGradient(ctx);

    // Draw twinkling stars
    this.drawStars(ctx, timestamp);

    // Spawn meteors based on ZHR
    const spawnRate = (this.config.zhr / 3600000) * dt * 8;
    this.spawnAccumulator += spawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnMeteor();
      this.spawnAccumulator -= 1;
    }

    // Update and draw meteors
    const frameScale = dt / 16;
    this.meteors = this.meteors.filter((m) => {
      m.x += m.dx * m.speed * frameScale;
      m.y += m.dy * m.speed * frameScale;
      m.life += frameScale;

      if (
        m.x < -100 ||
        m.x > this.width + 100 ||
        m.y < -100 ||
        m.y > this.height + 100 ||
        m.life > m.maxLife
      ) {
        return false;
      }

      this.drawMeteor(ctx, m);
      return true;
    });
  }

  private drawSkyGradient(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgb(9, 9, 11)";
    ctx.fillRect(0, 0, this.width, this.height);

    // Faint nebula glow patches for depth (parallax at mid-depth)
    const mx = (this.mouseX - 0.5) * 2;
    const my = (this.mouseY - 0.5) * 2;
    for (const n of this.nebulae) {
      const cx = n.x * this.width + -mx * 5;
      const cy = n.y * this.height + -my * 5;
      const r = Math.max(n.radiusX, n.radiusY);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, `hsla(${n.hue}, 40%, 30%, ${n.opacity})`);
      glow.addColorStop(1, `hsla(${n.hue}, 40%, 30%, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, timestamp: number) {
    const timeSec = timestamp / 1000;

    // Parallax: mouse offset from center, max shift 15px for depth=1
    const maxShift = 15;
    const mx = (this.mouseX - 0.5) * 2; // -1 to 1
    const my = (this.mouseY - 0.5) * 2;

    for (const star of this.stars) {
      // Shift in opposite direction of mouse (looking effect)
      const px = -mx * maxShift * star.depth;
      const py = -my * maxShift * star.depth;
      const x = star.x * this.width + px;
      const y = star.y * this.height + py;

      // Stars with fast twinkleSpeed blink more dramatically (0.1–1.0 range)
      // Others drift gently (0.6–1.0 range)
      const isBlinker = star.twinkleSpeed > 1.2;
      const wave = 0.5 + 0.5 * Math.sin(timeSec * star.twinkleSpeed + star.phase);
      const alpha = isBlinker
        ? star.brightness * (0.1 + 0.9 * wave)
        : star.brightness * (0.6 + 0.4 * wave);

      const color = star.saturation > 0
        ? `hsla(${star.hue}, ${star.saturation}%, 90%, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`;

      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
    const tailX = m.x - m.dx * m.length;
    const tailY = m.y - m.dy * m.length;

    // Fade in at start, faster fade out at end of life
    const lifeFrac = m.life / m.maxLife;
    const fadeIn = Math.min(m.life / 5, 1);
    const fadeOut = lifeFrac > 0.6 ? 1 - (lifeFrac - 0.6) / 0.4 : 1;
    const fade = fadeIn * fadeOut;

    // Stronger saturation for visible colors
    const sat = m.isFireball ? 70 : 50;
    const light = m.isFireball ? 95 : 85;

    // Trail: gradient from transparent tail → colored mid → bright head
    const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    gradient.addColorStop(0, `hsla(${m.hue}, ${sat}%, ${light}%, 0)`);
    gradient.addColorStop(
      0.8,
      `hsla(${m.hue}, ${sat}%, ${light}%, ${m.opacity * fade * 0.7})`
    );
    gradient.addColorStop(
      1,
      `hsla(${m.hue}, ${sat}%, ${light}%, ${m.opacity * fade})`
    );

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = m.thickness;
    ctx.lineCap = "round";
    ctx.stroke();

    // Head glow with higher saturation
    const glowRadius = m.isFireball ? 6 : 3;
    const headGlow = ctx.createRadialGradient(
      m.x,
      m.y,
      0,
      m.x,
      m.y,
      glowRadius
    );
    headGlow.addColorStop(
      0,
      `hsla(${m.hue}, ${sat}%, 98%, ${0.8 * fade})`
    );
    headGlow.addColorStop(
      1,
      `hsla(${m.hue}, ${sat}%, ${light}%, 0)`
    );

    ctx.beginPath();
    ctx.arc(m.x, m.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = headGlow;
    ctx.fill();
  }
}
