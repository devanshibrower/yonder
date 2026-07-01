"use client";

import { useCallback, useEffect, useRef } from "react";

/* ============================================================================
   MoonCalendar

   Draws the Moon's phase for one date, set inside a ring that stands for the
   calendar year.

   - The faint outer circle is the whole year. Twelve ticks and short labels
     mark the months, a brighter arc fills from January 1 up to the given date,
     and a dot sits on the date. The year is printed below the Moon.
   - The disc in the centre is the Moon's lit shape on that date: new, crescent,
     quarter, gibbous, or full. Waxing (growing) phases are lit on the right;
     waning (shrinking) phases are lit on the left.

   The ring is interactive when given an `onSelectDate` callback: hover it to
   read any day's date, click to pick that day, or arrow-key through days.

   This file exports TWO components that look and animate identically but use
   different phase math, so you can compare them:

     MoonCalendarSimple   - the easy "moon clock" (constant 29.53-day cycle)
     MoonCalendarAccurate - the real Sun->Moon angle, including the Moon's oval
                            orbit, so phases land on the right day

   Everything is self-contained: no lookup tables, no other files, any year.
============================================================================ */

// ============================================================================
// The moon math (two models)
// ============================================================================

// Both models return a "cycle position" in 0..1:
//   0 = new moon (dark), 0.5 = full moon, 1 = new moon again.

// ---- Model 1: the simple moon clock ----------------------------------------
//
// Pretend the Moon moves at a perfectly steady speed: exactly one cycle every
// 29.53 days, counted from a real new moon. Dead simple. But the real Moon
// speeds up and slows down in its oval orbit, so this can be off by up to about
// 15 hours, which sometimes names a phase a day early or late. Kept as an
// example of "good enough on average, wrong on any given day".

const MOON_CYCLE_MS = 29.530588853 * 24 * 60 * 60 * 1000; // one cycle, in ms
const A_REAL_NEW_MOON = Date.UTC(2026, 5, 15, 2, 54); // 15 Jun 2026, 02:54 UTC

function simpleCyclePosition(date: Date): number {
  const since = date.getTime() - A_REAL_NEW_MOON;
  // Leftover inside the current cycle, as a 0..1 fraction (kept positive).
  return (((since % MOON_CYCLE_MS) + MOON_CYCLE_MS) % MOON_CYCLE_MS) / MOON_CYCLE_MS;
}

// ---- Model 2: the real Sun-to-Moon angle -----------------------------------
//
// Work out the actual angle between the Sun and the Moon as seen from Earth
// (0deg = new, 180deg = full), then divide by 360 for the 0..1 position.
//
// Constants are from standard low-precision lunar theory (Jean Meeus, the same
// math NASA and astronomy libraries use). `meanAngle` is the steady-speed
// angle; the sine terms are the corrections for the Moon and Earth racing ahead
// and falling behind in their oval orbits. The first term (6.289deg) is the
// largest, from the Moon's own orbit. Accurate to well under a day.

const DEG = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12); // reference moment: noon UT, 1 Jan 2000

function accurateCyclePosition(date: Date): number {
  const days = (date.getTime() - J2000) / 86_400_000; // days since J2000

  const sunAnomaly = 357.5291 + 0.98560028 * days; // Earth's place in its orbit
  const moonAnomaly = 134.9634 + 13.0649929509 * days; // Moon's place in its orbit
  const meanAngle = 297.8502 + 12.1907491914 * days; // steady-speed Sun->Moon angle

  const angle =
    meanAngle +
    6.289 * Math.sin(moonAnomaly * DEG) +
    -2.1 * Math.sin(sunAnomaly * DEG) +
    1.274 * Math.sin((2 * meanAngle - moonAnomaly) * DEG) +
    0.658 * Math.sin(2 * meanAngle * DEG) +
    0.214 * Math.sin(2 * moonAnomaly * DEG) +
    0.11 * Math.sin(meanAngle * DEG);

  return ((angle % 360) + 360) % 360 / 360; // wrap to 0..360, then scale to 0..1
}

const MODELS = {
  simple: simpleCyclePosition,
  accurate: accurateCyclePosition,
} as const;

type ModelName = keyof typeof MODELS;

// ---- Shared derivations ----------------------------------------------------

/**
 * How much of the Moon's face is lit by the Sun, 0..1.
 * 0 = none (new moon), 1 = all of it (full moon). Follows a cosine curve.
 */
