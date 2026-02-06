import { MeteorConfig } from "./utils";

//this file is a class. it defines what the animation engine can do and then we will create an instance of it that actually runs.

//helper: linear interpolation, same as in utils, but local to this file so the engine has no dependency for its core math

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type Season = "winter" | "spring" | "summer" | "fall";

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 10) return "fall";
  return "winter"; // Nov, Dec, Jan, Feb
}

// Map star to hue group for texture caching
function getHueGroup(star: Star): "white" | "warm" | "cool" | "yellow" {
  if (star.saturation === 0) return "white";
  if (star.hue >= 25 && star.hue < 45) return "warm";
  if (star.hue >= 45 && star.hue < 75) return "yellow";
  if (star.hue >= 160 && star.hue <= 250) return "cool";
  return "white";
}

// Map star to size class
function getSizeClass(star: Star): "faint" | "medium" | "bright" | "prominent" {
  if (star.isProminent) return "prominent";
  if (star.brightness >= 0.5) return "bright";
  if (star.brightness >= 0.2) return "medium";
  return "faint";
}

// Hue group to RGB for textures
function hueGroupToRGB(
  group: "white" | "warm" | "cool" | "yellow"
): [number, number, number] {
  switch (group) {
    case "white":
      return [255, 255, 255];
    case "warm":
      return [255, 180, 120]; // more orange
    case "cool":
      return [140, 180, 255]; // more blue
    case "yellow":
      return [255, 230, 150]; // more golden (was 255, 240, 180)
  }
}

//interface for a star - used in starfield
interface Star {
  x: number; //position - fraction of canvas width
  y: number; //position - fraction of canvas height
  brightness: number; //0-1, how bright at maximum
  radius: number; //pixel size
  phase: number; // random value between 0 and 2π for twinkling timing
  twinkleSpeed: number; //how fast the star twinkles
  depth: number; // 0 = far, 1 = near — controls parallax amount
  hue: number; // 0 for white, or color angle (25-45 warm, 45-75 yellow, 180-250 cool)
  saturation: number; // 0 for white stars, 10-40 for tinted
  isProminent: boolean; // brightest 2% of stars get bloom effect
  sizeClass: "faint" | "medium" | "bright" | "prominent"; // for texture lookup
  hueGroup: "white" | "warm" | "cool" | "yellow"; // for texture lookup
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
  x: number; //current pixel position
  y: number;
  dx: number; //direction vector (normalized)
  dy: number;
  speed: number; //pixels per frame
  length: number; //trail length in pixels
  opacity: number; //0-1
  thickness: number; //line width
  hue: number; //color
  isFireball: boolean; //extra bright + big
  life: number; //frames alive so far
  maxLife: number; //frames before it dies
  saturation: number; //color intensity
}

export class MeteorAnimation {
  //"private" means only code inside this class can access these. Outside code uses the public methods (updateConfig, setMouse etc)
  private config: MeteorConfig;
  private width = 0;
  private height = 0;
  private lastTime = 0;

  //Mouse position: normalized 0-1, 0.5 = center of screen
  private mouseTargetX = 0.5;
  private mouseTargetY = 0.5;
  private mouseX = 0.5;
  private mouseY = 0.5;

  //"constructor" runs once when create a new instance: const engine = new MeteorAnimation(someConfig)
  constructor(config: MeteorConfig) {
    this.config = { ...config };
  }

  //replace the current config (called every frame during scroll)
  updateConfig(config: Partial<MeteorConfig>) {
    const prevMonth = this.config.peakMonth;
    Object.assign(this.config, config);
    // Regenerate nebulae when peakMonth changes (seasonal tinting)
    if (config.peakMonth !== undefined && config.peakMonth !== prevMonth) {
      this.generateNebulae();
    }
  }

  //set mouse position (called from mousemove listener)
  setMouse(x: number, y: number) {
    this.mouseTargetX = x;
    this.mouseTargetY = y;
  }

