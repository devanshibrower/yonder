"use client";

import { useEffect, useRef, useState } from "react";

// --- CONSTANTS ---

const CANVAS_SIZE = 300;
const CENTER = CANVAS_SIZE / 2;
const MOON_RADIUS = 45;
const RING_RADIUS = 92;

const colors = {
  defaultMarkers: "#3f3f46",
  secondaryMarkers: "#71717a",
  primaryMarkers: "#e4e4e7",
  progressArc: "rgba(244, 244, 245, 0.15)",
  trackRing: "rgba(75, 75, 75, 0.2)",
  moonLight: "#f4f4f5",
  moonDark: "#27272a",
};

const MonthStartDates = [
  1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366,
];

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// --- HELPER FUNCTIONS ---

function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  side: "right" | "left",
  ellipseRadius: number,
  carve: boolean,
  opacity = 1,
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = colors.moonDark;
  ctx.fill();
  ctx.beginPath();
  if (side === "right") {
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
  } else {
    ctx.arc(cx, cy, radius, Math.PI / 2, -Math.PI / 2);
  }
  ctx.fillStyle = colors.moonLight;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, ellipseRadius, radius, 0, 0, Math.PI * 2);
  ctx.fillStyle = carve ? colors.moonDark : colors.moonLight;
  ctx.fill();
  ctx.restore();
}

function getMoonPhase(
  dayOfYear: number,
  year: number = 2026,
): number {
  const knownNewMoon = new Date(2025, 0, 29);
  const targetDate = new Date(year, 0, 1);
  targetDate.setDate(dayOfYear);
  const daysSince =
    (targetDate.getTime() - knownNewMoon.getTime()) /
    (1000 * 60 * 60 * 24);
  const lunarCycle = 29.5;
  let phase = (daysSince % lunarCycle) / lunarCycle;
  if (phase < 0) phase += 1;
  return phase;
}

function dayToDateString(day: number): string {
  for (let i = 0; i < MonthStartDates.length - 1; i++) {
    if (day < MonthStartDates[i + 1]) {
      return `${monthNames[i]} ${day - MonthStartDates[i] + 1}`;
    }
  }
  return "";
}

function parseDateInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const monthMatch = trimmed.match(/^([a-zA-Z]+)\s*(\d{1,2})$/);
  if (monthMatch) {
    const monthStr = monthMatch[1].toLowerCase().slice(0, 3);
    const dayNum = parseInt(monthMatch[2], 10);
    const monthIdx = monthNames.findIndex(
      (m) => m.toLowerCase() === monthStr,
    );
    if (monthIdx !== -1 && dayNum >= 1) {
      const d = MonthStartDates[monthIdx] + dayNum - 1;
      if (d < MonthStartDates[monthIdx + 1] && d <= 365) return d;
    }
    return null;
  }
  const slashMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})$/);
  if (slashMatch) {
    const monthIdx = parseInt(slashMatch[1], 10) - 1;
    const dayNum = parseInt(slashMatch[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && dayNum >= 1) {
      const d = MonthStartDates[monthIdx] + dayNum - 1;
      if (d < MonthStartDates[monthIdx + 1] && d <= 365) return d;
    }
    return null;
  }
  return null;
}

function getPhaseName(phase: number): string {
  if (phase < 0.125) return "newMoon";
  if (phase < 0.25) return "waxingCrescent";
  if (phase < 0.375) return "firstQuarter";
  if (phase < 0.5) return "waxingGibbous";
  if (phase < 0.625) return "fullMoon";
  if (phase < 0.75) return "waningGibbous";
  if (phase < 0.875) return "thirdQuarter";
  return "waningCrescent";
}

function formatPhaseName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getIllumination(phase: number): number {
  return 1 - Math.abs(2 * phase - 1);
}

// --- COMPONENT ---

