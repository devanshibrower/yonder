import { MeteorConfig } from "@/lib/meteor-animation";
import showersData from "@/data/showers.json";
import { MeteorShower } from "@/data/types";

// Visual lookup table: radiantX/Y and colorHue per shower (mapped to canvas coordinates)
export const SHOWER_VISUALS: Record<
  string,
  { radiantX: number; radiantY: number; colorHue: number; colorVariance?: number }
> = {
  quadrantids: { radiantX: 0.3, radiantY: 0.2, colorHue: 220 },
  lyrids: { radiantX: 0.6, radiantY: 0.15, colorHue: 45 },
  "eta-aquariids": { radiantX: 0.7, radiantY: 0.65, colorHue: 110 },
  "southern-delta-aquariids": { radiantX: 0.72, radiantY: 0.7, colorHue: 55 },
  "alpha-capricornids": { radiantX: 0.55, radiantY: 0.6, colorHue: 30 },
  perseids: { radiantX: 0.25, radiantY: 0.15, colorHue: 55, colorVariance: 90 },
  orionids: { radiantX: 0.4, radiantY: 0.45, colorHue: 110 },
  "southern-taurids": { radiantX: 0.3, radiantY: 0.4, colorHue: 35 },
  "northern-taurids": { radiantX: 0.32, radiantY: 0.35, colorHue: 30 },
  leonids: { radiantX: 0.5, radiantY: 0.35, colorHue: 120 },
  geminids: { radiantX: 0.45, radiantY: 0.2, colorHue: 45, colorVariance: 120 },
  ursids: { radiantX: 0.5, radiantY: 0.1, colorHue: 210 },
};

/** Build a full MeteorConfig from shower JSON data + visual lookup */
export function buildMeteorConfig(shower: MeteorShower): MeteorConfig {
  const visuals = SHOWER_VISUALS[shower.id] ?? {
    radiantX: 0.5,
    radiantY: 0.3,
    colorHue: 180,
  };
  return {
    velocityKmPerSec: shower.velocity.kmPerSec,
    zhr: shower.zhr,
    radiantX: visuals.radiantX,
    radiantY: visuals.radiantY,
    colorHue: visuals.colorHue,
    moonIllumination: shower.moonPhase2026.percentIlluminated,
    moonPhaseName: shower.moonPhase2026.phaseName,
    parentObjectType: shower.parentObject.type as "comet" | "asteroid",
    velocityCategory: shower.velocity.category as "slow" | "medium" | "swift",
    peakMonth: shower.peak.month,
    colorVariance: visuals.colorVariance,
  };
}

/** Numeric linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc hue interpolation (avoids sweeping the full spectrum, e.g. 350→30) */
export function lerpHue(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
}

/** Interpolate all numeric fields of MeteorConfig; snap strings at midpoint; round peakMonth */
export function lerpConfig(
  configA: MeteorConfig,
  configB: MeteorConfig,
  t: number
): MeteorConfig {
  const snap = t < 0.5;
  return {
    velocityKmPerSec: lerp(configA.velocityKmPerSec, configB.velocityKmPerSec, t),
    zhr: lerp(configA.zhr, configB.zhr, t),
    radiantX: lerp(configA.radiantX, configB.radiantX, t),
    radiantY: lerp(configA.radiantY, configB.radiantY, t),
    colorHue: lerpHue(configA.colorHue, configB.colorHue, t),
    moonIllumination: lerp(
      configA.moonIllumination,
      configB.moonIllumination,
      t
    ),
    moonPhaseName: snap
      ? configA.moonPhaseName
      : configB.moonPhaseName,
    parentObjectType: snap
      ? configA.parentObjectType
      : configB.parentObjectType,
    velocityCategory: snap
      ? configA.velocityCategory
      : configB.velocityCategory,
    peakMonth: Math.round(
      lerp(configA.peakMonth, configB.peakMonth, t)
    ),
    colorVariance: configA.colorVariance !== undefined && configB.colorVariance !== undefined
      ? lerp(configA.colorVariance, configB.colorVariance, t)
      : (snap ? configA.colorVariance : configB.colorVariance),
  };
}

/** 5 featured showers chosen for visual variety across seasons/types */
export const FEATURED_SHOWER_IDS = [
  "quadrantids",   // Jan, asteroid, medium, ZHR 120, 99% moon
  "perseids",      // Aug, comet, swift, ZHR 100, 0% moon
  "geminids",      // Dec, asteroid, medium, ZHR 150, 21% moon
  "eta-aquariids", // May, comet, swift, ZHR 50, 84% moon
  "leonids",       // Nov, comet, swift, ZHR 15, 45% moon
] as const;

const allShowers = showersData.showers as MeteorShower[];

export const FEATURED_SHOWERS: MeteorShower[] = FEATURED_SHOWER_IDS.map(
  (id) => allShowers.find((s) => s.id === id)!
);

export const ALL_SHOWERS: MeteorShower[] = allShowers;

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}

// --- Year timeline utilities (Direction E) ---

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Convert "April 22" to day-of-year (1-indexed, non-leap 2026) */
export function parseDateToDay(dateStr: string): number {
  const parts = dateStr.trim().split(/\s+/);
  const monthNum = MONTH_NAME_TO_NUM[parts[0].toLowerCase()];
  const day = parseInt(parts[1], 10);
  if (!monthNum || isNaN(day)) return 1;
  let doy = day;
  for (let m = 1; m < monthNum; m++) doy += DAYS_IN_MONTH[m];
  return doy;
}

