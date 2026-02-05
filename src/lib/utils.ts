import { MeteorShower } from "@/data/types";
import showersData from "@/data/showers.json";

//cast JSON data to our typed array
export const All_Showers = showersData.showers as MeteorShower[];

//shape of animation data needed for the animation engine. Each field controls a different aspect of how meteors look and behave.
export interface MeteorConfig {
  velocityKmPerSec: number; //meteor speed
  zhr: number; //zenithal hourly rate - controls spawn frequency
  radiantX: number; //0-1, where meteors originate horizontally on the canvas
  radiantY: number; //01, where meteors originate vertically on the canvas
  colorHue: number; //0-360, base color of the meteor trails
  moonIllumination: number; //0-100, dims stars and faint meteors
  moonPhaseName: string; //new moon, full moon etc
  parentObjectType: "comet" | "asteroid"; //affects trail style
  velocityCategory: "slow" | "medium" | "swift"; //affects streak length
  peakMonth: number; //1-12, controls seasonal sky colors
  colorVariance?: number; //optional, how much hue varies between meteors
}

//Visual properties per shower: where the radiant point sits on screen (0-1) and the base hue of the meteor trails (0-360 color wheel). These are artistic choices, not scientific.
export const ShowerVisuals: Record<
  string,
  {
    radiantX: number;
    radiantY: number;
    colorHue: number;
    colorVariance?: number;
  }