  //star properties
  private stars: Star[] = [];
  private nebulae: NebulaGlow[] = [];
  private meteors: Meteor[] = [];
  private starTextures: Map<string, HTMLCanvasElement> = new Map();
  private spawnAccumulator = 0; //tracks fractional meteor spawns between frames.

  //Add the spawn method
  private spawnMeteor() {
    const { radiantX, radiantY, velocityKmPerSec, colorHue, parentObjectType } =
      this.config;

    //radient position in pixels
    const rx = radiantX * this.width;
    const ry = radiantY * this.height;

    //random spawn position at least 15% of screen away from radiant
    const minDist = Math.min(this.width, this.height) * 0.15;
    let x: number, y: number, dist: number;
    let attempts = 0;
    do {
      x = Math.random() * this.width;
      y = Math.random() * this.height;
      dist = Math.hypot(x - rx, y - ry);
      attempts++;
    } while (dist < minDist && attempts < 10);

    //Direction is away from radiant
    const angle = Math.atan2(y - ry, x - rx);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    //speed from real velocity data, mapped to pixels
    const normalizedV = (velocityKmPerSec - 20) / 55;
    const baseSpeed = 2 + Math.pow(Math.max(0, normalizedV), 1.4) * 12;
    const speed = baseSpeed * (0.85 + Math.random() * 0.3);
    //velocityFactor: 0.6 for slow meteors and 1.4 for faster, affects trail length
    const velocityFactor = 0.6 + normalizedV * 0.8;

    //fireball chance - asteroids produce more fireballs
    const isFireball =
      Math.random() < (parentObjectType === "asteroid" ? 0.12 : 0.05);

    //size variation
    const sizeRoll = Math.random();
    let length: number, thickness: number;
    if (isFireball) {
      length = (90 + Math.random() * 70) * velocityFactor;
      thickness = 3.0 + Math.random() * 2.5;
    } else if (sizeRoll < 0.4) {
      length = (12 + Math.random() * 20) * velocityFactor;
      thickness = 0.4 + Math.random() * 0.4;
    } else if (sizeRoll < 0.85) {
      length = (30 + Math.random() * 35) * velocityFactor;
      thickness = 0.8 + Math.random() * 0.8;
    } else {
      length = (60 + Math.random() * 40) * velocityFactor;
      thickness = 1.6 + Math.random() * 1.2;
    }

    this.meteors.push({
      x,
      y,
      dx,
      dy,
      speed,
      length,
      thickness,
      isFireball,
      opacity: isFireball ? 1.0 : 0.3 + Math.random() * 0.7,
      hue: colorHue + (Math.random() - 0.5) * 40,
      life: 0,
      maxLife: 90 + Math.random() * 30,
      saturation: isFireball ? 65 : 40 + Math.random() * 30,
    });
  }
  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
    const tailX = m.x - m.dx * m.length;
    const tailY = m.y - m.dy * m.length;

    // Fade in at start, fade out at end of life
    const lifeFrac = m.life / m.maxLife;
    const fadeIn = Math.min(m.life / 5, 1);
    const fadeOut = lifeFrac > 0.6 ? 1 - (lifeFrac - 0.6) / 0.4 : 1;
    const fade = fadeIn * fadeOut;

    const sat = m.saturation;
    const light = m.isFireball ? 95 : 85;

    // Trail: gradient from transparent tail to bright head
    const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    gradient.addColorStop(0, `hsla(${m.hue}, ${sat}%, ${light}%, 0)`);
    gradient.addColorStop(
      0.8,
      `hsla(${m.hue}, ${sat}%, ${light}%, ${Math.min(
        m.opacity * fade * 0.7,
        1
      )})`
    );
    gradient.addColorStop(
      1,
      `hsla(${m.hue}, ${sat}%, ${light}%,
    ${Math.min(m.opacity * fade, 1)})`
    );

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = m.thickness;
    ctx.lineCap = "round";
    ctx.stroke();

