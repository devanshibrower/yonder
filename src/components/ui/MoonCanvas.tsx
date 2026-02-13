import { useEffect, useRef, useState } from "react";

//-----CONSTANTS (outside components and tokens that dont change)-------

//--colors for moon and markers
export const colors = {
  defaultMarkers: "#3f3f46", // zinc-700
  secondaryMarkers: "#71717a", // zinc-500
  primaryMarkers: "#e4e4e7", // zinc-200
  moonLight: "#f4f4f5", // zinc-100
  moonDark: "#27272a", // zinc-800
};

//--moon phases
const moonPhases = {
  newMoon: {
    side: "right",
    ellipseRadius: 50,
    carve: true,
  },
  waxingCrescent: {
    side: "right",
    ellipseRadius: 25,
    carve: true,
  },
  firstQuarter: {
    side: "right",
    ellipseRadius: 0,
    carve: false,
  },
  waxingGibbous: {
    side: "right",
    ellipseRadius: 25,
    carve: false,
  },
  fullMoon: {
    side: "right",
    ellipseRadius: 50,
    carve: false,
  },
  waningGibbous: {
    side: "left",
    ellipseRadius: 25,
    carve: false,
  },
  thirdQuarter: {
    side: "left",
    ellipseRadius: 0,
    carve: false,
  },
  waningCrescent: {
    side: "left",
    ellipseRadius: 25,
    carve: true,
  },
} as const;

//canvas consttants
const CANVAS_SIZE = 240;
const CENTER = CANVAS_SIZE / 2;
const MOON_RADIUS = 36;
const RING_RADIUS = 74;

//--Month start dates
const MonthStartDates = [
  1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366,
];

//month names
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

//-----Helper functions(outside components, reusable, no dependencies)-------

//--convert day of year to month and day string for tooltip
export function daytoDateString(day: number): string {
  //find which month this day falls in
  for (let i = 0; i < MonthStartDates.length; i++) {
    if (day < MonthStartDates[i + 1]) {
      const dayOfMonth = day - MonthStartDates[i] + 1;
      return `${monthNames[i]} ${dayOfMonth}`;
    }
  }
  return "";
}

//--draw moon function, takes in canvas context and moon parameters to draw the moon phase
export function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number, //center x
  cy: number, //center y
  radius: number, //moon radius
  side: "right" | "left",
  ellipseRadius: number,
  carve: boolean,
  opacity = 1, // opacity for hovered moon phase
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  //dark base
  ctx.fillStyle = colors.moonDark;
  ctx.fill();
  //lit half
  ctx.beginPath();
  if (side === "right") {
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = colors.moonLight;
    ctx.fill();
  } else {
    ctx.arc(cx, cy, radius, Math.PI / 2, -Math.PI / 2);
    ctx.fillStyle = colors.moonLight;
    ctx.fill();
  }
  ctx.beginPath();
  if (carve) {
    ctx.ellipse(cx, cy, ellipseRadius, radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.moonDark;
    ctx.fill();
  } else {
    ctx.ellipse(cx, cy, ellipseRadius, radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.moonLight;
    ctx.fill();
  }
  ctx.restore();
}

//--calculate moon phase based on day of year, using a simple 29.5 day lunar cycle approximation, returns 0-1 where 0=new moon and 0.5=full moon
function getMoonPhase(
  dayOfYear: number,
  year: number = 2026,
): number {
  //known new moon: January 29, 2025
  const knownNewMoon = new Date(2025, 0, 29); // month is 0-indexed
  const targetDate = new Date(year, 0, 1); // start of target year
  targetDate.setDate(dayOfYear);

  const daysSince =
    (targetDate.getTime() - knownNewMoon.getTime()) /
    (1000 * 60 * 60 * 24);
  const lunarCycle = 29.5;
  let phase = (daysSince % lunarCycle) / lunarCycle;
  if (phase < 0) phase += 1; // ensure phase is between 0 and 1
  return phase;
}

function getPhaseName(phase: number): keyof typeof moonPhases {
  if (phase < 0.125) {
    return "newMoon";
  } else if (phase < 0.25) {
    return "waxingCrescent";
  } else if (phase < 0.375) {
    return "firstQuarter";
  } else if (phase < 0.5) {
    return "waxingGibbous";
  } else if (phase < 0.625) {
    return "fullMoon";
  } else if (phase < 0.75) {
    return "waningGibbous";
  } else if (phase < 0.875) {
    return "thirdQuarter";
  } else {
    return "waningCrescent";
  }
}

function formatPhaseName(phaseName: string): string {
  return phaseName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getIllumination(phase: number): number {
  return 1 - Math.abs(2 * phase - 1);
}

function parseDateInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try "Mon DD" or "Month DD" format
  const monthMatch = trimmed.match(/^([a-zA-Z]+)\s*(\d{1,2})$/);
  if (monthMatch) {
    const monthStr = monthMatch[1].toLowerCase().slice(0, 3);
    const dayNum = parseInt(monthMatch[2], 10);
    const monthIdx = monthNames.findIndex(
      (m) => m.toLowerCase() === monthStr,
    );
    if (monthIdx !== -1 && dayNum >= 1) {
      const dayOfYear = MonthStartDates[monthIdx] + dayNum - 1;
      if (
        dayOfYear < MonthStartDates[monthIdx + 1] &&
        dayOfYear <= 365
      )
        return dayOfYear;
    }
    return null;
  }

  // Try "M/D" or "M-D" format
  const slashMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})$/);
  if (slashMatch) {
    const monthIdx = parseInt(slashMatch[1], 10) - 1;
    const dayNum = parseInt(slashMatch[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && dayNum >= 1) {
      const dayOfYear = MonthStartDates[monthIdx] + dayNum - 1;
      if (
        dayOfYear < MonthStartDates[monthIdx + 1] &&
        dayOfYear <= 365
      )
        return dayOfYear;
    }
    return null;
  }

  return null;
}