/** Day-of-year (1-indexed) to calendar month (1-12) */
export function dayToMonth(dayOfYear: number): number {
  let remaining = dayOfYear;
  for (let m = 1; m <= 12; m++) {
    if (remaining <= DAYS_IN_MONTH[m]) return m;
    remaining -= DAYS_IN_MONTH[m];
  }
  return 12;
}

// Actual 2026 new moon dates as day-of-year
// Includes Dec 2025 and Jan 2027 boundaries for interpolation
const NEW_MOON_DAYS_2026 = [
  -12,  // ~Dec 19, 2025
   18,  // Jan 18
   48,  // Feb 17
   78,  // Mar 19
  107,  // Apr 17
  136,  // May 16
  166,  // Jun 15
  195,  // Jul 14
  224,  // Aug 12
  254,  // Sep 11
  283,  // Oct 10
  313,  // Nov 9
  343,  // Dec 9
  373,  // ~Jan 8, 2027
];

/** Phase position within a lunar cycle (0 = new moon, 0.5 = full moon, 1 = next new moon) */
export function moonPhasePosition(dayOfYear: number): number {
  let prevIdx = 0;
  for (let i = 0; i < NEW_MOON_DAYS_2026.length - 1; i++) {
    if (NEW_MOON_DAYS_2026[i + 1] > dayOfYear) { prevIdx = i; break; }
  }
  const prev = NEW_MOON_DAYS_2026[prevIdx];
  const next = NEW_MOON_DAYS_2026[prevIdx + 1];
  return (dayOfYear - prev) / (next - prev);
}

/** Moon illumination percentage for a day-of-year using real 2026 new moon dates */
export function moonIlluminationForDay(dayOfYear: number): number {
  const pos = moonPhasePosition(dayOfYear);
  return ((1 - Math.cos(2 * Math.PI * pos)) / 2) * 100;
}

/** Moon phase name for a day-of-year */
export function moonPhaseNameForDay(dayOfYear: number): string {
  const pos = moonPhasePosition(dayOfYear);
  if (pos < 0.0625) return "new moon";
  if (pos < 0.1875) return "waxing crescent";
  if (pos < 0.3125) return "first quarter";
  if (pos < 0.4375) return "waxing gibbous";
  if (pos < 0.5625) return "full moon";
  if (pos < 0.6875) return "waning gibbous";
  if (pos < 0.8125) return "last quarter";
  if (pos < 0.9375) return "waning crescent";
  return "new moon";
}

/** Peak day-of-year for a shower */
function showerPeakDay(shower: MeteorShower): number {
  let doy = shower.peak.dayOfMonth;
  for (let m = 1; m < shower.peak.month; m++) doy += DAYS_IN_MONTH[m];
  return doy;
}

/** Active period start/end as day-of-year, handling Dec-Jan wrap */
function showerActiveDays(shower: MeteorShower): { start: number; end: number } {
  let start = parseDateToDay(shower.activePeriod.start);
  const end = parseDateToDay(shower.activePeriod.end);
  // Handle Quadrantids wrap: "December 28" → "January 12"
  if (start > end) start = 1;
  return { start, end };
}

/** Triangular ZHR ramp: 0 at active edges, full ZHR at peak */
function instantaneousZHR(dayOfYear: number, shower: MeteorShower): number {
  const { start, end } = showerActiveDays(shower);
  const peak = showerPeakDay(shower);
  if (dayOfYear < start || dayOfYear > end) return 0;
  if (dayOfYear <= peak) {
    const ramp = peak === start ? 1 : (dayOfYear - start) / (peak - start);
    return shower.zhr * ramp;
  } else {
    const ramp = end === peak ? 1 : (end - dayOfYear) / (end - peak);
    return shower.zhr * ramp;
  }
}

/** Build a MeteorConfig for a given day-of-year */
export function buildDayConfig(dayOfYear: number, showers: MeteorShower[]): MeteorConfig {
  const month = dayToMonth(dayOfYear);
  const moonIllum = moonIlluminationForDay(dayOfYear);
  const moonPhase = moonPhaseNameForDay(dayOfYear);

  // Find dominant shower (highest instantaneous ZHR)
  let bestZHR = 0;
  let bestShower: MeteorShower | null = null;
  for (const shower of showers) {
    const zhr = instantaneousZHR(dayOfYear, shower);
    if (zhr > bestZHR) {
      bestZHR = zhr;
      bestShower = shower;
    }
  }

  if (bestShower && bestZHR > 0) {
    const visuals = SHOWER_VISUALS[bestShower.id] ?? {
      radiantX: 0.5, radiantY: 0.3, colorHue: 180,
    };
    return {
      velocityKmPerSec: bestShower.velocity.kmPerSec,
      zhr: bestZHR,
      radiantX: visuals.radiantX,
      radiantY: visuals.radiantY,
      colorHue: visuals.colorHue,
      moonIllumination: moonIllum,
      moonPhaseName: moonPhase,
      parentObjectType: bestShower.parentObject.type as "comet" | "asteroid",
      velocityCategory: bestShower.velocity.category as "slow" | "medium" | "swift",
      peakMonth: month,
      colorVariance: visuals.colorVariance,
    };
  }

  // Quiet sky: no active shower
  return {
    velocityKmPerSec: 40,
    zhr: 0,
    radiantX: 0.5,
    radiantY: 0.3,
    colorHue: 180,
    moonIllumination: moonIllum,
    moonPhaseName: moonPhase,
    parentObjectType: "comet",
    velocityCategory: "medium",
    peakMonth: month,
  };
}

/** Build 365 daily configs for the full year */
export function buildYearConfigs(showers: MeteorShower[]): MeteorConfig[] {
  const configs: MeteorConfig[] = [];
  for (let day = 1; day <= 365; day++) {
    configs.push(buildDayConfig(day, showers));
  }
  return configs;
}