    // Head glow
    const glowRadius = m.isFireball ? 8 : 4;
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
      `hsla(${m.hue}, ${sat}%, 98%,
    ${Math.min(0.8 * fade, 1)})`
    );
    headGlow.addColorStop(1, `hsla(${m.hue}, ${sat}%, ${light}%, 0)`);
    ctx.beginPath();
    ctx.arc(m.x, m.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = headGlow;
    ctx.fill();
  }

  //set canvas dimensions (called on resize)
  setSize(width: number, height: number) {
    const needStars = this.width === 0 && this.height === 0;
    this.width = width;
    this.height = height;
    if (needStars) {
      this.generateStars();
      this.generateStarClusters();
      this.generateNebulae();
    }
    this.generateStarTextures();
  }

  // Helper to create a single star with all properties
  private createStar(x: number, y: number): Star {
    // ~45% of stars get a color tint
    let hue = 0;
    let saturation = 0;
    if (Math.random() < 0.45) {
      const category = Math.random();
      if (category < 0.3) {
        // Warm orange (like Betelgeuse, Aldebaran)
        hue = 20 + Math.random() * 25; // 20-45 (slightly wider range)
        saturation = 45 + Math.random() * 35; // 45-80 (was 20-40)
      } else if (category < 0.55) {
        // Cool blue (like Rigel, Spica)
        hue = 200 + Math.random() * 40; // 200-240
        saturation = 50 + Math.random() * 30; // 50-80 (was 20-40)
      } else if (category < 0.8) {
        // Yellow (like Capella, Pollux)
        hue = 40 + Math.random() * 20; // 40-60
        saturation = 40 + Math.random() * 30; // 40-70 (was 15-30)
      } else {
        // Pale blue-white (like Vega, Sirius)
        hue = 180 + Math.random() * 30; // 180-210
        saturation = 25 + Math.random() * 25; // 25-50 (was 10-25)
      }
    }

    // Power-law brightness: most stars are faint, few are bright
    const roll = Math.random();
    let brightness: number;
    let radius: number;
    let isProminent = false;

    if (roll < 0.7) {
      // 70% are faint
      brightness = 0.05 + Math.random() * 0.15;
      radius = 0.2 + Math.random() * 0.3;
    } else if (roll < 0.9) {
      // 20% are medium
      brightness = 0.2 + Math.random() * 0.3;
      radius = 0.4 + Math.random() * 0.3;
    } else if (roll < 0.98) {
      // 8% are bright
      brightness = 0.5 + Math.random() * 0.3;
      radius = 0.6 + Math.random() * 0.3;
    } else {
      // 2% are prominent
      brightness = 0.8 + Math.random() * 0.2;
      radius = 0.9 + Math.random() * 0.5;
      isProminent = true;
    }

    // Depth correlates loosely with size — bigger/brighter stars feel closer
    const depth = isProminent
      ? 0.7 + Math.random() * 0.3
      : radius < 0.5
      ? Math.random() * 0.3
      : 0.2 + Math.random() * 0.5;

    const star: Star = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      brightness,
      radius,
      phase: Math.random() * Math.PI * 2,
      // 15% of stars are "blinkers" with fast twinkle
      twinkleSpeed:
        Math.random() < 0.15
          ? 1.5 + Math.random() * 2.0
          : 0.2 + Math.random() * 0.5,
      depth,
      hue,
      saturation,
      isProminent,
      sizeClass: "faint", // Will be set below
      hueGroup: "white", // Will be set below
    };

    // Set derived properties
    star.sizeClass = getSizeClass(star);
    star.hueGroup = getHueGroup(star);

    return star;
  }

  // Method to generate stars
  private generateStars() {
    const count = 450 + Math.floor(Math.random() * 100); // 450-550 stars
    this.stars = [];

    // Generate initial star field
    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(Math.random(), Math.random()));
    }

    // Milky Way density boost: duplicate ~35% of stars in y range [0.25, 0.45]
    // This creates a denser horizontal band representing the galactic plane
    const milkyWayStars: Star[] = [];
    for (const star of this.stars) {
      if (star.y >= 0.25 && star.y <= 0.45 && Math.random() < 0.35) {
        milkyWayStars.push(
          this.createStar(
            star.x + (Math.random() - 0.5) * 0.03,
            star.y + (Math.random() - 0.5) * 0.03
          )
        );
      }
    }
    this.stars.push(...milkyWayStars);
  }

  // Generate 2-3 tight star clusters
  private generateStarClusters() {
    const clusterCount = 2 + Math.floor(Math.random() * 2); // 2-3 clusters

    for (let c = 0; c < clusterCount; c++) {
      // Place cluster center, avoiding edges (keep within 15%-85% of canvas)
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

  // Generate seasonal nebulae
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
        hue =
          Math.random() < 0.6
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
        opacity: 0.03 + Math.random() * 0.03,
      });
    }
  }

  // Generate pre-rendered textures for bright/prominent stars with bloom
  private generateStarTextures() {
    this.starTextures.clear();

    const sizes: Record<string, number> = {
      bright: 16,
      prominent: 32,
    };
    const hueGroups: Array<"white" | "warm" | "cool" | "yellow"> = [
      "white",
      "warm",
      "cool",
      "yellow",
    ];

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

    // Bloom textures for prominent stars (48×48)
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

  //main render method - called every frame
  render(ctx: CanvasRenderingContext2D, timestamp: number) {
    if (this.width === 0 || this.height === 0) return;

    //delta time in milliseconds since last frame, capped at 50ms to avoid huge jumps. This keeps animation smooth even if a frame takes longer.

    const dt =
      this.lastTime === 0 ? 16 : Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;

    //smooth move mouse toward target each frame
    const lerpSpeed = 1 - Math.pow(0.92, dt / 16);
    this.mouseX += (this.mouseTargetX - this.mouseX) * lerpSpeed;
    this.mouseY += (this.mouseTargetY - this.mouseY) * lerpSpeed;

    //clear the entire canvas each frame - no ghosting overlay
    ctx.clearRect(0, 0, this.width, this.height);

    // draw key gradient
    this.drawSkyGradient(ctx);
    this.drawStars(ctx, timestamp);

    // Spawn + update + draw meteors
    const zhr = this.config.zhr;
    const visualRate = zhr <= 0 ? 0 : 0.3 + 4.0 * Math.pow(zhr / 150, 0.6);
    const spawnRate = visualRate * (dt / 1000);
    this.spawnAccumulator += spawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnMeteor();
      this.spawnAccumulator -= 1;
    }

    const frameScale = dt / 16;
    this.meteors = this.meteors.filter((m) => {
      // Move meteor along its direction
      m.x += m.dx * m.speed * frameScale;
      m.y += m.dy * m.speed * frameScale;
      m.life += frameScale;

      // Remove if off screen or life expired
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

  // Moon fraction helper
  private get moonFraction(): number {
    return this.config.moonIllumination / 100;
  }

  //sky background: vertical gradient from dark zenith (top) to lighter horizon (bottom). Moon brightness shifts colors, brighter moon = lighter sky.
  private drawSkyGradient(ctx: CanvasRenderingContext2D) {
    const mf = this.moonFraction;

    //lerp between dark (new mooon) and lighter (full moon)
    const zenithR = Math.round(lerp(6, 14, mf));
    const zenithG = Math.round(lerp(6, 16, mf));
    const zenithB = Math.round(lerp(9, 25, mf));
    const horizonR = Math.round(lerp(12, 22, mf));
    const horizonG = Math.round(lerp(12, 25, mf));
    const horizonB = Math.round(lerp(16, 38, mf));

    //createLinearGradient(x0, y0, x1, y1) - graident from point 1 to point 2. Here, the top of canvas to bottom = vertical gradient.
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
    ctx.translate(-milkyCx, (-milkyCy * milkyRx) / milkyRy);
    const mwGrad = ctx.createRadialGradient(
      milkyCx,
      (milkyCy * milkyRx) / milkyRy,
      0,
      milkyCx,
      (milkyCy * milkyRx) / milkyRy,
      milkyRx
    );
    mwGrad.addColorStop(0, `hsla(220, 15%, 40%, ${milkyOpacity})`);
    mwGrad.addColorStop(0.5, `hsla(220, 15%, 35%, ${milkyOpacity * 0.5})`);
    mwGrad.addColorStop(1, `hsla(220, 15%, 30%, 0)`);
    ctx.fillStyle = mwGrad;
    ctx.fillRect(
      milkyCx - milkyRx,
      (milkyCy * milkyRx) / milkyRy - milkyRx,
      milkyRx * 2,
      milkyRx * 2
    );
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
        horizonHue = 35; // amber
        horizonSat = 50;
        horizonOpacity = 0.04;
      } else if (season === "spring") {
        horizonHue = 175; // teal
        horizonSat = 40;
        horizonOpacity = 0.03;
      } else {
        // fall
        horizonHue = 20; // warm
        horizonSat = 45;
        horizonOpacity = 0.03;
      }

      // Dim horizon glow under moonlight
      horizonOpacity *= 1.0 - mf * 0.5;

      const horizonY = this.height * 0.85;
      const grad = ctx.createLinearGradient(0, horizonY, 0, this.height);
      grad.addColorStop(0, `hsla(${horizonHue}, ${horizonSat}%, 30%, 0)`);
      grad.addColorStop(
        1,
        `hsla(${horizonHue}, ${horizonSat}%, 30%, ${horizonOpacity})`
      );
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizonY, this.width, this.height - horizonY);
    }
  }

  //--------------------------------
  // Star field
  //--------------------------------
  //drawstars method
  private drawStars(ctx: CanvasRenderingContext2D, timestamp: number) {
    const timeSec = timestamp / 1000;
    const mf = this.moonFraction;

    //moon dims stars, brighter moon = dimmer stars
    const starDimming = 1 - mf * 0.6;
    const maxShift = 15;
    const mx = (this.mouseX - 0.5) * 2; //-1 to 1
    const my = (this.mouseY - 0.5) * 2; //-1 to 1

    for (const star of this.stars) {
      //parallax shift stars opposite to mouse direction and stars with higher depth (closer) shift more, max 15px
      const px = -mx * maxShift * star.depth;
      const py = -my * maxShift * star.depth;
      const x = star.x * this.width + px;
      const y = star.y * this.height + py;

      // Stars with fast twinkleSpeed blink more dramatically (0.1–1.0 range)
      // Others drift gently (0.6–1.0 range)
      const isBlinker = star.twinkleSpeed > 1.2;
      const wave =
        0.5 + 0.5 * Math.sin(timeSec * star.twinkleSpeed + star.phase);
      const baseAlpha = isBlinker
        ? star.brightness * (0.1 + 0.9 * wave)
        : star.brightness * (0.6 + 0.4 * wave);

      const alpha = baseAlpha * starDimming;

      //skip invisible stars
      if (alpha < 0.02) continue;

      // Faint and medium: sharp pixel dots, no texture
      if (star.sizeClass === "faint" || star.sizeClass === "medium") {
        const color =
          star.saturation > 0
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
      ctx.drawImage(
        tex,
        x - drawSize / 2,
        y - drawSize / 2,
        drawSize,
        drawSize
      );

      // Prominent: add bloom
      if (star.isProminent) {
        const bloom = this.starTextures.get(`bloom_${star.hueGroup}`);
        if (bloom) {
          ctx.globalAlpha = alpha * 0.06;
          const bloomSize = bloom.width;
          ctx.drawImage(
            bloom,
            x - bloomSize / 2,
            y - bloomSize / 2,
            bloomSize,
            bloomSize
          );
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
