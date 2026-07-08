"use client";

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

type RGB = [number, number, number];
type Vec3 = { x: number; y: number; z: number };

type SkyAnchor = {
  alt: number;
  top: RGB;
  horizon: RGB;
  star: number;
  moonContrast: number;
  moonOpacity: number;
  shadowVisibility: number;
};

type SkyLook = Omit<SkyAnchor, "alt">;

type ExplorationId = "canvas-polished" | "atmospheric";

type Exploration = {
  id: ExplorationId;
  label: string;
  description: string;
};

type TimeAnchor = {
  hour: number;
  altitude: number;
};

type Star = {
  x: number;
  y: number;
  r: number;
  base: number;
  warm: boolean;
  twinkle: number;
  offset: number;
};

type MoonSample = {
  iso: string;
  time: string;
  phase: number;
  age: number;
  diameter: number;
  distance: number;
  subsolar: {
    lon: number;
    lat: number;
  };
  subearth: {
    lon: number;
    lat: number;
  };
  posangle: number;
};

type MoonVisualSource = "nasa-svs-frame" | "nasa-lroc-texture";

type MoonVisualState = {
  sample: MoonSample;
  key: string;
  phaseCycle: number;
  phaseName: string;
  illumination: number;
  apparentScale: number;
  subsolar: MoonSample["subsolar"];
  subearth: MoonSample["subearth"];
  posangle: number;
  skyBrightness: number;
  daylight: number;
  nightVisibility: number;
  skyTint: RGB;
  look: SkyLook;
  source: MoonVisualSource;
  sourceLabel: string;
  svsFrameNumber: number | null;
  svsImageSrc: string | null;
};

type RendererState = {
  stars: Star[];
  reduceMotion: boolean;
  moonCanvas: HTMLCanvasElement;
  moonCtx: CanvasRenderingContext2D;
  moonTextureCanvas: HTMLCanvasElement;
  moonTextureCtx: CanvasRenderingContext2D;
  moonTextureData: ImageData | null;
  moonTextureVersion: number;
  moonCacheKey: string;
  moonSvsImage: HTMLImageElement | null;
  moonSvsImageSrc: string;
  moonSvsImageLoaded: boolean;
  moonSvsImageErrorSrc: string;
  moonSvsImageVersion: number;
  requestRedraw?: () => void;
  width: number;
  height: number;
  dpr: number;
};

const NASA_MOON_TEXTURE_SRC = "/moon/nasa-lroc-color-2k.jpg";
const NASA_MOON_SAMPLES_SRC = "/moon/nasa-moon-2026-samples.json";
const NASA_SVS_2026_LOCAL_FRAME_SRC = "/moon/svs-2026-730";
const LOCAL_NASA_SVS_2026_FRAMES = new Set([
  4489, 4495, 4501, 4507, 4513,
]);
const SYNODIC_MONTH_DAYS = 29.530588853;
const DEFAULT_TIME_OF_DAY = 20.5;
const DEFAULT_EXPLORATION: ExplorationId = "atmospheric";

const EXPLORATIONS: Exploration[] = [
  {
    id: "canvas-polished",
    label: "Canvas sky",
    description: "Layered haze and light",
  },
  {
    id: "atmospheric",
    label: "Atmosphere",
    description: "Clouds and scattering",
  },
];

const DEFAULT_MOON_SAMPLE: MoonSample = {
  iso: "2026-07-07T00:00:00.000Z",
  time: "07 Jul 2026 00:00 UT",
  phase: 58.85,
  age: 21.879,
  diameter: 1872.8,
  distance: 382712,
  subsolar: { lon: -86.899, lat: 1.135 },
  subearth: { lon: -7.189, lat: -3.695 },
  posangle: 337.873,
};

const SKY_TABLE: SkyAnchor[] = [
  {
    alt: -18,
    top: [3, 7, 18],
    horizon: [9, 17, 40],
    star: 1,
    moonContrast: 1,
    moonOpacity: 1,
    shadowVisibility: 1,
  },
  {
    alt: -6,
    top: [13, 28, 58],
    horizon: [42, 78, 128],
    star: 0.68,
    moonContrast: 1,
    moonOpacity: 1,
    shadowVisibility: 0.9,
  },
  {
    alt: -1,
    top: [40, 61, 101],
    horizon: [191, 132, 116],
    star: 0.16,
    moonContrast: 0.92,
    moonOpacity: 0.95,
    shadowVisibility: 0.56,
  },
  {
    alt: 3,
    top: [76, 98, 142],
    horizon: [225, 184, 141],
    star: 0.03,
    moonContrast: 0.72,
    moonOpacity: 0.86,
    shadowVisibility: 0.32,
  },
  {
    alt: 12,
    top: [89, 152, 220],
    horizon: [174, 216, 238],
    star: 0,
    moonContrast: 0.54,
    moonOpacity: 0.78,
    shadowVisibility: 0.22,
  },
  {
    alt: 55,
    top: [64, 139, 222],
    horizon: [174, 222, 246],
    star: 0,
    moonContrast: 0.44,
    moonOpacity: 0.68,
    shadowVisibility: 0.18,
  },
];

const TIME_TABLE: TimeAnchor[] = [
  { hour: 0, altitude: -18 },
  { hour: 4.75, altitude: -18 },
  { hour: 5.5, altitude: -6 },
  { hour: 6.35, altitude: 3 },
  { hour: 8, altitude: 18 },
  { hour: 12, altitude: 55 },
  { hour: 16, altitude: 22 },
  { hour: 18.6, altitude: 3 },
  { hour: 19.6, altitude: -6 },
  { hour: 20.8, altitude: -12 },
  { hour: 24, altitude: -18 },
];

const MOON = {
  x: 0.56,
  y: 0.34,
  dark: [15, 19, 32] as RGB,
  darkGlow: [42, 53, 88] as RGB,
  flat: [230, 234, 238] as RGB,
  softEdge: 0.18,
};

const MOON_TEXTURE_SCALE = 4;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

function rgb(rgb: RGB, alpha?: number) {
  const values = rgb.map(Math.round).join(" ");
  return alpha === undefined
    ? `rgb(${values})`
    : `rgb(${values} / ${alpha})`;
}

function skyLook(altitude: number): SkyLook {
  const anchors = SKY_TABLE;

  if (altitude <= anchors[0].alt) return anchors[0];
  if (altitude >= anchors[anchors.length - 1].alt) {
    return anchors[anchors.length - 1];
  }

  let index = 0;
  while (altitude > anchors[index + 1].alt) index += 1;

  const from = anchors[index];
  const to = anchors[index + 1];
  const t = (altitude - from.alt) / (to.alt - from.alt);

  return {
    top: lerpRGB(from.top, to.top, t),
    horizon: lerpRGB(from.horizon, to.horizon, t),
    star: lerp(from.star, to.star, t),
    moonContrast: lerp(from.moonContrast, to.moonContrast, t),
    moonOpacity: lerp(from.moonOpacity, to.moonOpacity, t),
    shadowVisibility: lerp(
      from.shadowVisibility,
      to.shadowVisibility,
      t,
    ),
  };
}