function litFractionFor(cyclePosition: number): number {
  return (1 - Math.cos(2 * Math.PI * cyclePosition)) / 2;
}

/**
 * How far through the calendar year a date is, 0..1.
 * Jan 1 is ~0, Dec 31 is ~1. Built from real dates, so leap years just work.
 */
function yearFractionFor(date: Date): number {
  const year = date.getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const nextYearStart = new Date(year + 1, 0, 1).getTime();
  return (date.getTime() - yearStart) / (nextYearStart - yearStart);
}

/** Turn a 0..1 position around the year back into a real Date in that year. */
function dateFromYearFraction(year: number, fraction: number): Date {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearLength = new Date(year + 1, 0, 1).getTime() - yearStart;
  return new Date(yearStart + fraction * yearLength);
}

/**
 * Plain-English name for the phase, the way a calendar (and Apple) labels it.
 *
 * The four "principal" phases — new, first quarter, full, last quarter — are
 * single instants, not ranges. So a day gets one of those names ONLY if that
 * exact instant lands on it. Every other day is a crescent or gibbous, decided
 * by how lit the Moon is and whether it's growing or shrinking.
 *
 * We detect "the instant lands on this day" by checking whether the cycle
 * position passes through 0 / 0.25 / 0.5 / 0.75 between this local midnight and
 * the next. (Over one day the position moves ~1/29.5 = 0.034, so at most one
 * crossing can happen.) This is why first quarter shows on June 21 — the day it
 * actually occurs — and June 22 reads waxing gibbous, matching Apple.
 */
function phaseNameForDay(date: Date, cyclePositionFor: (d: Date) => number): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // Cycle position at the start and end of this calendar day. Unwrap so the end
  // is always >= the start even when the day spans the new-moon rollover.
  const dayStart = cyclePositionFor(new Date(y, m, d));
  let dayEnd = cyclePositionFor(new Date(y, m, d + 1));
  if (dayEnd < dayStart) dayEnd += 1;

  // Does an exact phase value fall inside today? (Check the value and value+1
  // to cover the unwrapped range.)
  const happensToday = (value: number) =>
    (value >= dayStart && value < dayEnd) ||
    (value + 1 >= dayStart && value + 1 < dayEnd);

  if (happensToday(0)) return "new moon";
  if (happensToday(0.25)) return "first quarter";
  if (happensToday(0.5)) return "full moon";
  if (happensToday(0.75)) return "last quarter";

  // No principal phase today — name it by where the Moon is at midday.
  const midday = cyclePositionFor(new Date(y, m, d, 12));
  if (midday < 0.25) return "waxing crescent";
  if (midday < 0.5) return "waxing gibbous";
  if (midday < 0.75) return "waning gibbous";
  return "waning crescent";
}

/**
 * Readable phase + percent for a date, for captions. Pick which model to use.
 * Exported so a page can show text next to the dial.
 */
export function moonInfo(
  date: Date,
  model: ModelName = "accurate",
): { phaseName: string; litPercent: number } {
  const cyclePositionFor = MODELS[model];
  return {
    phaseName: phaseNameForDay(date, cyclePositionFor),
    litPercent: Math.round(litFractionFor(cyclePositionFor(date)) * 100),
  };
}

// ============================================================================
// Small number helpers
// ============================================================================

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Short date for tooltips, e.g. "Jun 22". */
const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Move a looping 0..1 value one step from `from` toward `to`, always taking the
 * SHORTER way around the loop. So a new moon at 0.98 glides forward past 1.0 to
 * 0.02 instead of rewinding all the way back through full moon.
 * `ease` is the fraction of the remaining gap to cover this frame (e.g. 0.12).
 */
function stepLooping(from: number, to: number, ease: number): number {
  let gap = to - from;
  if (gap > 0.5) gap -= 1;
  if (gap < -0.5) gap += 1;
  return (from + gap * ease + 1) % 1;
}

/** Shortest distance between two points on a 0..1 loop. */
function loopDistance(a: number, b: number): number {
  const gap = Math.abs(a - b) % 1;
  return Math.min(gap, 1 - gap);
}

// ============================================================================
// Layout + colours (all flat - no gradients)
// ============================================================================

const RING_FRAC = 0.4; // ring radius, as a fraction of the dial size
const FACE_FRAC = 0.24; // Moon radius, as a fraction of the dial size

