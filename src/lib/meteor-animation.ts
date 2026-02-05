import { MeteorConfig } from "./utils";

//this file is a class. it defines what the animation engine can do and then we will create an instance of it that actually runs.

//helper: linear interpolation, same as in utils, but local to this file so the engine has no dependency for its core math

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
    Object.assign(this.config, config);
  }

  //set mouse position (called from mousemove listener)
  setMouse(x: number, y: number) {
    this.mouseTargetX = x;
    this.mouseTargetY = y;
  }

  //star properties
  private stars: Star[] = [];
  private meteors: Meteor[] = [];
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
    const baseSpeed = 2 + Math.pow(Math.max(0, normalizedV), 1.4) * 7;
    const speed = baseSpeed * (0.85 + Math.random() * 0.3);

    //fireball chance - asteroids produce more fireballs
    const isFireball =
      Math.random() < (parentObjectType === "asteroid" ? 0.12 : 0.05);

    //size variation
    const sizeRoll = Math.random();
    let length: number, thickness: number;
    if (isFireball) {
      length = 90 + Math.random() * 70;
      thickness = 3.0 + Math.random() * 2.5;
    } else if (sizeRoll < 0.4) {
      length = 12 + Math.random() * 20;
      thickness = 0.4 + Math.random() * 0.4;
    } else if (sizeRoll < 0.85) {
      length = 30 + Math.random() * 35;
      thickness = 0.8 + Math.random() * 0.8;
    } else {
      length = 60 + Math.random() * 40;
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
      saturation: isFireball ? 65 : 15 + Math.random() * 20,
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
    }
  }

  //method to generate stars
  private generateStars() {
    const count = 320 + Math.floor(Math.random() * 60); // 320-380 stars
    this.stars = [];
    for (let i = 0; i < count; i++) {
      //power-law brightness: most stars are faint, few are bright
      const roll = Math.random();
      let brightness: number;
      let radius: number;

      if (roll < 0.7) {
        //70% are faint
        brightness = 0.05 + Math.random() * 0.15;
        radius = 0.2 + Math.random() * 0.3;
      } else if (roll < 0.9) {
        //20% are medium
        brightness = 0.2 + Math.random() * 0.3;
        radius = 0.4 + Math.random() * 0.3;
      } else if (roll < 0.98) {
        //8% are bright
        brightness = 0.5 + Math.random() * 0.3;
        radius = 0.6 + Math.random() * 0.3;
      } else {
        //2% are prominent
        brightness = 0.8 + Math.random() * 0.2;
        radius = 0.9 + Math.random() * 0.5;
      }
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        brightness,
        radius,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.2 + Math.random() * 0.5,
        depth: Math.random() * 0.5,
      });
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
    const visualRate = zhr <= 0 ? 0 : 0.15 + 2.5 * Math.pow(zhr / 150, 0.75);
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

  //sky background: vertical gradient from dark zenith (top) to lighter horizon (bottom). Moon brightness shifts colors, brighter moon = lighter sky.
  private drawSkyGradient(ctx: CanvasRenderingContext2D) {
    const mf = this.config.moonIllumination / 100;

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

    //milky way band: horizontal glow at y ≈ 35% of canvas. Mouse position affects its position and brightness.
  }

  //--------------------------------
  // Star field
  //--------------------------------
  //drawstars method
  private drawStars(ctx: CanvasRenderingContext2D, timestamp: number) {
    const timeSec = timestamp / 1000;

    //moon dims stars, brighter moon = dimmer stars
    const starDimming = 1 - (this.config.moonIllumination / 100) * 0.6;
    const maxShift = 15;
    const mx = (this.mouseX - 0.5) * 2; //-1 to 1
    const my = (this.mouseY - 0.5) * 2; //-1 to 1
    for (const star of this.stars) {
      //parallax shift stars opposite to mouse direction and stars with higher depth (closer) shift more, max 15px
      const px = -mx * maxShift * star.depth;
      const py = -my * maxShift * star.depth;
      const x = star.x * this.width + px;
      const y = star.y * this.height + py;

      //twinkle: sine wave oscillates 0-1 over time, each star has its own phase and speed so they dont twinkle in sync
      const wave =
        0.5 + 0.5 * Math.sin(timeSec * star.twinkleSpeed + star.phase);
      const alpha = star.brightness * (0.6 + 0.4 * wave) * starDimming;

      //skip invisible stars
      if (alpha < 0.02) continue;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }
}
