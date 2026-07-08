"use client";

import { useState, useRef, useEffect } from "react";
import * as SunCalc from "suncalc";
import { DateField } from "@/components/ui/DateField";

const CanvasSize = 320;

/**
 * Draw the Moon's face for a given phase onto the canvas.
 *
 * `phase` (0..1, from suncalc): 0 = new, 0.25 = first quarter, 0.5 = full,
 * 0.75 = last quarter, then back around to 1 = new.
 *
 * The lit shape is always a bright half-circle (the sunlit rim of the moon) joined
 * to a half-ellipse (the day/night line). Two SEPARATE decisions shape it; keeping
 * them apart is the key to reading this:
 *
 * 1. HOW WIDE the day/night line is = |cos(2π·phase)| · radius.
 *    Why cosine: across the cycle cos runs 1 -> 0 -> 1, which is exactly how the line
 *    behaves — a straight line (width 0) at the quarters, widest near new and full.
 *
 * 2. WHICH SIDE the lit part is on, and its shape, come from TWO independent things:
 *    - waxing vs waning -> the absolute side, LEFT or RIGHT.
 *      Why: a waxing (growing) moon is lit on the right, a waning one on the left.
 *    - the SIGN (+/-) of the cosine -> CRESCENT vs GIBBOUS (this is not left/right).
 *      Why: a positive cosine bulges the line toward the lit rim, squeezing the lit
 *      part into a thin sliver (crescent); a negative cosine bulges it away, leaving
 *      most of the face lit (gibbous).
 */
function drawMoonFace(ctx: CanvasRenderingContext2D, phase: number) {
  const center = CanvasSize / 2;
  const radius = CanvasSize / 4; // inner quarter; outer half is reserved for the year ring

  const moonDark = "#2e323b"; // dark side of the moon
  const moonLight = "#e8e9ec"; // lit side of the moon

  // Clear the canvas
  ctx.clearRect(0, 0, CanvasSize, CanvasSize);

  // Draw the plain dark moon circle first, so the unlit part always shows underneath.
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, 2 * Math.PI);
  ctx.fillStyle = moonDark;
  ctx.fill();

  // Clip any future shapes to the moon circle, so the lit shape can't spill past the edge.
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, 2 * Math.PI);
  ctx.clip();

  // Waxing (growing) is lit on the right; waning (shrinking) is lit on the left.
  const waxing = phase < 0.5;

  // How wide the curved day/night line is. At the quarters it becomes 0 (a straight line);
  // near new / full it becomes wide (crescents / gibbous). Signed: the sign is the bulge side.
  const ellipseRadius = radius * Math.cos(2 * Math.PI * phase);

  // Trace the lit shape: a bright half-circle joined to the day/night half-ellipse.
  // Both phases share the same angles; only two booleans differ:
  //   - the arc's last arg flips which half-circle we get (right for waxing, left for waning)
  //   - the ellipse's last arg flips which way the day/night line bulges
  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, !waxing);
  ctx.ellipse(
    center,
    center,
    Math.abs(ellipseRadius), // width of the ellipse (a radius can't be negative)
    radius,
    0,
    Math.PI / 2,
    -Math.PI / 2,
    waxing ? ellipseRadius > 0 : ellipseRadius < 0, // sign picks the bulge side: toward lit = crescent, away = gibbous
  );
  ctx.closePath();

  ctx.fillStyle = moonLight;
  ctx.fill();

  ctx.restore(); // undo the clip
}

export default function MoonDial() {
  const [date, setDate] = useState(() => new Date());

  // A box that will hold the canvas once it renders. We will use this ref to get the canvas node and draw on it.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  //suncalc returns an object with the moon illumination data for the given date. we will get:
  // Illumination -> how much of moon face is lit 0 (new moon) to 1 (full moon)
  //Phase -> where we are in the moon cycle 0 (new moon), 0.5(full moon), 1 (new moon again)

  //desctiption for my understanding: Both are 0 to 1, not 0 to 100. They're fractions, not percents. We multiply by 100 only when we show a percent to a human.
  // Here's why illumination alone is not enough, and why we need phase: illumination is ambiguous about direction.
  // A half-lit moon reads illumination = 0.5 whether it's first quarter (waxing, lit on the right) or last quarter (waning, lit on the left).
  // illumination can't tell those apart. phase can, because 0.25 and 0.75 are different points on its one-way loop.
  // So phase is what will tell us which side to paint and whether the moon is growing or shrinking. illumination just tells us how much.

  //I like the term illumination better than fraction (which we get from SunCalc), so we will rename it to illumination.
  const { fraction: illumination, phase } =
    SunCalc.getMoonIllumination(date);

  // Describe the moon for screen readers, which can't see the canvas. This is the same
  // information a sighted person gets from the shape: the date, how lit it is, and whether
  // it's growing or shrinking.
  const longDate = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const moonLabel = `Moon on ${longDate}: ${Math.round(
    illumination * 100,
  )}% lit, ${phase < 0.5 ? "waxing" : "waning"}.`;

  //draw after react has put canvas on page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Make the canvas sharp on high-density (retina) screens. We enlarge the backing
    // store (canvas.width/height) by the device pixel ratio, but keep the display size
    // fixed (canvas.style), then scale the context so drawing still uses CSS pixels.
    // Why here / in this order: setting canvas.width RESETS the context (clears it and
    // wipes any transform), so it must happen before ctx.scale and before we draw.
    const dpr = window.devicePixelRatio || 1; // ~2 on retina, 1 on a normal screen
    canvas.width = CanvasSize * dpr;
    canvas.height = CanvasSize * dpr;
    canvas.style.width = `${CanvasSize}px`;
    canvas.style.height = `${CanvasSize}px`;
    ctx.scale(dpr, dpr);

    drawMoonFace(ctx, phase);
  }, [phase]); //redraw when phase changes

  return (
    <div>
      {/* DateField is our controlled date primitive. MoonDial (parent) owns the
          date and passes it down as `value`; DateField reports edits up via
          `onChange`. We ignore a cleared (null) date since the dial always needs
          one, keeping the last date instead. */}
      <DateField
        value={date}
        onChange={(next) => {
          if (next) setDate(next);
        }}
      />
      <canvas
        ref={canvasRef}
        width={CanvasSize}
        height={CanvasSize}
        role="img"
        aria-label={moonLabel}
      />
      <p>Illumination: {(illumination * 100).toFixed(2)}%</p>
      <p>Phase: {phase.toFixed(2)}</p>
    </div>
  );
}