function mulberry32(seed: number) {
  return function random() {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(width: number, height: number): Star[] {
  const random = mulberry32(20260706);
  const count = Math.round((width * height) / 1250);

  return Array.from({ length: count }, () => {
    const depth = random();

    return {
      x: random() * width,
      y: random() * height * 0.78,
      r: 0.3 + depth * 1.05,
      base: 0.2 + depth * 0.7,
      warm: random() > 0.54,
      twinkle: 0.45 + random() * 1.4,
      offset: random() * Math.PI * 2,
    };
  });
}

function phaseLabel(phase: number) {
  if (phase < 0.025 || phase > 0.975) return "New moon";
  if (Math.abs(phase - 0.25) < 0.025) return "First quarter";
  if (Math.abs(phase - 0.5) < 0.025) return "Full moon";
  if (Math.abs(phase - 0.75) < 0.025) return "Last quarter";
  if (phase < 0.25) return "Waxing crescent";
  if (phase < 0.5) return "Waxing gibbous";
  if (phase < 0.75) return "Waning gibbous";
  return "Waning crescent";
}

function phaseCycleFromAge(age: number) {
  const cycle = (age % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  return cycle < 0 ? cycle + 1 : cycle;
}

function svsFrameNumberFromIso(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== 2026) {
    return null;
  }

  const start = Date.UTC(2026, 0, 1, 0);
  const hoursSinceStart = Math.round(
    (date.getTime() - start) / 3_600_000,
  );
  const frameNumber = hoursSinceStart + 1;

  if (frameNumber < 1 || frameNumber > 8760) return null;
  return frameNumber;
}

function padSvsFrameNumber(frameNumber: number) {
  return String(frameNumber).padStart(4, "0");
}

function localSvsMoonFrameSrc(frameNumber: number | null) {
  if (
    frameNumber === null ||
    !LOCAL_NASA_SVS_2026_FRAMES.has(frameNumber)
  ) {
    return null;
  }

  return `${NASA_SVS_2026_LOCAL_FRAME_SRC}/moon.${padSvsFrameNumber(
    frameNumber,
  )}.jpg`;
}

function createMoonVisualState(
  sample: MoonSample,
  look: SkyLook,
): MoonVisualState {
  const phaseCycle = phaseCycleFromAge(sample.age);
  const svsFrameNumber = svsFrameNumberFromIso(sample.iso);
  const svsImageSrc = localSvsMoonFrameSrc(svsFrameNumber);
  const skyBrightness = skyLuminanceFromLook(look);
  const nightVisibility = clamp(1.12 - skyBrightness * 1.45);
  const daylight = 1 - nightVisibility;
  const skyTint = lerpRGB(look.top, look.horizon, 0.42);
  const source: MoonVisualSource = svsImageSrc
    ? "nasa-svs-frame"
    : "nasa-lroc-texture";

  return {
    sample,
    key: [
      sample.iso,
      sample.phase.toFixed(2),
      sample.diameter.toFixed(1),
      sample.subsolar.lon.toFixed(3),
      sample.subsolar.lat.toFixed(3),
      sample.subearth.lon.toFixed(3),
      sample.subearth.lat.toFixed(3),
      sample.posangle.toFixed(3),
      svsFrameNumber ?? "no-svs",
    ].join(":"),
    phaseCycle,
    phaseName: phaseLabel(phaseCycle),
    illumination: clamp(sample.phase / 100),
    apparentScale: clamp(sample.diameter / 1870, 0.92, 1.08),
    subsolar: sample.subsolar,
    subearth: sample.subearth,
    posangle: sample.posangle,
    skyBrightness,
    daylight,
    nightVisibility,
    skyTint,
    look,
    source,
    sourceLabel:
      source === "nasa-svs-frame"
        ? "NASA SVS frame"
        : "LROC texture renderer",
    svsFrameNumber,
    svsImageSrc,
  };
}

function formatMoonDate(sample: MoonSample) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(sample.iso));
}