//-----------------------------------MAIN FUNCTION------------------------------------------

export default function LunarCalendar() {
  //------------------------REFS AND STATE----------------------------------------

  //<htmlcanvaselement> is declaring the type of element this ref is pointing to.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diffInMs = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffInMs / (1000 * 60 * 60 * 24) + 1);

  const [selectedDay, setSelectedDay] = useState<number>(dayOfYear);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hasError, setHasError] = useState(false);

  // Animation refs
  const animatedPhaseRef = useRef<number>(getMoonPhase(dayOfYear));
  const targetPhaseRef = useRef<number>(getMoonPhase(dayOfYear));
  const animatedArcRef = useRef<number>(dayOfYear);
  const rafRef = useRef<number>(0);
  const selectedDayRef = useRef<number>(dayOfYear);
  selectedDayRef.current = selectedDay;
  const hoveredDayRef = useRef<number | null>(null);
  hoveredDayRef.current = hoveredDay;

  //------------------------EFFECTS----------------------------------------

  // Effect A — Update target phase when display day changes
  useEffect(() => {
    const displayDay = hoveredDay ?? selectedDay;
    targetPhaseRef.current = getMoonPhase(displayDay);
  }, [hoveredDay, selectedDay]);

  // Effect B — Event listeners (mount only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - canvasRect.left - CENTER;
      const mouseY = event.clientY - canvasRect.top - CENTER;

      let mouseAngle = Math.atan2(mouseY, mouseX);
      mouseAngle = mouseAngle + Math.PI / 2;
      if (mouseAngle < 0) mouseAngle += Math.PI * 2;
      const rawDay =
        Math.round((mouseAngle / (Math.PI * 2)) * 365) + 1;
      const day = rawDay > 365 ? 1 : rawDay;
      setHoveredDay(day);
    };

    const handleClick = (event: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - canvasRect.left - CENTER;
      const mouseY = event.clientY - canvasRect.top - CENTER;
      let mouseAngle = Math.atan2(mouseY, mouseX);
      mouseAngle = mouseAngle + Math.PI / 2;
      if (mouseAngle < 0) mouseAngle += Math.PI * 2;
      const rawDay =
        Math.round((mouseAngle / (Math.PI * 2)) * 365) + 1;
      const clickedDay = rawDay > 365 ? 1 : rawDay;
      setSelectedDay(clickedDay);
      canvas.focus();
    };

    const handleMouseLeave = () => setHoveredDay(null);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
    };
  }, []);

  // Effect C — RAF animation loop (mount only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // DPR setup once
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const target = targetPhaseRef.current;
      let current = animatedPhaseRef.current;

      // Lerp with shortest-path wrapping (phase is cyclic 0-1)
      let diff = target - current;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      current += diff * 0.12;
      // Wrap back to 0-1 range
      if (current < 0) current += 1;
      if (current >= 1) current -= 1;
      animatedPhaseRef.current = current;

      // Lerp the progress arc toward selected day
      const arcTarget = selectedDayRef.current;
      animatedArcRef.current +=
        (arcTarget - animatedArcRef.current) * 0.12;

      // Read refs for instant values
      const hovered = hoveredDayRef.current;
      const animatedArc = animatedArcRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw moon using animated phase
      const illumination = Math.cos(current * 2 * Math.PI);
      const smoothEllipseRadius =
        Math.abs(illumination) * MOON_RADIUS;
      const side = current <= 0.5 ? "right" : "left";
      const carve = illumination > 0;

      drawMoon(
        ctx,
        CENTER,
        CENTER,
        MOON_RADIUS,
        side,
        smoothEllipseRadius,
        carve,
      );

      // Draw base track ring
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RING_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(75, 75, 75, 0.2)";
      ctx.lineWidth = 12;
      ctx.stroke();

      // Draw progress arc on top (animated)
      ctx.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle =
        -Math.PI / 2 + (animatedArc / 365) * Math.PI * 2;
      ctx.arc(CENTER, CENTER, RING_RADIUS, startAngle, endAngle);
      ctx.strokeStyle = "rgba(244, 244, 245, 0.15)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();

      // Markers on outer ring
      const arcDay = Math.round(animatedArc);
      for (let day = 1; day <= 365; day++) {
        const isHovered = day === hovered;
        const isMonthStart = MonthStartDates.includes(day);
        const isInProgress = day <= arcDay;
        const tickInner = isMonthStart
          ? RING_RADIUS - 4
          : RING_RADIUS - 2;
        const tickOuter = isMonthStart
          ? RING_RADIUS + 4
          : RING_RADIUS + 2;

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
        ctx.strokeStyle = isHovered
          ? colors.primaryMarkers
          : isInProgress
            ? colors.primaryMarkers
            : isMonthStart
              ? colors.secondaryMarkers
              : colors.defaultMarkers;
        ctx.stroke();
      }

      // Draw month labels
      ctx.font = "8px sans-serif";
      ctx.fillStyle = colors.secondaryMarkers;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      monthNames.forEach((name, i) => {
        const midDay =
          (MonthStartDates[i] + MonthStartDates[i + 1]) / 2;
        const angle =
          -Math.PI / 2 + ((midDay - 1) / 365) * Math.PI * 2;
        const labelRadius = RING_RADIUS + 18;
        const x = CENTER + Math.cos(angle) * labelRadius;
        const y = CENTER + Math.sin(angle) * labelRadius;
        ctx.fillText(name.toUpperCase(), x, y);
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const displayDay = hoveredDay ?? selectedDay;
  const displayPhase = getMoonPhase(displayDay);
  const displayPhaseName = formatPhaseName(
    getPhaseName(displayPhase),
  );

  return (
    <div className="flex flex-col items-center gap-0">
      <div className="relative flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          tabIndex={0}
          className="outline-none"
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
        />
      </div>
      <div className="text-center">
        <input
          ref={inputRef}
          value={isEditing ? inputValue : daytoDateString(displayDay)}
          readOnly={!isEditing}
          onFocus={() => {
            setInputValue(daytoDateString(displayDay));
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
                setInputValue(daytoDateString(next));
                return next;
              });
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedDay((d) => {
                const next = d <= 1 ? 365 : d - 1;
                setInputValue(daytoDateString(next));
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
          className={`w-24 border-0 bg-transparent text-center font-sans text-xs outline-none ${
            hasError ? "text-red-500" : "text-zinc-200"
          } ${isEditing ? "border-b border-zinc-600" : "border-b border-transparent"}`}
        />
        <div className="font-sans text-xs text-zinc-500">
          {displayPhaseName} ·{" "}
          {Math.round(getIllumination(displayPhase) * 100)}%
        </div>
        <div className="font-sans text-[10px] text-zinc-600">
          ↑↓ to navigate days
        </div>
        <button
          onClick={() => setSelectedDay(dayOfYear)}
          disabled={selectedDay === dayOfYear}
          className={`mt-2 rounded-full border px-3 py-0.5 font-sans text-[10px] tracking-wide transition-all duration-300 ${
            selectedDay === dayOfYear
              ? "cursor-default border-transparent opacity-0"
              : "cursor-pointer border-zinc-700/50 text-zinc-500 opacity-100 hover:border-zinc-500/60 hover:text-zinc-300 hover:shadow-[0_0_8px_rgba(244,244,245,0.06)]"
          }`}
        >
          Today
        </button>
      </div>
    </div>
  );
}
