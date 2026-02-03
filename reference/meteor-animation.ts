export interface MeteorConfig {
  velocityKmPerSec: number;
  zhr: number;
  radiantX: number;
  radiantY: number;
  colorHue: number;
  moonIllumination: number;          // 0-100
  moonPhaseName: string;             // "new moon" | "waxing crescent" | ... | "waning crescent"
  parentObjectType: "comet" | "asteroid";
  velocityCategory: "slow" | "medium" | "swift";
  peakMonth: number;                 // 1-12
  colorVariance?: number;            // override hue spread (degrees)
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
  sizeClass: "faint" | "medium" | "bright" | "prominent";
  hueGroup: "white" | "warm" | "cool" | "yellow";
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
  saturation: number;
  hasAfterGlow: boolean;
  curvature: number;
}

type Season = "winter" | "spring" | "summer" | "fall";

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 10) return "fall";
  return "winter"; // Nov, Dec, Jan, Feb
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Map star properties to a hue group key
function getHueGroup(star: Star): "white" | "warm" | "cool" | "yellow" {
  if (star.saturation === 0) return "white";
  if (star.hue >= 25 && star.hue < 45) return "warm";
  if (star.hue >= 45 && star.hue < 75) return "yellow";
  if (star.hue >= 160 && star.hue <= 250) return "cool";
  return "white";
}

// Map star properties to a size class key
function getSizeClass(star: Star): "faint" | "medium" | "bright" | "prominent" {
  if (star.isProminent) return "prominent";
  if (star.brightness >= 0.5) return "bright";
  if (star.brightness >= 0.2) return "medium";
  return "faint";
}