function findNearestMoonSampleIndex(
  samples: MoonSample[],
  targetDate: Date,
) {
  if (samples.length <= 1) return 0;

  const time =
    targetDate.getUTCFullYear() === 2026
      ? targetDate.getTime()
      : new Date(DEFAULT_MOON_SAMPLE.iso).getTime();

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < samples.length; index += 1) {
    const distance = Math.abs(
      new Date(samples[index].iso).getTime() - time,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function skyAltitudeFromTime(hour: number) {
  const anchors = TIME_TABLE;
  const normalizedHour = ((hour % 24) + 24) % 24;

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const from = anchors[index];
    const to = anchors[index + 1];

    if (normalizedHour >= from.hour && normalizedHour <= to.hour) {
      const t = (normalizedHour - from.hour) / (to.hour - from.hour);
      return lerp(from.altitude, to.altitude, t);
    }
  }

  return anchors[0].altitude;
}

function timeOfDayLabel(hour: number) {
  const altitude = skyAltitudeFromTime(hour);

  if (altitude <= -15) return "Night";
  if (altitude <= -8) return "Dusk";
  if (altitude <= -2) return "Blue hour";
  if (altitude <= 6) return hour < 12 ? "Sunrise" : "Sunset";
  if (altitude <= 30) return hour < 12 ? "Morning" : "Afternoon";
  return "Day";
}

function formatHour(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const wholeHours = Math.floor(normalizedHour);
  const minutes = Math.round((normalizedHour - wholeHours) * 60);
  const date = new Date(Date.UTC(2026, 0, 1, wholeHours, minutes));

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function isCanvasSky(exploration: ExplorationId) {
  return exploration === "canvas-polished";
}

function skyLuminanceFromLook(look: SkyLook) {
  const average =
    (look.top[0] +
      look.top[1] +
      look.top[2] +
      look.horizon[0] +
      look.horizon[1] +
      look.horizon[2]) /
    6;

  return clamp(average / 220);
}

function sunDirectionFromTime(hour: number): Vec3 {
  const altitude = radians(skyAltitudeFromTime(hour));
  const azimuth = hour * (Math.PI / 12) - Math.PI * 0.1;
  const horizontal = Math.cos(altitude);
  const vector = {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(altitude),
    z: Math.cos(azimuth) * horizontal,
  };
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function moonVector(lonDegrees: number, latDegrees: number) {
  const lon = radians(lonDegrees);
  const lat = radians(latDegrees);
  const cosLat = Math.cos(lat);

  return {
    x: cosLat * Math.sin(lon),
    y: Math.sin(lat),
    z: cosLat * Math.cos(lon),
  };
}

function sampleMoonTexture(
  renderer: RendererState,
  lon: number,
  lat: number,
  sphereZ: number,
): RGB {
  const texture = renderer.moonTextureData;

  if (!texture) {
    const fallback = 210 + sphereZ * 22;
    return [fallback, fallback, fallback];
  }

  const textureWidth = texture.width;
  const textureHeight = texture.height;
  const u = 0.5 + lon / (Math.PI * 2);
  const wrappedU = u - Math.floor(u);
  const v = clamp(0.5 - lat / Math.PI);
  const x = Math.round(wrappedU * (textureWidth - 1));
  const y = Math.round(v * (textureHeight - 1));
  const pixelIndex = (y * textureWidth + x) * 4;
  const data = texture.data;

  return [
    data[pixelIndex],
    data[pixelIndex + 1],
    data[pixelIndex + 2],
  ];
}

function renderMoonTexture(
  renderer: RendererState,
  visual: MoonVisualState,
  radius: number,
) {
  const scale = MOON_TEXTURE_SCALE;
  const size = Math.ceil(radius * 2 + 4);
  const canvas = renderer.moonCanvas;
  const ctx = renderer.moonCtx;

  canvas.width = size * scale;
  canvas.height = size * scale;

  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const scaledRadius = radius * scale;
  const viewLon = radians(visual.subearth.lon);
  const viewLat = radians(visual.subearth.lat);
  const sinViewLon = Math.sin(viewLon);
  const cosViewLon = Math.cos(viewLon);
  const sinViewLat = Math.sin(viewLat);
  const cosViewLat = Math.cos(viewLat);
  const center = moonVector(visual.subearth.lon, visual.subearth.lat);
  const sun = moonVector(visual.subsolar.lon, visual.subsolar.lat);
  const right = { x: cosViewLon, y: 0, z: -sinViewLon };
  const up = {
    x: -sinViewLat * sinViewLon,
    y: cosViewLat,
    z: -sinViewLat * cosViewLon,
  };
  const roll = radians(visual.posangle);
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  const look = visual.look;
  const nightVisibility = visual.nightVisibility;
  const skyTint = visual.skyTint;

  for (let py = 0; py < canvas.height; py += 1) {
    for (let px = 0; px < canvas.width; px += 1) {
      const nx = (px - centerX) / scaledRadius;
      const ny = (py - centerY) / scaledRadius;
      const distanceSquared = nx * nx + ny * ny;
      const pixelIndex = (py * canvas.width + px) * 4;

      if (distanceSquared > 1) {
        data[pixelIndex + 3] = 0;
        continue;
      }

      const nz = Math.sqrt(1 - distanceSquared);
      const rotatedX = nx * cosRoll - ny * sinRoll;
      const rotatedY = nx * sinRoll + ny * cosRoll;
      const surfaceX =
        center.x * nz + right.x * rotatedX - up.x * rotatedY;
      const surfaceY =
        center.y * nz + right.y * rotatedX - up.y * rotatedY;
      const surfaceZ =
        center.z * nz + right.z * rotatedX - up.z * rotatedY;
      const surfaceLength = Math.hypot(surfaceX, surfaceY, surfaceZ);
      const normalX = surfaceX / surfaceLength;
      const normalY = surfaceY / surfaceLength;
      const normalZ = surfaceZ / surfaceLength;
      const lon = Math.atan2(normalX, normalZ);
      const lat = Math.asin(normalY);
      const lightDirection =
        normalX * sun.x + normalY * sun.y + normalZ * sun.z;
      const edge = MOON.softEdge;
      let lit =
        lightDirection <= -edge
          ? 0
          : lightDirection >= edge
            ? 1
            : (lightDirection + edge) / (2 * edge);

      lit = lit * lit * (3 - 2 * lit);
      lit = Math.pow(lit, 1.05);

      const limb = 1 - nz;
      const texture = sampleMoonTexture(renderer, lon, lat, nz);
      const textureGray =
        texture[0] * 0.28 + texture[1] * 0.56 + texture[2] * 0.16;
      const colorStrength = 0.38;
      const baseR = lerp(textureGray, texture[0], colorStrength);
      const baseG = lerp(textureGray, texture[1], colorStrength);
      const baseB = lerp(textureGray, texture[2], colorStrength);
      const incidence = clamp(lightDirection * 0.78 + 0.12, 0.045, 1);
      const limbShade = 0.72 + nz * 0.32;
      const litR = baseR * incidence * limbShade;
      const litG = baseG * incidence * limbShade;
      const litB = baseB * incidence * limbShade;
      const earthshine = (0.012 + nightVisibility * 0.032) * (0.85 + nz * 0.25);
      const nightShadowR =
        MOON.dark[0] + MOON.darkGlow[0] * limb * 0.22 + baseR * earthshine;
      const nightShadowG =
        MOON.dark[1] + MOON.darkGlow[1] * limb * 0.22 + baseG * earthshine;
      const nightShadowB =
        MOON.dark[2] + MOON.darkGlow[2] * limb * 0.22 + baseB * earthshine;
      const daylight = 1 - nightVisibility;
      const daytimeTexture = 0.018 * daylight;
      const daytimeOcclusion = 0.992 - daylight * (0.006 + limb * 0.004);
      const dayMoonGray = textureGray * 0.78;
      const dayShadowTint: RGB = [
        skyTint[0] * daytimeOcclusion,
        skyTint[1] * daytimeOcclusion,
        skyTint[2] * daytimeOcclusion,
      ];
      const atmosphericShadowR = lerp(
        dayShadowTint[0],
        dayMoonGray,
        daytimeTexture,
      );
      const atmosphericShadowG = lerp(
        dayShadowTint[1],
        dayMoonGray,
        daytimeTexture,
      );
      const atmosphericShadowB = lerp(
        dayShadowTint[2],
        dayMoonGray,
        daytimeTexture,
      );
      const darkR = lerp(
        atmosphericShadowR,
        nightShadowR,
        nightVisibility,
      );
      const darkG = lerp(
        atmosphericShadowG,
        nightShadowG,
        nightVisibility,
      );
      const darkB = lerp(
        atmosphericShadowB,
        nightShadowB,
        nightVisibility,
      );

      let r = litR * lit + darkR * (1 - lit);
      let g = litG * lit + darkG * (1 - lit);
      let b = litB * lit + darkB * (1 - lit);

      const flatMix =
        (1 - look.moonContrast) * Math.pow(lit, 2.2) * 0.82;
      r =
        MOON.flat[0] * flatMix +
        r * (1 - flatMix);
      g =
        MOON.flat[1] * flatMix +
        g * (1 - flatMix);
      b =
        MOON.flat[2] * flatMix +
        b * (1 - flatMix);

      const radialEdge = clamp(
        (1 - Math.sqrt(distanceSquared)) * scaledRadius,
      );
      const darkSideVisibility =
        0.012 + nightVisibility * 0.19 + look.shadowVisibility * 0.012;
      const phaseVisibilityPower = lerp(1.7, 1.08, nightVisibility);
      const litVisibility = Math.pow(lit, phaseVisibilityPower);
      const surfaceVisibility =
        litVisibility +
        (1 - litVisibility) * clamp(darkSideVisibility, 0.012, 0.25);
      const atmosphericBlend =
        (1 - surfaceVisibility) * (0.18 + daylight * 0.48);
      const daylightVeil = (1 - look.moonOpacity) * 0.18;
      const totalAtmosphericBlend = clamp(
        atmosphericBlend + daylightVeil,
        0,
        0.9,
      );

      r = lerp(r, skyTint[0], totalAtmosphericBlend);
      g = lerp(g, skyTint[1], totalAtmosphericBlend);
      b = lerp(b, skyTint[2], totalAtmosphericBlend);

      const daylightBodyOpacity =
        litVisibility + (1 - litVisibility) * 0.035;
      const nightBodyOpacity = clamp(nightVisibility * 1.18);
      const daylightUnlitFade =
        1 - smoothstep(-0.12, 0.24, lightDirection);
      const daylightBodyFade = 1 - daylight * daylightUnlitFade * 0.965;
      const bodyOpacity =
        lerp(daylightBodyOpacity, 1, nightBodyOpacity) *
        daylightBodyFade;

      data[pixelIndex] = r;
      data[pixelIndex + 1] = g;
      data[pixelIndex + 2] = b;
      data[pixelIndex + 3] = 255 * radialEdge * bodyOpacity;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function ensureSvsMoonImage(
  renderer: RendererState,
  visual: MoonVisualState,
) {
  const src = visual.svsImageSrc;

  if (!src || renderer.moonSvsImageErrorSrc === src) return false;
  if (renderer.moonSvsImageSrc === src) {
    return renderer.moonSvsImageLoaded && renderer.moonSvsImage !== null;
  }

  const image = new Image();
  renderer.moonSvsImage = null;
  renderer.moonSvsImageSrc = src;
  renderer.moonSvsImageLoaded = false;

  image.decoding = "async";
  image.onload = () => {
    if (renderer.moonSvsImageSrc !== src) return;

    renderer.moonSvsImage = image;
    renderer.moonSvsImageLoaded = true;
    renderer.moonSvsImageVersion += 1;
    renderer.moonCacheKey = "";
    renderer.requestRedraw?.();
  };
  image.onerror = () => {
    if (renderer.moonSvsImageSrc !== src) return;

    renderer.moonSvsImage = null;
    renderer.moonSvsImageLoaded = false;
    renderer.moonSvsImageErrorSrc = src;
    renderer.moonSvsImageVersion += 1;
    renderer.moonCacheKey = "";
    renderer.requestRedraw?.();
  };
  image.src = src;

  return false;
}

function renderSvsMoonTexture(
  renderer: RendererState,
  visual: MoonVisualState,
  radius: number,
) {
  const image = renderer.moonSvsImage;
  if (!image || !renderer.moonSvsImageLoaded) return false;

  const scale = MOON_TEXTURE_SCALE;
  const size = Math.ceil(radius * 2 + 4);
  const canvas = renderer.moonCanvas;
  const ctx = renderer.moonCtx;

  canvas.width = size * scale;
  canvas.height = size * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const rendered = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = rendered.data;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const scaledRadius = radius * scale;
  const look = visual.look;
  const skyTint = visual.skyTint;
  const daylight = visual.daylight;
  const nightVisibility = visual.nightVisibility;
  const litOpacity = lerp(0.46, 0.98, nightVisibility) * look.moonOpacity;
  const darkBodyOpacity =
    0.045 + nightVisibility * 0.82 + look.shadowVisibility * 0.035;
  const daylightBaseOpacity = 0.006 + look.shadowVisibility * 0.008;

  for (let py = 0; py < canvas.height; py += 1) {
    for (let px = 0; px < canvas.width; px += 1) {
      const nx = (px - centerX) / scaledRadius;
      const ny = (py - centerY) / scaledRadius;
      const distanceSquared = nx * nx + ny * ny;
      const pixelIndex = (py * canvas.width + px) * 4;

      if (distanceSquared > 1) {
        data[pixelIndex + 3] = 0;
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      const radialEdge = clamp((1 - distance) * scaledRadius);
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const luma = r * 0.28 + g * 0.56 + b * 0.16;
      const sourceSignal = smoothstep(2, 16, luma);
      const nightDiskSignal =
        nightVisibility * (1 - smoothstep(0.84, 0.99, distance));
      const alphaSignal = Math.max(sourceSignal, nightDiskSignal);
      const litSignal = smoothstep(22, 116, luma);
      const daylightLitPresence = smoothstep(0.58, 0.96, litSignal);
      const daylightBlend = clamp(
        daylight * (0.14 + (1 - daylightLitPresence) * 0.12),
        0,
        0.42,
      );
      const atmosphericLift = daylight * (1 - daylightLitPresence) * 6;
      const daytimeAlpha = lerp(
        daylightBaseOpacity,
        litOpacity,
        daylightLitPresence,
      );
      const nighttimeAlpha = lerp(
        darkBodyOpacity,
        litOpacity,
        litSignal,
      );

      data[pixelIndex] = lerp(r + atmosphericLift, skyTint[0], daylightBlend);
      data[pixelIndex + 1] = lerp(
        g + atmosphericLift,
        skyTint[1],
        daylightBlend,
      );
      data[pixelIndex + 2] = lerp(
        b + atmosphericLift,
        skyTint[2],
        daylightBlend,
      );
      data[pixelIndex + 3] =
        255 *
        radialEdge *
        alphaSignal *
        clamp(lerp(daytimeAlpha, nighttimeAlpha, nightVisibility), 0, 1);
    }
  }

  ctx.putImageData(rendered, 0, 0);
  return true;
}

function drawAtmosphericVeil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeOfDay: number,
  look: SkyLook,
) {
  const sunAltitude = skyAltitudeFromTime(timeOfDay);
  const luminance = skyLuminanceFromLook(look);
  const twilight = 1 - clamp(Math.abs(sunAltitude + 4) / 20);
  const daylight = clamp((sunAltitude + 4) / 50);
  const night = clamp((-sunAltitude - 4) / 18);
  const sunX =
    width *
    (0.12 + 0.76 * clamp((timeOfDay - 5.2) / (19.2 - 5.2)));
  const sunY =
    height * (0.78 - 0.52 * clamp((sunAltitude + 6) / 61));

  const solarBloom = ctx.createRadialGradient(
    sunX,
    sunY,
    0,
    sunX,
    sunY,
    Math.max(width, height) * (0.42 + daylight * 0.22),
  );
  solarBloom.addColorStop(
    0,
    `rgb(255 245 210 / ${0.2 + twilight * 0.22 + daylight * 0.12})`,
  );
  solarBloom.addColorStop(
    0.22,
    `rgb(255 198 148 / ${0.1 + twilight * 0.18})`,
  );
  solarBloom.addColorStop(1, "rgb(255 198 148 / 0)");
  ctx.fillStyle = solarBloom;
  ctx.fillRect(0, 0, width, height);

  const lowerAir = ctx.createLinearGradient(
    0,
    height * 0.42,
    0,
    height,
  );
  lowerAir.addColorStop(0, "rgb(255 255 255 / 0)");
  lowerAir.addColorStop(
    0.38,
    `rgb(255 244 220 / ${0.08 + daylight * 0.12})`,
  );
  lowerAir.addColorStop(
    0.72,
    `rgb(255 232 196 / ${0.16 + twilight * 0.18})`,
  );
  lowerAir.addColorStop(
    1,
    `rgb(255 255 255 / ${0.05 + daylight * 0.08})`,
  );
  ctx.fillStyle = lowerAir;
  ctx.fillRect(0, 0, width, height);

  const upperAir = ctx.createLinearGradient(0, 0, 0, height * 0.78);
  upperAir.addColorStop(
    0,
    `rgb(0 11 36 / ${0.18 + night * 0.26 - luminance * 0.08})`,
  );
  upperAir.addColorStop(1, "rgb(0 11 36 / 0)");
  ctx.fillStyle = upperAir;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const crossLight = ctx.createLinearGradient(
    width * 0.1,
    height * 0.42,
    width * 0.9,
    height * 0.74,
  );
  crossLight.addColorStop(0, "rgb(255 255 255 / 0)");
  crossLight.addColorStop(
    0.42,
    `rgb(255 246 224 / ${0.035 + daylight * 0.04 + twilight * 0.065})`,
  );
  crossLight.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = crossLight;
  ctx.fillRect(0, 0, width, height);

  const horizonDiffusion = ctx.createRadialGradient(
    width * 0.56,
    height * 0.86,
    0,
    width * 0.56,
    height * 0.86,
    Math.max(width, height) * 0.72,
  );
  horizonDiffusion.addColorStop(
    0,
    `rgb(255 230 198 / ${0.06 + daylight * 0.08 + twilight * 0.13})`,
  );
  horizonDiffusion.addColorStop(
    0.46,
    `rgb(255 214 180 / ${0.03 + twilight * 0.08})`,
  );
  horizonDiffusion.addColorStop(1, "rgb(255 214 180 / 0)");
  ctx.fillStyle = horizonDiffusion;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function drawCanvasPolishedSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: SkyLook,
  timeOfDay: number,
) {
  const altitude = skyAltitudeFromTime(timeOfDay);
  const twilight = 1 - clamp(Math.abs(altitude + 4) / 22);
  const night = clamp((-altitude - 4) / 18);
  const zenith = lerpRGB(look.top, [5, 8, 20], night * 0.28);
  const horizon = lerpRGB(look.horizon, [254, 194, 154], twilight * 0.2);
  const mid = lerpRGB(zenith, horizon, 0.54);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgb(zenith));
  gradient.addColorStop(0.46, rgb(mid));
  gradient.addColorStop(0.76, rgb(lerpRGB(mid, horizon, 0.66)));
  gradient.addColorStop(1, rgb(horizon));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawAtmosphericVeil(ctx, width, height, timeOfDay, look);

  const blueDepth = ctx.createRadialGradient(
    width * 0.58,
    -height * 0.08,
    0,
    width * 0.58,
    -height * 0.08,
    Math.max(width, height) * 1.12,
  );
  blueDepth.addColorStop(
    0,
    `rgb(82 168 255 / ${0.22 * clamp((altitude + 6) / 42)})`,
  );
  blueDepth.addColorStop(
    0.54,
    `rgb(66 122 219 / ${0.1 * clamp((altitude + 6) / 42)})`,
  );
  blueDepth.addColorStop(1, "rgb(66 122 219 / 0)");
  ctx.fillStyle = blueDepth;
  ctx.fillRect(0, 0, width, height);

  if (night > 0.05) {
    const nightDepth = ctx.createRadialGradient(
      width * 0.2,
      height * 0.1,
      0,
      width * 0.2,
      height * 0.1,
      Math.max(width, height) * 0.92,
    );
    nightDepth.addColorStop(0, `rgb(28 39 82 / ${night * 0.16})`);
    nightDepth.addColorStop(1, "rgb(28 39 82 / 0)");
    ctx.fillStyle = nightDepth;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.globalAlpha = 0.018 + twilight * 0.018;
  ctx.fillStyle = "rgb(255 255 255)";
  const random = mulberry32(404 + Math.round(width + height));
  for (let i = 0; i < 160; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = 0.4 + random() * 0.8;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawCanvasSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: SkyLook,
  timeOfDay: number,
) {
  drawCanvasPolishedSky(ctx, width, height, look, timeOfDay);
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  renderer: RendererState,
  look: SkyLook,
  time: number,
) {
  if (look.star <= 0.001) return;

  for (const star of renderer.stars) {
    const twinkle = renderer.reduceMotion
      ? 1
      : 0.68 + 0.32 * Math.sin(time * star.twinkle + star.offset);
    const alpha = star.base * twinkle * look.star;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = star.warm
      ? `rgb(255 244 224 / ${alpha})`
      : `rgb(222 232 255 / ${alpha})`;
    ctx.fill();
  }
}

function drawForegroundClouds(
  ctx: CanvasRenderingContext2D,
  renderer: RendererState,
  look: SkyLook,
  timeOfDay: number,
  time: number,
) {
  const altitude = skyAltitudeFromTime(timeOfDay);
  const daylight = clamp((altitude + 4) / 50);
  const twilight = 1 - clamp(Math.abs(altitude + 4) / 20);
  const night = clamp((-altitude - 4) / 18);
  const wind =
    (timeOfDay / 24) * renderer.width * 1.65 +
    (renderer.reduceMotion ? 0 : time * renderer.width * 0.006);
  const cloudTint = lerpRGB(
    lerpRGB([226, 235, 239], [255, 226, 202], twilight * 0.34),
    [26, 32, 50],
    night * 0.78,
  );
  const shadowTint = lerpRGB(
    lerpRGB(look.horizon, look.top, 0.36),
    [14, 18, 32],
    night,
  );
  const pad = renderer.width * 0.28;
  const bandAlpha = 0.12 + daylight * 0.08 + twilight * 0.1 + night * 0.05;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = `blur(${Math.max(14, renderer.width * 0.012)}px)`;

  for (let index = 0; index < 9; index += 1) {
    const seed = index * 97.31;
    const travel = wind * (0.52 + index * 0.035);
    const x =
      ((index * renderer.width * 0.21 + travel + Math.sin(seed) * 160) %
        (renderer.width + pad * 2)) -
      pad;
    const y =
      renderer.height *
      (0.08 + ((index * 0.115 + Math.sin(seed * 0.17) * 0.04) % 0.44));
    const width =
      renderer.width * (0.26 + 0.12 * Math.sin(seed * 0.41));
    const height =
      renderer.height * (0.035 + 0.028 * Math.cos(seed * 0.19));
    const alpha =
      bandAlpha * (0.38 + 0.25 * Math.sin(seed * 0.23)) *
      (1 - clamp((y / renderer.height - 0.62) * 2));

    ctx.beginPath();
    ctx.fillStyle = rgb(index % 3 === 0 ? shadowTint : cloudTint, alpha);
    ctx.ellipse(
      x,
      y,
      Math.abs(width),
      Math.abs(height),
      Math.sin(seed) * 0.22,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.filter = `blur(${Math.max(22, renderer.width * 0.018)}px)`;
  const veilY =
    renderer.height *
    (0.22 + 0.06 * Math.sin(timeOfDay * 0.7 + time * 0.02));
  const veilGradient = ctx.createLinearGradient(
    0,
    veilY - renderer.height * 0.12,
    renderer.width,
    veilY + renderer.height * 0.16,
  );
  veilGradient.addColorStop(0, rgb(cloudTint, 0));
  veilGradient.addColorStop(
    0.45,
    rgb(cloudTint, 0.035 + daylight * 0.035 + twilight * 0.045),
  );
  veilGradient.addColorStop(
    0.66,
    rgb(shadowTint, 0.025 + night * 0.045),
  );
  veilGradient.addColorStop(1, rgb(cloudTint, 0));
  ctx.fillStyle = veilGradient;
  ctx.fillRect(0, 0, renderer.width, renderer.height * 0.72);
  ctx.restore();
}

function drawMoon(
  ctx: CanvasRenderingContext2D,
  renderer: RendererState,
  visual: MoonVisualState,
) {
  const radius =
    Math.min(renderer.width, renderer.height) *
    (renderer.width < 640 ? 0.16 : 0.13) *
    visual.apparentScale;
  const moonX =
    renderer.width * (renderer.width < 640 ? 0.5 : MOON.x);
  const moonY =
    renderer.height * (renderer.width < 640 ? 0.28 : MOON.y);
  const svsReady = ensureSvsMoonImage(renderer, visual);
  const renderSource: MoonVisualSource = svsReady
    ? "nasa-svs-frame"
    : "nasa-lroc-texture";
  const sourceVersion =
    renderSource === "nasa-svs-frame"
      ? renderer.moonSvsImageVersion
      : renderer.moonTextureVersion;

  const moonCacheKey = [
    Math.round(radius),
    visual.key,
    renderSource,
    sourceVersion,
    visual.look.moonContrast.toFixed(3),
    visual.look.moonOpacity.toFixed(3),
    visual.look.shadowVisibility.toFixed(3),
    visual.look.top.map(Math.round).join(","),
    visual.look.horizon.map(Math.round).join(","),
  ].join(":");

  if (renderer.moonCacheKey !== moonCacheKey) {
    const didRenderSvs =
      renderSource === "nasa-svs-frame" &&
      renderSvsMoonTexture(renderer, visual, radius);

    if (!didRenderSvs) {
      renderMoonTexture(renderer, visual, radius);
    }

    renderer.moonCacheKey = moonCacheKey;
  }

  const size = renderer.moonCanvas.width / MOON_TEXTURE_SCALE;
  ctx.drawImage(
    renderer.moonCanvas,
    moonX - size / 2,
    moonY - size / 2,
    size,
    size,
  );
}

function createAtmosphericShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function AtmosphericScatteringBackground({
  timeOfDay,
}: {
  timeOfDay: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(timeOfDay);

  useEffect(() => {
    timeRef.current = timeOfDay;
  }, [timeOfDay]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });

    canvas.style.display = "block";
    canvas.style.height = "100%";
    canvas.style.width = "100%";
    host.appendChild(canvas);

    if (!gl) {
      return () => canvas.remove();
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const vertexSource = `
      attribute vec2 position;
      varying vec2 vUv;

      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;

      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform vec3 uSunDirection;
      uniform float uTime;
      uniform float uDayProgress;
      uniform float uMotionScale;

      float saturate(float value) {
        return clamp(value, 0.0, 1.0);
      }

      vec3 gradient(vec3 top, vec3 bottom, float y) {
        float t = pow(saturate(1.0 - y), 0.72);
        return mix(top, bottom, t);
      }

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        vec2 curve = local * local * (3.0 - 2.0 * local);

        float a = hash(cell);
        float b = hash(cell + vec2(1.0, 0.0));
        float c = hash(cell + vec2(0.0, 1.0));
        float d = hash(cell + vec2(1.0, 1.0));

        return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int index = 0; index < 5; index++) {
          value += amplitude * noise(point);
          point = point * 2.04 + vec2(19.7, 11.3);
          amplitude *= 0.52;
        }

        return value;
      }

      float cloudLayer(vec2 uv, float scale, float speed, float seed) {
        vec2 dayWind = vec2(uDayProgress * 2.1, uDayProgress * 0.28);
        vec2 wind =
          vec2(uTime * speed, uTime * speed * 0.18) * uMotionScale +
          dayWind;
        vec2 point = vec2(uv.x * scale + seed, uv.y * scale * 1.65 + seed * 0.37) + wind;
        float body = fbm(point);
        float detail = fbm(point * 2.15 + vec2(4.0, 8.0));
        return body * 0.72 + detail * 0.28;
      }

      void main() {
        vec2 uv = vUv;
        vec2 centered = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
        vec3 ray = normalize(vec3(centered.x * 0.95, uv.y * 1.08 - 0.24, 1.0));
        vec3 sun = normalize(uSunDirection);
        float sunHeight = sun.y;
        float day = smoothstep(-0.08, 0.32, sunHeight);
        float night = 1.0 - smoothstep(-0.2, 0.04, sunHeight);
        float twilight = exp(-pow((sunHeight + 0.075) * 7.0, 2.0));

        vec3 daySky = gradient(
          vec3(0.15, 0.45, 0.88),
          vec3(0.72, 0.88, 0.98),
          uv.y
        );
        vec3 nightSky = gradient(
          vec3(0.012, 0.025, 0.07),
          vec3(0.035, 0.065, 0.14),
          uv.y
        );
        vec3 duskSky = gradient(
          vec3(0.08, 0.13, 0.28),
          vec3(0.95, 0.48, 0.34),
          uv.y
        );

        vec3 color = mix(nightSky, daySky, day);
        color = mix(color, duskSky, twilight * 0.72);

        float mu = dot(ray, sun);
        float rayleigh = pow(saturate(mu * 0.5 + 0.5), 2.6);
        float forwardScatter = pow(saturate(mu * 0.5 + 0.5), 8.0);
        float horizon = exp(-uv.y * 5.0);
        float lowerAir = exp(-uv.y * 2.2);
        float veil =
          (sin((uv.x + uTime * 0.004) * 9.0) * 0.5 + 0.5) *
          (sin((uv.x - uTime * 0.003) * 17.0 + uv.y * 4.0) * 0.5 + 0.5);

        vec2 cloudUv = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
        float cloudLower = cloudLayer(cloudUv + vec2(0.0, -0.04), 2.05, 0.006, 2.0);
        float cloudUpper = cloudLayer(cloudUv + vec2(0.24, 0.18), 3.35, -0.0038, 8.0);
        float cloudTexture = cloudLower * 0.68 + cloudUpper * 0.32;
        float cloudBand =
          smoothstep(0.1, 0.42, uv.y) *
          (1.0 - smoothstep(0.9, 1.0, uv.y));
        float cloudAmount =
          smoothstep(0.43, 0.7, cloudTexture) *
          cloudBand *
          (0.28 + day * 0.48 + twilight * 0.36 + night * 0.1);
        float cloudEdge =
          smoothstep(0.36, 0.68, cloudTexture) *
          (1.0 - smoothstep(0.68, 0.9, cloudTexture)) *
          cloudBand;
        vec3 cloudDay = mix(
          vec3(0.74, 0.82, 0.88),
          vec3(1.0, 0.97, 0.9),
          saturate(uv.y * 0.7 + twilight * 0.35)
        );
        vec3 cloudNight = vec3(0.075, 0.088, 0.14);
        vec3 cloudColor = mix(cloudNight, cloudDay, saturate(day + twilight * 0.65));

        color += vec3(0.14, 0.32, 0.78) * rayleigh * day * 0.22;
        color += vec3(1.0, 0.72, 0.44) * forwardScatter * (0.025 + twilight * 0.09);
        color += vec3(1.0, 0.55, 0.34) * horizon * twilight * 0.36;
        color += vec3(0.82, 0.92, 1.0) * lowerAir * day * 0.08;
        color += vec3(1.0, 0.88, 0.68) * veil * horizon * twilight * 0.045;
        color += vec3(0.11, 0.16, 0.32) * night * (1.0 - uv.y) * 0.14;
        color = mix(color, cloudColor, cloudAmount);
        color += vec3(1.0, 0.96, 0.88) * cloudEdge * (day * 0.04 + twilight * 0.07);

        color = 1.0 - exp(-color * (0.92 + day * 0.18));
        color = pow(color, vec3(0.92));
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    const vertexShader = createAtmosphericShader(
      gl,
      gl.VERTEX_SHADER,
      vertexSource,
    );
    const fragmentShader = createAtmosphericShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSource,
    );

    if (!vertexShader || !fragmentShader) {
      return () => canvas.remove();
    }

    const program = gl.createProgram();
    if (!program) {
      return () => canvas.remove();
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return () => canvas.remove();
    }

    const buffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, "position");
    const resolutionLocation = gl.getUniformLocation(
      program,
      "uResolution",
    );
    const sunLocation = gl.getUniformLocation(
      program,
      "uSunDirection",
    );
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const dayProgressLocation = gl.getUniformLocation(
      program,
      "uDayProgress",
    );
    const motionScaleLocation = gl.getUniformLocation(
      program,
      "uMotionScale",
    );
    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const observer = new ResizeObserver(resize);
    let frame = 0;
    const render = (now: number) => {
      const sun = sunDirectionFromTime(timeRef.current);
      const dayProgress = (((timeRef.current % 24) + 24) % 24) / 24;

      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(
        positionLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.uniform2f(
        resolutionLocation,
        canvas.width,
        canvas.height,
      );
      gl.uniform3f(sunLocation, sun.x, sun.y, sun.z);
      gl.uniform1f(timeLocation, now / 1000);
      gl.uniform1f(dayProgressLocation, dayProgress);
      gl.uniform1f(motionScaleLocation, reduceMotion ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = window.requestAnimationFrame(render);
    };

    observer.observe(host);
    frame = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    />
  );
}

function ExplorationMenu({
  exploration,
  moonVisual,
  onChange,
}: {
  exploration: ExplorationId;
  moonVisual: MoonVisualState;
  onChange: (value: ExplorationId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeExploration =
    EXPLORATIONS.find((item) => item.id === exploration) ??
    EXPLORATIONS[0];

  return (
    <nav
      aria-label="Sky explorations"
      className="absolute right-3 bottom-[21rem] z-10 text-white sm:right-5 sm:bottom-5"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="sky-exploration-menu"
        onClick={() => setIsOpen((value) => !value)}
        className="min-h-11 w-[min(12.5rem,calc(100vw-1.5rem))] rounded-[14px] border border-white/14 bg-[#11141a]/32 px-3 py-2 text-left shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_18px_46px_-30px_rgb(0_0_0/0.72)] backdrop-blur-xl transition-[background-color,border-color,transform] duration-150 ease-out hover:border-white/22 hover:bg-[#11141a]/42 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/78 active:scale-[0.985] sm:w-56"
      >
        <span className="block font-sans text-[10px] font-semibold tracking-[0.11em] text-white/52 uppercase">
          Sky test
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-3">
          <span className="truncate font-sans text-[13px] font-medium leading-tight">
            {activeExploration.label}
          </span>
          <span
            aria-hidden="true"
            className={[
              "h-1.5 w-1.5 rounded-full bg-white transition-transform duration-150 ease-out",
              isOpen ? "scale-100" : "scale-75",
            ].join(" ")}
          />
        </span>
      </button>

      {isOpen ? (
        <div
          id="sky-exploration-menu"
          className="absolute right-0 bottom-[calc(100%+0.5rem)] w-[min(16rem,calc(100vw-1.5rem))] rounded-[14px] bg-[#11141a]/42 p-2 shadow-[0_0_0_1px_rgb(255_255_255/0.12),0_18px_46px_-30px_rgb(0_0_0/0.72)] backdrop-blur-xl sm:w-64"
        >
          <div className="grid gap-1">
            {EXPLORATIONS.map((item) => {
              const isActive = item.id === exploration;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    onChange(item.id);
                    setIsOpen(false);
                  }}
                  className={[
                    "group min-h-11 rounded-[10px] border px-2.5 py-2 text-left transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/78 active:scale-[0.985]",
                    isActive
                      ? "border-white/26 bg-white/16 text-white"
                      : "border-transparent bg-transparent text-white/72 hover:border-white/16 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-sans text-[13px] font-medium leading-tight">
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        "h-1.5 w-1.5 rounded-full transition-colors duration-150 ease-out",
                        isActive ? "bg-white" : "bg-white/22",
                      ].join(" ")}
                    />
                  </span>
                  <span className="mt-0.5 block font-sans text-[11px] leading-snug text-white/48 group-hover:text-white/62">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between gap-3 px-1.5 font-sans text-[10px] font-semibold tracking-[0.08em] text-white/42 uppercase">
              <span>Moon source</span>
              <span>
                {moonVisual.svsFrameNumber
                  ? `#${moonVisual.svsFrameNumber}`
                  : "sample"}
              </span>
            </div>
            <p className="mt-1 px-1.5 font-sans text-[11px] leading-snug text-white/56">
              {moonVisual.sourceLabel}
            </p>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

export default function SkyMoonStudy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererState | null>(null);
  const settingsRef = useRef({
    sample: DEFAULT_MOON_SAMPLE,
    timeOfDay: DEFAULT_TIME_OF_DAY,
    exploration: DEFAULT_EXPLORATION,
  });
  const frameRef = useRef(0);

  const [moonSample, setMoonSample] = useState<MoonSample>(
    DEFAULT_MOON_SAMPLE,
  );
  const [timeOfDay, setTimeOfDay] = useState(DEFAULT_TIME_OF_DAY);
  const [exploration, setExploration] =
    useState<ExplorationId>(DEFAULT_EXPLORATION);

  useEffect(() => {
    let isMounted = true;

    fetch(NASA_MOON_SAMPLES_SRC)
      .then((response) => {
        if (!response.ok)
          throw new Error("Moon sample request failed");
        return response.json() as Promise<MoonSample[]>;
      })
      .then((samples) => {
        if (!isMounted || samples.length === 0) return;
        setMoonSample(
          samples[findNearestMoonSampleIndex(samples, new Date())],
        );
      })
      .catch(() => {
        if (!isMounted) return;
        setMoonSample(DEFAULT_MOON_SAMPLE);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const moonCanvas = document.createElement("canvas");
    const moonCtx = moonCanvas.getContext("2d");
    const moonTextureCanvas = document.createElement("canvas");
    const moonTextureCtx = moonTextureCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!moonCtx || !moonTextureCtx) return;

    rendererRef.current = {
      stars: [],
      reduceMotion,
      moonCanvas,
      moonCtx,
      moonTextureCanvas,
      moonTextureCtx,
      moonTextureData: null,
      moonTextureVersion: 0,
      moonCacheKey: "",
      moonSvsImage: null,
      moonSvsImageSrc: "",
      moonSvsImageLoaded: false,
      moonSvsImageErrorSrc: "",
      moonSvsImageVersion: 0,
      width: 0,
      height: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    };

    const resize = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const rect = canvas.getBoundingClientRect();
      renderer.width = rect.width;
      renderer.height = rect.height;
      renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.stars = buildStars(renderer.width, renderer.height);

      canvas.width = Math.round(renderer.width * renderer.dpr);
      canvas.height = Math.round(renderer.height * renderer.dpr);
      ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    };

    const drawFrame = (now: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const {
        sample,
        timeOfDay: currentTimeOfDay,
        exploration: currentExploration,
      } = settingsRef.current;
      const look = skyLook(skyAltitudeFromTime(currentTimeOfDay));
      const moonVisual = createMoonVisualState(sample, look);

      ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
      ctx.clearRect(0, 0, renderer.width, renderer.height);

      if (isCanvasSky(currentExploration)) {
        drawCanvasSky(
          ctx,
          renderer.width,
          renderer.height,
          look,
          currentTimeOfDay,
        );
      }

      drawStars(ctx, renderer, look, now / 1000);
      drawMoon(ctx, renderer, moonVisual);
      if (!isCanvasSky(currentExploration)) {
        drawForegroundClouds(
          ctx,
          renderer,
          look,
          currentTimeOfDay,
          now / 1000,
        );
      }

      if (!renderer.reduceMotion) {
        frameRef.current = window.requestAnimationFrame(drawFrame);
      }
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawFrame(0);
    });

    observer.observe(canvas);
    resize();
    drawFrame(0);
    rendererRef.current.requestRedraw = () => {
      if (rendererRef.current?.reduceMotion) {
        drawFrame(performance.now());
      }
    };

    const moonImage = new Image();
    moonImage.decoding = "async";
    moonImage.onload = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      renderer.moonTextureCanvas.width = moonImage.naturalWidth;
      renderer.moonTextureCanvas.height = moonImage.naturalHeight;
      renderer.moonTextureCtx.drawImage(moonImage, 0, 0);
      renderer.moonTextureData = renderer.moonTextureCtx.getImageData(
        0,
        0,
        moonImage.naturalWidth,
        moonImage.naturalHeight,
      );
      renderer.moonTextureVersion += 1;
      renderer.moonCacheKey = "";

      if (renderer.reduceMotion) {
        drawFrame(performance.now());
      }
    };
    moonImage.src = NASA_MOON_TEXTURE_SRC;

    return () => {
      observer.disconnect();
      moonImage.onload = null;
      moonImage.onerror = null;
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const moonDate = formatMoonDate(moonSample);
  const currentLook = skyLook(skyAltitudeFromTime(timeOfDay));
  const moonVisual = createMoonVisualState(moonSample, currentLook);
  const lit = Math.round(moonVisual.illumination * 100);
  const phaseName = moonVisual.phaseName;
  const skyLabel = timeOfDayLabel(timeOfDay);
  const formattedTime = formatHour(timeOfDay);
  const timePercent = (timeOfDay / 24) * 100;

  useEffect(() => {
    settingsRef.current = { sample: moonSample, timeOfDay, exploration };

    const renderer = rendererRef.current;
    if (!renderer?.reduceMotion) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    ctx.clearRect(0, 0, renderer.width, renderer.height);
    if (isCanvasSky(exploration)) {
      drawCanvasSky(
        ctx,
        renderer.width,
        renderer.height,
        currentLook,
        timeOfDay,
      );
    }
    drawStars(ctx, renderer, currentLook, 0);
    drawMoon(
      ctx,
      renderer,
      createMoonVisualState(settingsRef.current.sample, currentLook),
    );
    if (!isCanvasSky(exploration)) {
      drawForegroundClouds(ctx, renderer, currentLook, timeOfDay, 0);
    }
  }, [currentLook, exploration, moonSample, timeOfDay]);

  return (
    <main className="relative h-screen min-h-[620px] overflow-hidden bg-black text-[#24231f]">
      {exploration === "atmospheric" ? (
        <AtmosphericScatteringBackground timeOfDay={timeOfDay} />
      ) : null}

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${skyLabel} sky with a ${phaseName.toLowerCase()}, ${lit}% illuminated NASA moon.`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/22 to-transparent" />

      <ExplorationMenu
        exploration={exploration}
        moonVisual={moonVisual}
        onChange={setExploration}
      />

      <aside
        className="absolute bottom-4 rounded-[18px] bg-[#f8f6ef]/78 p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.38),0_18px_52px_-28px_rgb(0_0_0/0.48)] backdrop-blur-xl sm:bottom-6"
        style={{
          left: "50%",
          width: "calc(100vw - 2rem)",
          maxWidth: 460,
          transform: "translateX(-50%)",
        }}
      >
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-[11px] font-semibold tracking-[0.08em] text-[#777164] uppercase">
              Time of day
            </p>
            <h1 className="font-georgia mt-1 text-2xl leading-none tracking-normal text-[#24231f]">
              {skyLabel}
            </h1>
          </div>
          <div className="shrink-0 text-right font-sans">
            <p className="font-mono text-sm text-[#24231f] tabular-nums">
              {formattedTime}
            </p>
            <p className="mt-1 hidden text-[11px] text-[#776f61] sm:block">
              {phaseName}, {lit}% lit
            </p>
          </div>
        </header>

        <label className="mt-4 block">
          <span className="sr-only">Time of day</span>
          <input
            type="range"
            min="0"
            max="24"
            step="0.05"
            value={timeOfDay}
            onChange={(event) =>
              setTimeOfDay(Number(event.currentTarget.value))
            }
            className="sky-moon-range mt-2"
            style={
              {
                "--range-progress": `${timePercent}%`,
              } as CSSProperties
            }
          />
          <span className="mt-2 flex items-center justify-between gap-4 font-sans text-[11px] text-[#776f61]">
            <span>{moonDate}</span>
            <span className="hidden font-mono tabular-nums sm:inline">
              NASA phase data
            </span>
          </span>
        </label>
      </aside>
    </main>
  );
}