export default function LunarCalendar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) +
      1,
  );

  const [selectedDay, setSelectedDay] = useState(dayOfYear);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hasError, setHasError] = useState(false);

  const animatedArcRef = useRef(dayOfYear);
  const animatedPhaseRef = useRef(getMoonPhase(dayOfYear));

  // --- ANIMATION LOOP ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    let rafId: number;

    const displayDay = hoveredDay ?? selectedDay;
    const targetPhase = getMoonPhase(displayDay);

    function draw() {
      let arcDiff = selectedDay - animatedArcRef.current;
      if (arcDiff > 182.5) arcDiff -= 365;
      if (arcDiff < -182.5) arcDiff += 365;
      animatedArcRef.current += arcDiff * 0.12;
      if (animatedArcRef.current > 365) animatedArcRef.current -= 365;
      if (animatedArcRef.current < 1) animatedArcRef.current += 365;

      let phaseDiff = targetPhase - animatedPhaseRef.current;
      if (phaseDiff > 0.5) phaseDiff -= 1;
      if (phaseDiff < -0.5) phaseDiff += 1;
      animatedPhaseRef.current += phaseDiff * 0.12;
      if (animatedPhaseRef.current < 0) animatedPhaseRef.current += 1;
      if (animatedPhaseRef.current >= 1)
        animatedPhaseRef.current -= 1;

      const isAnimating =
        Math.abs(arcDiff) > 0.5 || Math.abs(phaseDiff) > 0.005;

      const illumination = Math.cos(
        animatedPhaseRef.current * 2 * Math.PI,
      );
      const smoothEllipseRadius =
        Math.abs(illumination) * MOON_RADIUS;
      const side = animatedPhaseRef.current <= 0.5 ? "right" : "left";
      const carve = illumination > 0;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      drawMoon(
        ctx,
        CENTER,
        CENTER,
        MOON_RADIUS,
        side,
        smoothEllipseRadius,
        carve,
      );

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RING_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = colors.trackRing;
      ctx.lineWidth = 12;
      ctx.stroke();

      const startAngle = -Math.PI / 2;
      const endAngle =
        -Math.PI / 2 +
        ((animatedArcRef.current - 1) / 365) * (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RING_RADIUS, startAngle, endAngle);
      ctx.strokeStyle = colors.progressArc;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      const arcDay = Math.round(animatedArcRef.current);
      for (let day = 1; day <= 365; day++) {
        const isMonthStart = MonthStartDates.includes(day);
        const isInProgress = day <= arcDay;
        const tickInner = isMonthStart
          ? RING_RADIUS - 5
          : RING_RADIUS - 3;
        const tickOuter = isMonthStart
          ? RING_RADIUS + 5
          : RING_RADIUS + 3;

        const angle =
          -Math.PI / 2 + ((day - 1) / 365) * (Math.PI * 2);

        const innerX = CENTER + Math.cos(angle) * tickInner;
        const innerY = CENTER + Math.sin(angle) * tickInner;
        const outerX = CENTER + Math.cos(angle) * tickOuter;
        const outerY = CENTER + Math.sin(angle) * tickOuter;

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle =
          day === hoveredDay || day === selectedDay
            ? colors.primaryMarkers
            : isInProgress
              ? colors.primaryMarkers
              : isMonthStart
                ? colors.secondaryMarkers
                : colors.defaultMarkers;
        ctx.stroke();
      }

      ctx.font = "9px sans-serif";
      ctx.fillStyle = colors.secondaryMarkers;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      monthNames.forEach((name, i) => {
        const midDay =
          (MonthStartDates[i] + MonthStartDates[i + 1]) / 2;
        const angle =
          -Math.PI / 2 + ((midDay - 1) / 365) * Math.PI * 2;
        const labelRadius = RING_RADIUS + 22;
        const x = CENTER + Math.cos(angle) * labelRadius;
        const y = CENTER + Math.sin(angle) * labelRadius;
        ctx.fillText(name.toUpperCase(), x, y);
      });

      if (isAnimating) {
        rafId = requestAnimationFrame(draw);
      }
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [selectedDay, hoveredDay]);

  // --- DERIVED VALUES ---

  const displayDay = hoveredDay ?? selectedDay;
  const displayPhase = getMoonPhase(displayDay);
  const isOnToday = selectedDay === dayOfYear;

  // --- RETURN ---

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center">
        <canvas
          tabIndex={0}
          className="outline-none"
          style={{ cursor: hoveredDay ? "pointer" : "default" }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              setHoveredDay(null);
              setSelectedDay((d) => (d >= 365 ? 1 : d + 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              setHoveredDay(null);
              setSelectedDay((d) => (d <= 1 ? 365 : d - 1));
            }
          }}
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left - CENTER;
            const y = e.clientY - rect.top - CENTER;
            const dist = Math.sqrt(x * x + y * y);
            if (dist < RING_RADIUS - 14 || dist > RING_RADIUS + 14) {
              setHoveredDay(null);
              return;
            }
            let angle = Math.atan2(y, x);
            angle += Math.PI / 2;
            if (angle < 0) angle += Math.PI * 2;
            const day = Math.round((angle / (Math.PI * 2)) * 365) + 1;
            setHoveredDay(Math.min(day, 365));
          }}
          onMouseLeave={() => setHoveredDay(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left - CENTER;
            const y = e.clientY - rect.top - CENTER;
            const dist = Math.sqrt(x * x + y * y);
            if (dist < RING_RADIUS - 14 || dist > RING_RADIUS + 14)
              return;
            let angle = Math.atan2(y, x);
            angle += Math.PI / 2;
            if (angle < 0) angle += Math.PI * 2;
            const day = Math.round((angle / (Math.PI * 2)) * 365) + 1;
            setSelectedDay(Math.min(day, 365));
          }}
        />

        {/* Tier 1: Date — hero, largest, brightest */}
        <input
          ref={inputRef}
          value={isEditing ? inputValue : dayToDateString(displayDay)}
          readOnly={!isEditing}
          onFocus={() => {
            setInputValue(dayToDateString(displayDay));
            setIsEditing(true);
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          onChange={(e) => {
            setInputValue(e.target.value);
            setHasError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedDay((d) => {
                const next = d >= 365 ? 1 : d + 1;
                setInputValue(dayToDateString(next));
                return next;
              });
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedDay((d) => {
                const next = d <= 1 ? 365 : d - 1;
                setInputValue(dayToDateString(next));
                return next;
              });
            } else if (e.key === "Enter") {
              const parsed = parseDateInput(inputValue);
              if (parsed) {
                setSelectedDay(parsed);
                setIsEditing(false);
                setHasError(false);
                inputRef.current?.blur();
              } else {
                setHasError(true);
              }
            } else if (e.key === "Escape") {
              setIsEditing(false);
              setHasError(false);
              inputRef.current?.blur();
            }
          }}
          onBlur={() => {
            if (isEditing) {
              const parsed = parseDateInput(inputValue);
              if (parsed) setSelectedDay(parsed);
              setIsEditing(false);
              setHasError(false);
            }
          }}
          placeholder="Mar 15 or 3/15"
          className={`mt-0.5 w-20 rounded-md border px-1 py-1 text-center font-sans text-lg font-semibold tracking-tight transition-all duration-150 outline-none ${
            hasError ? "text-red-500" : "text-zinc-100"
          } ${
            isEditing
              ? "border-zinc-600 bg-zinc-800/50"
              : "cursor-pointer border-transparent bg-transparent hover:bg-zinc-800/40"
          }`}
        />

        {/* Tier 2: Phase + illumination */}
        <div className="mt-1 cursor-default font-sans text-xs text-zinc-500 select-none">
          {formatPhaseName(getPhaseName(displayPhase))}
          {" · "}
          {Math.round(getIllumination(displayPhase) * 100)}%
          illuminated
        </div>

        {/* Tier 3: Today button */}
        <button
          onClick={() => setSelectedDay(dayOfYear)}
          disabled={isOnToday}
          className={`mt-3 rounded-md border px-3 py-1 font-sans text-xs transition-all duration-150 ${
            isOnToday
              ? "cursor-default border-zinc-700/50 text-zinc-200"
              : "cursor-pointer border-zinc-700/50 text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
          }`}
        >
          Today
        </button>
      </div>
    </div>
  );
}