const COLOR = {
  ringTrack: "rgba(255,255,255,0.08)", // the faint full-year circle
  ringFill: "rgba(255,255,255,0.22)", // the part of the year already passed
  monthTick: "rgba(255,255,255,0.16)", // the twelve month marks
  monthLabel: "rgba(255,255,255,0.35)", // the month names
  dateDot: "rgba(255,255,255,0.6)", // the marker on the selected date
  hoverDot: "rgba(255,255,255,0.95)", // the marker under the pointer
  yearText: "rgba(255,255,255,0.45)", // the year printed below the Moon
  faceEdge: "rgba(255,255,255,0.08)", // hairline around the Moon's rim
  moonLit: "#e8e9ec", // the lit part of the Moon
  moonDark: "#2e323b", // the part of the Moon in shadow
  tooltipBg: "rgba(0,0,0,0.65)",
  tooltipText: "rgba(255,255,255,0.92)",
};

// A point under the pointer on the ring, ready to draw as a tooltip.
type Hover = { fraction: number; label: string };

// ============================================================================
// Drawing
// ============================================================================

/**
 * Trace the outline of the LIT part of the Moon's face.
 *
 * The lit part is always one half-circle (the bright outer edge) joined to a
 * curved line down the middle: the line on the Moon between day and night.
 * As the month passes, that curved line sweeps across the face, taking us
 * crescent -> half -> full -> half -> crescent.
 */
function traceLitShape(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  cyclePosition: number,
) {
  // First half of the cycle the lit area is GROWING and sits on the right;
  // second half it is SHRINKING and sits on the left.
  const growing = cyclePosition < 0.5;

  // How far the curved middle line bulges sideways, from -radius to +radius.
  // It is 0 at the half-moons (a straight line) and at full width near new and
  // full moon.
  const curveWidth = radius * Math.cos(2 * Math.PI * cyclePosition);

  ctx.beginPath();
  ctx.moveTo(center, center - radius); // start at the top of the face
  if (growing) {
    ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(center, center, Math.abs(curveWidth), radius, 0,
      Math.PI / 2, -Math.PI / 2, curveWidth > 0);
  } else {
    ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, true);
    ctx.ellipse(center, center, Math.abs(curveWidth), radius, 0,
      Math.PI / 2, -Math.PI / 2, curveWidth < 0);
  }
  ctx.closePath();
}

/** Draw the Moon's face (flat two-tone). */
function drawFace(ctx: CanvasRenderingContext2D, size: number, cyclePosition: number) {
  const center = size / 2;
  const radius = size * FACE_FRAC;

  // Whole face in shadow colour first, so the unlit part stays visible.
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.moonDark;
  ctx.fill();

  // Lit part on top, in a flat light colour, clipped to the round face.
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();
  traceLitShape(ctx, center, radius, cyclePosition);
  ctx.fillStyle = COLOR.moonLit;
  ctx.fill();
  ctx.restore();

  // Hairline around the rim so the disc reads cleanly against the background.
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.faceEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Draw the year ring: month marks + labels, the progress arc, and dots. */
function drawRing(
  ctx: CanvasRenderingContext2D,
  size: number,
  yearFraction: number,
  year: number,
  hover: Hover | null,
) {
  const center = size / 2;
  const ringRadius = size * RING_FRAC;
  const top = -Math.PI / 2; // 12 o'clock is the start of the year

  // Angle on the ring for a 0..1 position around the year (clockwise from top).
  const angleAt = (fraction: number) => top + fraction * Math.PI * 2;
  const pointAt = (fraction: number, radius: number) => {
    const a = angleAt(fraction);
    return [center + Math.cos(a) * radius, center + Math.sin(a) * radius] as const;
  };

  // Faint full circle: the whole year.
  ctx.beginPath();
  ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.ringTrack;
  ctx.lineWidth = size * 0.008;
  ctx.stroke();

  // Month marks at the true start of each month, plus a short label outside.
  const yearStart = new Date(year, 0, 1).getTime();
  const yearLength = new Date(year + 1, 0, 1).getTime() - yearStart;
  ctx.font = `${size * 0.035}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let m = 0; m < 12; m++) {
    const start = (new Date(year, m, 1).getTime() - yearStart) / yearLength;
    const next = (new Date(year, m + 1, 1).getTime() - yearStart) / yearLength;

    const [ix, iy] = pointAt(start, ringRadius - size * 0.03);
    const [ox, oy] = pointAt(start, ringRadius);
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = COLOR.monthTick;
    ctx.lineWidth = size * 0.006;
    ctx.stroke();

    const [lx, ly] = pointAt((start + next) / 2, ringRadius + size * 0.05);
    ctx.fillStyle = COLOR.monthLabel;
    ctx.fillText(MONTHS[m], lx, ly);
  }

  // Brighter arc: the part of the year already passed, sweeping clockwise.
  ctx.beginPath();
  ctx.arc(center, center, ringRadius, top, angleAt(clamp01(yearFraction)));
  ctx.strokeStyle = COLOR.ringFill;
  ctx.lineWidth = size * 0.016;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineCap = "butt";

  // Dot marking the selected date.
  const [dx, dy] = pointAt(clamp01(yearFraction), ringRadius);
  ctx.beginPath();
  ctx.arc(dx, dy, size * 0.02, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.dateDot;
  ctx.fill();

  // Pointer marker + date tooltip, only while hovering the ring.
  if (hover) {
    const [hx, hy] = pointAt(hover.fraction, ringRadius);
    ctx.beginPath();
    ctx.arc(hx, hy, size * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.hoverDot;
    ctx.fill();

    const [tx, ty] = pointAt(hover.fraction, ringRadius - size * 0.12);
    ctx.font = `600 ${size * 0.05}px ui-sans-serif, system-ui, sans-serif`;
    const textWidth = ctx.measureText(hover.label).width;
    const padX = size * 0.03;
    const boxH = size * 0.07;
    ctx.fillStyle = COLOR.tooltipBg;
    ctx.beginPath();
    ctx.roundRect(tx - textWidth / 2 - padX, ty - boxH / 2, textWidth + padX * 2, boxH, size * 0.012);
    ctx.fill();
    ctx.fillStyle = COLOR.tooltipText;
    ctx.fillText(hover.label, tx, ty);
  }
}

/** Print the year below the Moon, so it's clear which year the ring is. */
function drawYearLabel(ctx: CanvasRenderingContext2D, size: number, year: number) {
  const center = size / 2;
  ctx.fillStyle = COLOR.yearText;
  ctx.font = `600 ${size * 0.06}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(year), center, center + size * 0.3);
}