> = {
  quadrantids: { radiantX: 0.3, radiantY: 0.2, colorHue: 220 },
  lyrids: { radiantX: 0.6, radiantY: 0.15, colorHue: 45 },
  //Keys in quotes like "eta-aquariids" need quotes because they contain hyphens — bare identifiers can't have hyphens in JavaScript.
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

//Build a meteorConfig from a single shower's JSON data + visual lookup. Used when displaying a specific shower on canvas.
export function buildMeteorConfig(shower: MeteorShower): MeteorConfig {
  //look up visuals, fallback to defaults if shower ID isnt in the table.
  const visuals = ShowerVisuals[shower.id] ?? {
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

//Build a MeteorConfig for any day of the year, using the dominant shower. if nono shower is active, rturns a quiet sky config with ZHR 0.

export function buildDayConfig(
  dayOfYear: number,
  showers: MeteorShower[]
): MeteorConfig {
  const month = dayToMonth(dayOfYear);
  const moonIllumination = moonIlluminationForDay(dayOfYear);
  const moonPhase = moonPhaseNameForDay(dayOfYear);

  //find the shower with the highest ZHR for this day
  let bestZHR = 0;
  let bestShower: MeteorShower | null = null;
  for (const shower of showers) {
    const zhr = instantaneousZHR(dayOfYear, shower);
    if (zhr > bestZHR) {
      bestZHR = zhr;
      bestShower = shower;
    }
  }
  //if a shower is active, build a config from it
  if (bestShower && bestZHR > 0) {
    const visual = ShowerVisuals[bestShower.id] ?? {
      radiantX: 0.5,
      radiantY: 0.3,
      colorHue: 180,
    };
    return {
      velocityKmPerSec: bestShower.velocity.kmPerSec,
      zhr: bestZHR,
      radiantX: visual.radiantX,
      radiantY: visual.radiantY,
      colorHue: visual.colorHue,
      moonIllumination: moonIllumination,
      moonPhaseName: moonPhase,
      parentObjectType: bestShower.parentObject.type as "comet" | "asteroid",
      velocityCategory: bestShower.velocity.category as
        | "slow"
        | "medium"
        | "swift",
      peakMonth: month,
      colorVariance: visual.colorVariance,
    };
  }
  //no shower active: return a quiet sky config with ZHR 0
  return {
    velocityKmPerSec: 40,
    zhr: 0,
    radiantX: 0.5,
    radiantY: 0.3,
    colorHue: 180,
    moonIllumination: moonIllumination,
    moonPhaseName: moonPhase,
    parentObjectType: "comet",
    velocityCategory: "medium",
    peakMonth: month,
  };
}

//days in each month for 2026 (non-leap year)
//index 0 is unused so that january = index 1. 0 at index 0 is a placeholder, so months line up with their natural number.
const DaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

//record is a typescript utility type. it says "this is an object where every key is a string and every value is a number". More speciifc version of { [key: string]: number }. we use an object instead of an array because we want to match the month name to the number of the month, index doesnt matter.

const MonthNametoNum: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

//convert a date string like "june 15" to a day of year (1-365). example Jan 1 = 1, Feb 1 = 32, etc.

export function parseDatetoDay(dateStr: string): number {
  //trim() removes whitespace from the beginning and end of the string. split(/\s+/) splits the string into an array of parts separated by whitespace - june 15 becomes ["june", "15"]
  const parts = dateStr.trim().split(/\s+/);

  // converts the first part of parts const which is the month (April to april) so we can match it against the MonthNametoNum object which uses lowercase.
  const monthNum = MonthNametoNum[parts[0].toLowerCase()];

  //The 10 means base-10 (decimal). Without it, parseInt can behave unexpectedly with strings like "08".
  const day = parseInt(parts[1], 10);

  //isNaN(day) checks if the day is not a number. If it's not a number, return 1 because the day is invalid.
  if (!monthNum || isNaN(day)) return 1;

  //doy is day of year. Start with day within the month, then add all previous months days to get the day of the year.
  let doy = day;
  for (let m = 1; m < monthNum; m++) doy += DaysInMonth[m];
  return doy;
}

//convert a doy back to month number. walks through months, subtracting each month's days until the remainder fits. Eg: day 112: subtract Jan(31) = 81, then Feb(28) = 53, then Mar(31) = 22, 22 < 30 (april), so it's April, return 4.
export function dayToMonth(dayOfYear: number): number {
  let remaining = dayOfYear;
  for (let m = 1; m <= 12; m++) {
    if (remaining <= DaysInMonth[m]) return m;
    remaining = remaining - DaysInMonth[m];
  }
  return 12; //default to December if we get here
}

//month nymber to name. index 0 is empty, so month 1 is January. ?? is nullish coalescing operator. if the left side is null or undefined, return the right side, which in this case in an empty string.
const MonthNames = [
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
  return MonthNames[month] ?? "";
}

//------------------------------------
//Moon phase calculations
//------------------------------------
//using real new moon dates for 2026 as day of year numbers. New moon = moon is completely dark. (0% illumination). The moon cucles every ~29.5 days: new -> full -> new again. we include dec 2025 and jan 2027 as boundaries, so any day in 2026 falls between two entries in this array.

const NewMoonDays2026: number[] = [
  -12, // ~Dec 19, 2025
  18, // Jan 18
  48, // Feb 17
  78, // Mar 19
  107, // Apr 17
  136, // May 16
  166, // Jun 15
  195, // Jul 14
  224, // Aug 12
  254, // Sep 11
  283, // Oct 10
  313, // Nov 9
  343, // Dec 9
  373, // ~Jan 8, 2027
];

//Where is the lunar cycle at a given day of year? Find the previous new moon date and the next new moon date, then interpolate between them.

export function moonPhasePosition(dayOfYear: number): number {
  //walk the array to find which two new moons bracket this day
  let prevIdx = 0;
  for (let i = 0; i < NewMoonDays2026.length - 1; i++) {
    // if next new moon is after our day, we found our the end of the bracket.
    if (NewMoonDays2026[i + 1] > dayOfYear) {
      prevIdx = i;
      break;
    }
  }
  const prev = NewMoonDays2026[prevIdx];
  const next = NewMoonDays2026[prevIdx + 1];

  //fraction between the two new moons: 0 = prev new moon, 1 = next new moon.

  return (dayOfYear - prev) / (next - prev);
}

//how illuminated is the moon on a given day? returns 0-100. Uses cosine to model the brightness curve. Cos(0) = 1 at new moon (phase 0), cos(pi) = -1 at full moon (phase 0.5), cos(2pi) = 1 again at new moon (phase 1).

//the formula (1- - cos(2pi * PhasePos)) / 2 * 100 flips this so that phase 0 = 0% (new moon, dark) and phase 0.5 = 100% (full moon, bright).

export function moonIlluminationForDay(dayOfYear: number): number {
  const phase = moonPhasePosition(dayOfYear);
  return ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100;
}

//phase name for a given day that we can display to visitors. divides the cycle into 8 equal segments of ~3.7 days each.
export function moonPhaseNameForDay(dayOfYear: number): string {
  const phase = moonPhasePosition(dayOfYear);
  if (phase < 0.0625) return "new moon";
  if (phase < 0.1875) return "waxing crescent";
  if (phase < 0.3125) return "first quarter";
  if (phase < 0.4375) return "waxing gibbous";
  if (phase < 0.5625) return "full moon";
  if (phase < 0.6875) return "waning gibbous";
  if (phase < 0.8125) return "last quarter";
  if (phase < 0.9375) return "waning crescent";
  return "new moon";
}

//------------------------------------
//Shower activity
//------------------------------------

//we need to import the meteorshower type so TypeScript knows the shape of shower data. Added to the top of this file.

//peak day of the year for a shower. Same logic as parseDatetoDay, but uses the numeric month/day from the shower data instead of parsing a string.
export function showerPeakDay(shower: MeteorShower): number {
  let doy = shower.peak.dayOfMonth;
  for (let m = 1; m < shower.peak.month; m++) doy = doy + DaysInMonth[m];
  return doy;
}

export function monthStartDayofYear(month: number): number {
  let d = 1;
  for (let m = 1; m < month; m++) {
    d = d + DaysInMonth[m];
  }
  return d;
}

export const ShowerHeight_Vh = 100;
export const SpacerHeight_Vh = 80;
export const MinGapForSpacer = 20;

//soecific shower pinned to its peak day
export interface ShowerSection {
  type: "shower";
  shower: MeteorShower;
  peakDay: number;
  heightVh: number;
}

//this section covers a range of days between showers, labeled with a month name.
export interface SpacerSection {
  type: "spacer";
  startDay: number;
  endDay: number;
  label: string;
  count: number;
  heightVh: number;
}

//could be either one of the sections mentioned above
export type LayoutSection = ShowerSection | SpacerSection;

//this function will take all 12 showers (sorted by peak date) and produce the array of sections on the website, alternating spacers and showers.
export function buildLayout(showers: MeteorShower[]): LayoutSection[] {
  //layout is the array we will return
  const layout: LayoutSection[] = [];
  //this maps the peak day for every shower, giving an array of peak day numbers like [3, 112,...etc]
  const peakDays = showers.map(showerPeakDay);

  //addspacer function to fill in spacer section from one to another. For example, if fromDay is 32 (Feb 1) and toDay is 112 (Apr 22), it would create spacers for February, March, and part of April.
  function addSpacers(fromDay: number, toDay: number) {
    const totalGap = toDay - fromDay;
    if (totalGap <= MinGapForSpacer) return; // if gap is too small, skip this function

    const startMonth = dayToMonth(fromDay);
    const endMonth = dayToMonth(toDay);

    for (let m = startMonth; m <= endMonth; m++) {
      const mStart = monthStartDayofYear(m);
      const mEnd = mStart + DaysInMonth[m];
      const spacerStart = Math.max(fromDay, mStart);
      const spacerEnd = Math.min(toDay, mEnd);
      const days = spacerEnd - spacerStart;

      if (days < 5) continue;

      const count = Math.max(1, Math.round(days / 30));
      layout.push({
        type: "spacer",
        startDay: spacerStart,
        endDay: spacerEnd,
        label: MonthNames[m],
        count,
        heightVh: SpacerHeight_Vh * count,
      });
    }
  }

  for (let i = 0; i < showers.length; i++) {
    const prevDay = i === 0 ? 1 : peakDays[i - 1];
    addSpacers(prevDay, peakDays[i]);

    layout.push({
      type: "shower",
      shower: showers[i],
      peakDay: peakDays[i],
      heightVh: ShowerHeight_Vh,
    });
  }
  addSpacers(peakDays[peakDays.length - 1], 365);
  return layout;
}

//active period start/end as day of year. Uses parseDatetoDay to convert string dates from JSON.
function showerActiveDays(shower: MeteorShower): {
  start: number;
  end: number;
} {
  let start = parseDatetoDay(shower.activePeriod.start);
  const end = parseDatetoDay(shower.activePeriod.end);
  if (start > end) start = 1;
  return { start: start, end: end };
}

//how strong is the shower? returns ZHR (zenithal hourly rate). Uses a triangular ramp: 0 at the edges of the active period, peak ZHR at the peak day.
//      peak ZHR
//          /\
//         /  \
//        /    \
//   ____/      \____
//  start  peak  end

function instantaneousZHR(dayOfYear: number, shower: MeteorShower): number {
  const { start, end } = showerActiveDays(shower);
  const peak = showerPeakDay(shower);

  //outside the active period = no meteors; if day of year is before start OR (||) after end, return 0.
  if (dayOfYear < start || dayOfYear > end) return 0;

  //inside the active period: calculate ZHR based on position relative to peak.
  if (dayOfYear <= peak) {
    //rising side: ramp form 0 at start to full ZHR at peak
    let ramp;
    if (peak === start)
      ramp = 1; // is peak day exactly the same as start day? if so, ramp is 1 (full ZHR)
    else ramp = (dayOfYear - start) / (peak - start);
    return shower.zhr * ramp;
  } else {
    //falling side: ramp from full ZHR at peak to 0 at end
    let ramp;
    if (end === peak)
      ramp = 1; // is peak day exactly the same as end day? if so, ramp is 1 (full ZHR)
    else ramp = (end - dayOfYear) / (end - peak);
    return shower.zhr * ramp;
  }
}

//------------------------------------
//Config interpolation
//------------------------------------

//smoothly blend between two MeteorConfig objects so the sky between two meteors blends smoothly. t=0 returns a, t=1 returns b, t=0.5 returns the midpoint.

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

//hue interpolation that takes the shortest path around the color wheel. Without this, blending hue 350 (red) to hue 30 (orange) would sweep through the entire spectrum (350→300→200→100→30) instead of the short way (350→360/0→30)

export function lerpHue(a: number, b: number, t: number): number {
  //shift difference into -180 to +180 range (shortest arc)
  let diff = ((b - a + 540) % 360) - 180;
  //wrap back to 0-360 range
  return (((a + diff * t) % 360) + 360) % 360;
}

//Blend two MeteorConfigs together, number blend linearly, strings snap at midpoint (t=0.5) because you cant blend "comet" with "asteroid", its one or the other.

export function lerpConfig(
  configA: MeteorConfig,
  configB: MeteorConfig,
  t: number
): MeteorConfig {
  //snap = true when we're closer to configA (first half of blend)
  const snap = t < 0.5;
  return {
    velocityKmPerSec: lerp(
      configA.velocityKmPerSec,
      configB.velocityKmPerSec,
      t
    ),
    zhr: lerp(configA.zhr, configB.zhr, t),
    radiantX: lerp(configA.radiantX, configB.radiantX, t),
    radiantY: lerp(configA.radiantY, configB.radiantY, t),
    colorHue: lerpHue(configA.colorHue, configB.colorHue, t),
    moonIllumination: lerp(
      configA.moonIllumination,
      configB.moonIllumination,
      t
    ),
    //string fields cant blend, so use A's value in first half and B's in second half
    moonPhaseName: snap ? configA.moonPhaseName : configB.moonPhaseName,
    parentObjectType: snap
      ? configA.parentObjectType
      : configB.parentObjectType,
    velocityCategory: snap
      ? configA.velocityCategory
      : configB.velocityCategory,
    peakMonth: Math.round(lerp(configA.peakMonth, configB.peakMonth, t)),
    //colorVariance: only blend if both configs have it, otherwise snap colorVariance.
    colorVariance:
      configA.colorVariance !== undefined && configB.colorVariance !== undefined
        ? lerp(configA.colorVariance, configB.colorVariance, t)
        : snap
        ? configA.colorVariance
        : configB.colorVariance,
  };
}

//------------------------------------
//Year Config array
//------------------------------------

//Build a MeteorConfig for each day of the year(1 - 365). Used to animate the sky over the course of a year. This requires all shower data from the JSON (added on top of this file).

//this arrary drives the entire scroll experience. Index 0 = day 1 (jan 1), index 364 = day 365 (dec 31).

export function buildYearConfigs(showers: MeteorShower[]): MeteorConfig[] {
  const configs: MeteorConfig[] = [];
  for (let day = 1; day <= 365; day++) {
    configs.push(buildDayConfig(day, showers));
  }
  return configs;
}