// Hue group → base RGB color for texture generation
function hueGroupToRGB(group: "white" | "warm" | "cool" | "yellow"): [number, number, number] {
  switch (group) {
    case "white": return [255, 255, 255];
    case "warm": return [255, 210, 170];
    case "cool": return [170, 200, 255];
    case "yellow": return [255, 240, 180];
  }
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
  private lastPeakMonth: number | undefined = undefined;
  // Mouse: target is set instantly by events, current lerps toward it each frame
  private mouseTargetX = 0.5;
  private mouseTargetY = 0.5;
  private mouseX = 0.5;
  private mouseY = 0.5;
  // Star texture cache
  private starTextures: Map<string, HTMLCanvasElement> = new Map();
  // Scroll parallax
  private scrollOffset = 0;
  constructor(config: MeteorConfig) {
    this.config = { ...config };
    this.lastPeakMonth = config.peakMonth;
  }

  updateConfig(config: Partial<MeteorConfig>) {
    const prevMonth = this.config.peakMonth;
    Object.assign(this.config, config);
    // Regenerate nebulae when peakMonth changes (seasonal tinting)
    if (config.peakMonth !== undefined && config.peakMonth !== prevMonth) {
      this.lastPeakMonth = config.peakMonth;
      this.generateNebulae();
    }
  }

  /** Set normalized mouse target (0–1 each axis, 0.5 = center) */
  setMouse(x: number, y: number) {
    this.mouseTargetX = x;
    this.mouseTargetY = y;
  }

  /** Set scroll offset for star parallax (0–1) */
  setScrollOffset(offset: number) {
    this.scrollOffset = Math.max(0, Math.min(1, offset));
  }

  setSize(width: number, height: number) {
    const needsStars = this.width === 0 && this.height === 0;
    this.width = width;
    this.height = height;
    if (needsStars) {
      this.generateStars();
      this.generateStarClusters();
      this.generateNebulae();
    }
    this.generateStarTextures();
  }

  // --- Star texture cache ---

  private generateStarTextures() {
    this.starTextures.clear();

    const sizes: Record<string, number> = {
      bright: 16,
      prominent: 32,
    };
    const hueGroups: Array<"white" | "warm" | "cool" | "yellow"> = ["white", "warm", "cool", "yellow"];

    for (const [sizeClass, size] of Object.entries(sizes)) {
      for (const hueGroup of hueGroups) {
        const key = `${sizeClass}_${hueGroup}`;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const tctx = c.getContext("2d");
        if (!tctx) continue;

        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2;
        const [cr, cg, cb] = hueGroupToRGB(hueGroup);

        const grad = tctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 1.0)`);
        grad.addColorStop(0.05, `rgba(${cr}, ${cg}, ${cb}, 0.9)`);
        grad.addColorStop(0.15, `rgba(${cr}, ${cg}, ${cb}, 0.3)`);
        grad.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, 0.05)`);
        grad.addColorStop(1.0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, size, size);

        // Prominent stars get diffraction spikes
        if (sizeClass === "prominent") {
          tctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.15)`;
          tctx.lineWidth = 0.5;
          // Horizontal spike
          tctx.beginPath();
          tctx.moveTo(0, cy);
          tctx.lineTo(size, cy);
          tctx.stroke();
          // Vertical spike
          tctx.beginPath();
          tctx.moveTo(cx, 0);
          tctx.lineTo(cx, size);
          tctx.stroke();
        }

        this.starTextures.set(key, c);
      }
    }

    // Bloom textures for prominent stars (96×96)
    for (const hueGroup of hueGroups) {
      const bloomSize = 48;
      const c = document.createElement("canvas");
      c.width = bloomSize;
      c.height = bloomSize;
      const tctx = c.getContext("2d");
      if (!tctx) continue;

      const cx = bloomSize / 2;
      const cy = bloomSize / 2;
      const r = bloomSize / 2;
      const [cr, cg, cb] = hueGroupToRGB(hueGroup);

      const grad = tctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.3)`);
      grad.addColorStop(0.3, `rgba(${cr}, ${cg}, ${cb}, 0.08)`);
      grad.addColorStop(0.7, `rgba(${cr}, ${cg}, ${cb}, 0.02)`);
      grad.addColorStop(1.0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, bloomSize, bloomSize);

      this.starTextures.set(`bloom_${hueGroup}`, c);
    }
  }

  // --- Star generation ---

  private generateStars() {
    const count = 320 + Math.floor(Math.random() * 60); // 320-380
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(Math.random(), Math.random()));
    }

    // Milky way density boost: duplicate ~50% of stars in y [0.25, 0.45]
    const milkyWayStars: Star[] = [];
    for (const star of this.stars) {
      if (star.y >= 0.25 && star.y <= 0.45 && Math.random() < 0.35) {
        milkyWayStars.push(this.createStar(
          star.x + (Math.random() - 0.5) * 0.03,
          star.y + (Math.random() - 0.5) * 0.03
        ));
      }
    }
    this.stars.push(...milkyWayStars);
  }

  private createStar(x: number, y: number): Star {
    // ~35% of stars get a tint across 4 hue categories
    let hue = 0;
    let saturation = 0;
    if (Math.random() < 0.35) {
      const category = Math.random();
      if (category < 0.3) {
        // Warm orange
        hue = 25 + Math.random() * 20;
        saturation = 20 + Math.random() * 20;
      } else if (category < 0.55) {
        // Cool blue
        hue = 200 + Math.random() * 30;
        saturation = 20 + Math.random() * 20;
      } else if (category < 0.8) {
        // Yellow
        hue = 45 + Math.random() * 15;
        saturation = 15 + Math.random() * 15;
      } else {
        // Pale blue
        hue = 180 + Math.random() * 20;
        saturation = 10 + Math.random() * 15;
      }
    }

    // Power-law brightness distribution
    const roll = Math.random();
    let brightness: number;
    let radius: number;
    let isProminent = false;

    if (roll < 0.70) {
      // Faint
      brightness = 0.05 + Math.random() * 0.15;
      radius = 0.2 + Math.random() * 0.3;
    } else if (roll < 0.90) {
      // Medium
      brightness = 0.20 + Math.random() * 0.30;
      radius = 0.4 + Math.random() * 0.3;
    } else if (roll < 0.98) {
      // Bright
      brightness = 0.50 + Math.random() * 0.30;
      radius = 0.6 + Math.random() * 0.3;
    } else {
      // Prominent
      brightness = 0.80 + Math.random() * 0.20;
      radius = 0.9 + Math.random() * 0.5;
      isProminent = true;
    }

    // Depth correlates loosely with size — bigger/brighter stars feel closer
    const depth = isProminent
      ? 0.7 + Math.random() * 0.3
      : radius < 0.5 ? Math.random() * 0.3 : 0.2 + Math.random() * 0.5;

    const star: Star = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      brightness,
      radius,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() < 0.15
        ? 1.5 + Math.random() * 2.0
        : 0.2 + Math.random() * 0.5,
      hue,
      saturation,
      isProminent,
      depth,
      sizeClass: "faint", // set below
      hueGroup: "white",  // set below
    };
    star.sizeClass = getSizeClass(star);
    star.hueGroup = getHueGroup(star);
    return star;
  }

  private generateStarClusters() {
    // 2-3 tight groupings of 8-15 stars each
    const clusterCount = 2 + Math.floor(Math.random() * 2);
    for (let c = 0; c < clusterCount; c++) {
      // Place cluster center avoiding edges (15%-85% of canvas)
      const cx = 0.15 + Math.random() * 0.7;
      const cy = 0.15 + Math.random() * 0.7;
      const starCount = 8 + Math.floor(Math.random() * 8); // 8-15

      for (let i = 0; i < starCount; i++) {
        // Tight grouping: spread ~3% of canvas around center
        const x = cx + (Math.random() - 0.5) * 0.06;
        const y = cy + (Math.random() - 0.5) * 0.06;

        const star: Star = {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          brightness: 0.2 + Math.random() * 0.4, // moderate brightness
          radius: 0.3 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.2 + Math.random() * 0.4,
          hue: 200 + Math.random() * 20, // blue-white
          saturation: 10 + Math.random() * 15,
          isProminent: false,
          depth: Math.random() * 0.2, // far depth
          sizeClass: "faint",
          hueGroup: "white",
        };
        star.sizeClass = getSizeClass(star);
        star.hueGroup = getHueGroup(star);
        this.stars.push(star);
      }
    }
  }

  // --- Seasonal tinting for nebulae ---

  private generateNebulae() {
    const count = 2 + Math.floor(Math.random() * 2);
    this.nebulae = [];
    const season = getSeason(this.config.peakMonth);

    for (let i = 0; i < count; i++) {
      let hue: number;
      if (season === "winter") {
        // Blue-purple (220-260)
        hue = 220 + Math.random() * 40;
      } else if (season === "summer") {
        // Amber-gold (30-50) + warm purple mix
        hue = Math.random() < 0.6
          ? 30 + Math.random() * 20
          : 280 + Math.random() * 30;
      } else if (season === "spring") {
        // Teal-cyan (160-200)
        hue = 160 + Math.random() * 40;
      } else {
        // fall — Magenta-violet (280-320)
        hue = 280 + Math.random() * 40;
      }

      this.nebulae.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        radiusX: 80 + Math.random() * 120,
        radiusY: 60 + Math.random() * 100,
        hue,
        opacity: 0.03 + Math.random() * 0.03, // boosted from 0.02 + 0.02
      });
    }
  }

  // --- Meteor spawning ---

  private spawnMeteor() {
    const { radiantX, radiantY, velocityKmPerSec, colorHue, parentObjectType, velocityCategory } = this.config;

    // Radiant position in pixels
    const rx = radiantX * this.width;
    const ry = radiantY * this.height;

    // Spawn at a random position, enforcing minimum distance from radiant
    const minDist = Math.min(this.width, this.height) * 0.15;
    let x: number, y: number, dist: number;
    let attempts = 0;
    do {
      x = Math.random() * this.width;
      y = Math.random() * this.height;
      dist = Math.hypot(x - rx, y - ry);
      attempts++;
    } while (dist < minDist && attempts < 10);

    // Direction: away from radiant with angular spread
    const angle = Math.atan2(y - ry, x - rx);
    const spreadDeg = velocityCategory === "slow" ? 12 : velocityCategory === "swift" ? 5 : 8;
    const spread = (Math.random() - 0.5) * (spreadDeg * Math.PI / 180) * 2;
    const finalAngle = angle + spread;

    // Speed: power curve for distinct shower feel
    const normalizedV = (velocityKmPerSec - 20) / 55;
    const baseSpeed = 2 + Math.pow(Math.max(0, normalizedV), 1.4) * 7;
    const speedVariance = 0.85 + Math.random() * 0.3;
    const speed = baseSpeed * speedVariance;

    const dx = Math.cos(finalAngle);
    const dy = Math.sin(finalAngle);

    // Parent object affects fireball chance
    const fireballChance = parentObjectType === "asteroid" ? 0.12 : 0.05;
    const isFireball = Math.random() < fireballChance;

    // Wide size variation: small faint streaks to bold bright ones
    let sizeRoll = Math.random();
    const moonBias = this.config.moonIllumination / 100;
    sizeRoll = sizeRoll + moonBias * 0.3 * (1 - sizeRoll);
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
    let maxLife = 90 + Math.random() * 30;

    // Parent object → trail behavior
    let hueVariance: number;
    if (this.config.colorVariance !== undefined) {
      hueVariance = this.config.colorVariance;
    } else {
      hueVariance = parentObjectType === "comet" ? 60 : 20;
    }
    let saturation: number;
    let hasAfterGlow = false;

    if (parentObjectType === "comet") {
      maxLife *= 1.3;
      saturation = isFireball ? 65 : 25 + Math.random() * 20;
      // Medium/large meteors get afterglow
      if (!isFireball && sizeRoll >= 0.4) {
        hasAfterGlow = true;
      }
    } else {
      // asteroid
      maxLife *= 0.8;
      saturation = isFireball ? 55 : 10 + Math.random() * 15;
      hasAfterGlow = false;
    }

    // Velocity → streak character
    let curvature = 0;
    if (velocityCategory === "swift") {
      length *= 1.5;
      thickness *= 0.6;
    } else if (velocityCategory === "slow") {
      length *= 0.6;
      thickness *= 1.6;
      curvature = (Math.random() - 0.5) * 0.01; // ±0.005 rad/frame
    }
    // "medium": no modification

    this.meteors.push({
      x,
      y,
      dx,
      dy,
      speed,
      length,
      opacity: isFireball ? 1.0 : sizeRoll < 0.4 ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
      thickness,
      hue: colorHue + (Math.random() - 0.5) * hueVariance,
      isFireball,
      life: 0,
      maxLife,
      saturation,
      hasAfterGlow,
      curvature,
    });
  }

  // --- Main render loop ---

  render(ctx: CanvasRenderingContext2D, timestamp: number) {
    if (this.width === 0 || this.height === 0) return;

    const dt = this.lastTime === 0 ? 16 : Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;

    // Smoothly interpolate mouse position toward target
    const lerpSpeed = 1 - Math.pow(0.92, dt / 16);
    this.mouseX += (this.mouseTargetX - this.mouseX) * lerpSpeed;
    this.mouseY += (this.mouseTargetY - this.mouseY) * lerpSpeed;

    // Clear the entire canvas each frame — no ghosting overlay
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Sky background
    this.drawSkyGradient(ctx);

    // 2. Stars (behind moon)
    this.drawStars(ctx, timestamp);

    // 4. Spawn + draw meteors (on top of everything)
    const zhr = this.config.zhr;
    const visualRate = zhr <= 0 ? 0 : 0.15 + 2.5 * Math.pow(zhr / 150, 0.75);
    const moonDimming = 1.0 - (this.config.moonIllumination / 100) * 0.25;
    const spawnRate = visualRate * moonDimming * (dt / 1000);
    this.spawnAccumulator += spawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnMeteor();
      this.spawnAccumulator -= 1;
    }

    const frameScale = dt / 16;
    this.meteors = this.meteors.filter((m) => {
      // Apply curvature rotation to direction vector
      if (m.curvature !== 0) {
        const angle = m.curvature * frameScale;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newDx = m.dx * cos - m.dy * sin;
        const newDy = m.dx * sin + m.dy * cos;
        m.dx = newDx;
        m.dy = newDy;
      }

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

  // --- Sky gradient ---

  private get moonFraction(): number {
    return this.config.moonIllumination / 100;
  }

  private drawSkyGradient(ctx: CanvasRenderingContext2D) {
    const mf = this.moonFraction;

    // Vertical gradient: zenith (top) to horizon (bottom)
    const zenithR = Math.round(lerp(6, 14, mf));
    const zenithG = Math.round(lerp(6, 16, mf));
    const zenithB = Math.round(lerp(9, 25, mf));
    const horizonR = Math.round(lerp(12, 22, mf));
    const horizonG = Math.round(lerp(12, 25, mf));
    const horizonB = Math.round(lerp(16, 38, mf));

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, `rgb(${zenithR}, ${zenithG}, ${zenithB})`);
    skyGrad.addColorStop(1, `rgb(${horizonR}, ${horizonG}, ${horizonB})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Milky way band — wide horizontal glow at y ≈ 35%
    const mx = (this.mouseX - 0.5) * 2;
    const my = (this.mouseY - 0.5) * 2;
    const milkyOpacity = 0.02 * (1 - mf * 0.6);
    const milkyCx = this.width / 2 + -mx * 8;
    const milkyCy = this.height * 0.35 + -my * 6;
    const milkyRx = this.width * 0.6;
    const milkyRy = 100;

    // Draw milky way as elliptical radial gradient using canvas transform
    ctx.save();
    ctx.translate(milkyCx, milkyCy);
    ctx.scale(1, milkyRy / milkyRx);
    ctx.translate(-milkyCx, -milkyCy * milkyRx / milkyRy);
    const mwGrad = ctx.createRadialGradient(milkyCx, milkyCy * milkyRx / milkyRy, 0, milkyCx, milkyCy * milkyRx / milkyRy, milkyRx);
    mwGrad.addColorStop(0, `hsla(220, 15%, 40%, ${milkyOpacity})`);
    mwGrad.addColorStop(0.5, `hsla(220, 15%, 35%, ${milkyOpacity * 0.5})`);
    mwGrad.addColorStop(1, `hsla(220, 15%, 30%, 0)`);
    ctx.fillStyle = mwGrad;
    ctx.fillRect(milkyCx - milkyRx, milkyCy * milkyRx / milkyRy - milkyRx, milkyRx * 2, milkyRx * 2);
    ctx.restore();

    // Faint nebula glow patches — dimmed by moon
    const nebulaOpacityScale = 1.0 - mf * 0.4;
    for (const n of this.nebulae) {
      const cx = n.x * this.width + -mx * 5;
      const cy = n.y * this.height + -my * 5;
      const rad = Math.max(n.radiusX, n.radiusY);
      const adjustedOpacity = n.opacity * nebulaOpacityScale;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      glow.addColorStop(0, `hsla(${n.hue}, 40%, 30%, ${adjustedOpacity})`);
      glow.addColorStop(1, `hsla(${n.hue}, 40%, 30%, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }

    // Seasonal horizon glow
    const season = getSeason(this.config.peakMonth);
    if (season !== "winter") {
      let horizonHue: number;
      let horizonSat: number;
      let horizonOpacity: number;

      if (season === "summer") {
        horizonHue = 35;   // amber
        horizonSat = 50;
        horizonOpacity = 0.04;
      } else if (season === "spring") {
        horizonHue = 175;  // teal
        horizonSat = 40;
        horizonOpacity = 0.03;
      } else {
        // fall
        horizonHue = 20;   // warm
        horizonSat = 45;
        horizonOpacity = 0.03;
      }

      // Dim horizon glow under moonlight
      horizonOpacity *= (1.0 - mf * 0.5);

      const horizonY = this.height * 0.85;
      const grad = ctx.createLinearGradient(0, horizonY, 0, this.height);
      grad.addColorStop(0, `hsla(${horizonHue}, ${horizonSat}%, 30%, 0)`);
      grad.addColorStop(1, `hsla(${horizonHue}, ${horizonSat}%, 30%, ${horizonOpacity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizonY, this.width, this.height - horizonY);
    }
  }

  // --- Star drawing with texture caching ---

  private drawStars(ctx: CanvasRenderingContext2D, timestamp: number) {
    const timeSec = timestamp / 1000;
    const mf = this.moonFraction;

    // Star alpha dimmed by moonlight
    const starDimming = 1.0 - mf * 0.6;

    // Parallax: mouse offset from center, max shift 15px for depth=1
    const maxShift = 15;
    const mx = (this.mouseX - 0.5) * 2; // -1 to 1
    const my = (this.mouseY - 0.5) * 2;

    for (const star of this.stars) {
      // Shift in opposite direction of mouse (looking effect)
      const px = -mx * maxShift * star.depth;
      const py = -my * maxShift * star.depth;
      // Scroll parallax: shift vertically based on scroll offset
      const scrollShift = this.scrollOffset * 30 * star.depth;
      const x = star.x * this.width + px;
      const y = star.y * this.height + py - scrollShift;

      // Stars with fast twinkleSpeed blink more dramatically (0.1–1.0 range)
      // Others drift gently (0.6–1.0 range)
      const isBlinker = star.twinkleSpeed > 1.2;
      const wave = 0.5 + 0.5 * Math.sin(timeSec * star.twinkleSpeed + star.phase);
      const baseAlpha = isBlinker
        ? star.brightness * (0.1 + 0.9 * wave)
        : star.brightness * (0.6 + 0.4 * wave);

      const alpha = baseAlpha * starDimming;

      // Skip invisible stars
      if (alpha < 0.02) continue;

      // Faint and medium: sharp pixel dots, no texture
      if (star.sizeClass === "faint" || star.sizeClass === "medium") {
        const color = star.saturation > 0
          ? `hsla(${star.hue}, ${star.saturation}%, 90%, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
        ctx.fillStyle = color;
        ctx.beginPath();

        if (star.sizeClass === "faint") {
          ctx.arc(x, y, 0.5 + star.brightness * 0.3, 0, Math.PI * 2);
        } else {
          ctx.arc(x, y, 0.8 + star.brightness * 0.4, 0, Math.PI * 2);
        }
        ctx.fill();
        continue;
      }

      // Bright and prominent: use cached texture (glow is intentional)
      const textureKey = `${star.sizeClass}_${star.hueGroup}`;
      const tex = this.starTextures.get(textureKey);
      if (!tex) continue;

      const drawSize = tex.width;
      ctx.globalAlpha = alpha;
      ctx.drawImage(tex, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);

      // Prominent: add bloom
      if (star.isProminent) {
        const bloom = this.starTextures.get(`bloom_${star.hueGroup}`);
        if (bloom) {
          ctx.globalAlpha = alpha * 0.06;
          const bloomSize = bloom.width;
          ctx.drawImage(bloom, x - bloomSize / 2, y - bloomSize / 2, bloomSize, bloomSize);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // --- Meteor drawing ---

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
    const tailX = m.x - m.dx * m.length;
    const tailY = m.y - m.dy * m.length;

    // Fade in at start, faster fade out at end of life
    const lifeFrac = m.life / m.maxLife;
    const fadeIn = Math.min(m.life / 5, 1);
    const fadeOut = lifeFrac > 0.6 ? 1 - (lifeFrac - 0.6) / 0.4 : 1;
    const fade = fadeIn * fadeOut;

    // Moon brightness boost so meteors remain visible under moonlight
    const mf = this.moonFraction;
    const moonBoost = 1.0 + mf * 0.5;

    // Use per-meteor saturation
    const sat = m.saturation;
    const light = m.isFireball ? 95 : 85;

    // Comet afterglow
    if (m.hasAfterGlow) {
      const afterGlowGrad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      afterGlowGrad.addColorStop(0, `hsla(${m.hue}, ${sat}%, ${light}%, 0)`);
      afterGlowGrad.addColorStop(0.5, `hsla(${m.hue}, ${sat}%, ${light}%, ${m.opacity * fade * 0.15 * moonBoost})`);
      afterGlowGrad.addColorStop(1, `hsla(${m.hue}, ${sat}%, ${light}%, ${m.opacity * fade * 0.2 * moonBoost})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = afterGlowGrad;
      ctx.lineWidth = m.thickness * 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Trail: gradient from transparent tail → colored mid → bright head
    const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    gradient.addColorStop(0, `hsla(${m.hue}, ${sat}%, ${light}%, 0)`);
    gradient.addColorStop(
      0.8,
      `hsla(${m.hue}, ${sat}%, ${light}%, ${Math.min(m.opacity * fade * 0.7 * moonBoost, 1)})`
    );
    gradient.addColorStop(
      1,
      `hsla(${m.hue}, ${sat}%, ${light}%, ${Math.min(m.opacity * fade * moonBoost, 1)})`
    );

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = m.thickness;
    ctx.lineCap = "round";
    ctx.stroke();

    // Head glow
    let glowRadius = m.isFireball ? 8 : 4;

    // Asteroid fireball flash at life < 3 frames
    if (m.isFireball && this.config.parentObjectType === "asteroid" && m.life < 3) {
      glowRadius *= 2.5;
    }

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
      `hsla(${m.hue}, ${sat}%, 98%, ${Math.min(0.8 * fade * moonBoost, 1)})`
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