/** Draw one whole frame. */
function paint(
  ctx: CanvasRenderingContext2D,
  size: number,
  cyclePosition: number,
  yearFraction: number,
  year: number,
  hover: Hover | null,
) {
  ctx.clearRect(0, 0, size, size);
  drawFace(ctx, size, cyclePosition);
  drawRing(ctx, size, yearFraction, year, hover);
  drawYearLabel(ctx, size, year);
}

// ============================================================================
// The shared dial (both components render through this)
// ============================================================================

interface MoonDialProps {
  date: Date;
  size: number;
  cyclePositionFor: (date: Date) => number;
  /** When given, the ring becomes interactive and reports the picked date. */
  onSelectDate?: (date: Date) => void;
}

function MoonDial({ date, size, cyclePositionFor, onSelectDate }: MoonDialProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameRef = useRef(0);
  const drawPendingRef = useRef(false);
  const hoverRef = useRef<Hover | null>(null);

  // Latest props as refs, so the (mount-only) draw loop and event handlers
  // always read current values without being torn down and rebuilt.
  const dateRef = useRef(date);
  dateRef.current = date;

  const target = {
    cyclePosition: cyclePositionFor(date),
    yearFraction: yearFractionFor(date),
    year: date.getFullYear(),
  };
  const targetRef = useRef(target);
  targetRef.current = target;

  // What is CURRENTLY on screen. Starts equal to the target so the first render
  // is correct and does NOT animate in. (Only the animated fields; year rides
  // along on the target.)
  const shownRef = useRef<{ cyclePosition: number; yearFraction: number }>(target);

  // One redraw, on demand. Many requests in a frame collapse into one. If the
  // Moon/arc are still gliding toward the target, it queues the next frame;
  // once arrived (and the pointer is still), it stops. So it idles completely.
  const requestDraw = useCallback(() => {
    if (drawPendingRef.current) return;
    drawPendingRef.current = true;
    frameRef.current = requestAnimationFrame(() => {
      drawPendingRef.current = false;
      const ctx = ctxRef.current;
      if (!ctx) return;

      const goal = targetRef.current;
      const shown = shownRef.current;
      const next = {
        cyclePosition: stepLooping(shown.cyclePosition, goal.cyclePosition, 0.12),
        yearFraction: stepLooping(shown.yearFraction, goal.yearFraction, 0.12),
      };
      const arrived =
        loopDistance(next.cyclePosition, goal.cyclePosition) < 0.0005 &&
        loopDistance(next.yearFraction, goal.yearFraction) < 0.0005;

      shownRef.current = arrived
        ? { cyclePosition: goal.cyclePosition, yearFraction: goal.yearFraction }
        : next;

      paint(ctx, size, shownRef.current.cyclePosition, shownRef.current.yearFraction,
        goal.year, hoverRef.current);

      if (!arrived) requestDraw(); // keep gliding
    });
  }, [size]);

  // Configure the canvas once (and again only if the size changes).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in plain CSS pixels
    ctxRef.current = ctx;
    requestDraw();

    return () => cancelAnimationFrame(frameRef.current);
  }, [size, requestDraw]);

  // Glide to the new date whenever it changes (snap if reduced motion).
  useEffect(() => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      shownRef.current = {
        cyclePosition: target.cyclePosition,
        yearFraction: target.yearFraction,
      };
    }
    requestDraw();
  }, [target.cyclePosition, target.yearFraction, target.year, requestDraw]);

  // ---- Pointer + keyboard, only when the ring is interactive --------------

  // Which day on the ring is under this pointer position? Returns null if the
  // pointer isn't over the ring band.
  const dateUnderPointer = useCallback(
    (clientX: number, clientY: number): { date: Date; fraction: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - size / 2;
      const y = clientY - rect.top - size / 2;

      const distance = Math.hypot(x, y);
      if (Math.abs(distance - size * RING_FRAC) > size * 0.1) return null;

      // Angle measured clockwise from the top (12 o'clock = start of year).
      let fraction = (Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2);
      fraction = ((fraction % 1) + 1) % 1;
      return { date: dateFromYearFraction(dateRef.current.getFullYear(), fraction), fraction };
    },
    [size],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      const hit = dateUnderPointer(e.clientX, e.clientY);
      hoverRef.current = hit ? { fraction: hit.fraction, label: shortDate(hit.date) } : null;
      requestDraw();
    },
    [dateUnderPointer, requestDraw],
  );

  const handleLeave = useCallback(() => {
    hoverRef.current = null;
    requestDraw();
  }, [requestDraw]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const hit = dateUnderPointer(e.clientX, e.clientY);
      if (hit) onSelectDate?.(hit.date);
    },
    [dateUnderPointer, onSelectDate],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const d = dateRef.current;
      onSelectDate?.(new Date(d.getFullYear(), d.getMonth(), d.getDate() + step));
    },
    [onSelectDate],
  );

  // ---- Accessibility ------------------------------------------------------

  const phaseName = phaseNameForDay(date, cyclePositionFor);
  const litPercent = Math.round(litFractionFor(cyclePositionFor(date)) * 100);
  const longDate = date.toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  if (!onSelectDate) {
    // Display-only: just an image of the Moon on this date.
    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Moon on ${longDate}: ${phaseName}, ${litPercent}% lit.`}
      />
    );
  }

  // Interactive: a circular slider over the days of the year.
  const yearStart = new Date(date.getFullYear(), 0, 1).getTime();
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86_400_000) + 1;
  const daysInYear = Math.round(
    (new Date(date.getFullYear() + 1, 0, 1).getTime() - yearStart) / 86_400_000,
  );

  return (
    <canvas
      ref={canvasRef}
      role="slider"
      tabIndex={0}
      aria-label="Day of year"
      aria-valuemin={1}
      aria-valuemax={daysInYear}
      aria-valuenow={dayOfYear}
      aria-valuetext={`${longDate} — ${phaseName}, ${litPercent}% lit`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
    />
  );
}

// ============================================================================
// The two public components
// ============================================================================

interface MoonCalendarProps {
  /** The date to show the Moon for. */
  date: Date;
  /** Width and height of the dial in pixels. */
  size?: number;
  /** Pass a handler to make the ring interactive (hover, click, arrow keys). */
  onSelectDate?: (date: Date) => void;
}

/** Simple "moon clock": constant 29.53-day cycle. Off by up to ~15 hours. */
export function MoonCalendarSimple({ date, size = 280, onSelectDate }: MoonCalendarProps) {
  return (
    <MoonDial date={date} size={size} cyclePositionFor={simpleCyclePosition} onSelectDate={onSelectDate} />
  );
}

/** Accurate: real Sun->Moon angle including the Moon's oval orbit. */
export function MoonCalendarAccurate({ date, size = 280, onSelectDate }: MoonCalendarProps) {
  return (
    <MoonDial date={date} size={size} cyclePositionFor={accurateCyclePosition} onSelectDate={onSelectDate} />
  );
}
