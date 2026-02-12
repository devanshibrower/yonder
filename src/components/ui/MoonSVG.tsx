import { useState, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────

const LUNAR_CYCLE = 29.5;
const KNOWN_NEW_MOON = new Date(2025, 0, 29);

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
const monthStartDays = [
  1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366,
];

function getTodayDayOfYear(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return (
    Math.floor(
      (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function dayToDateString(day: number): string {
  for (let i = 0; i < monthStartDays.length - 1; i++) {
    if (day < monthStartDays[i + 1]) {
      return `${monthNames[i]} ${day - monthStartDays[i] + 1}`;
    }
  }
  return "";
}

function getMoonPhase(
  dayOfYear: number,
  year: number = 2026,
): number {
  const target = new Date(year, 0, 1);
  target.setDate(dayOfYear);
  const daysSince =
    (target.getTime() - KNOWN_NEW_MOON.getTime()) /
    (1000 * 60 * 60 * 24);
  let phase = (daysSince % LUNAR_CYCLE) / LUNAR_CYCLE;
  if (phase < 0) phase += 1;
  return phase;
}

function getIllumination(phase: number): number {
  return 1 - Math.abs(2 * phase - 1);
}

function getPhaseName(phase: number): string {
  if (phase < 0.0625) return "New Moon";
  if (phase < 0.1875) return "Waxing Crescent";
  if (phase < 0.3125) return "First Quarter";
  if (phase < 0.4375) return "Waxing Gibbous";
  if (phase < 0.5625) return "Full Moon";
  if (phase < 0.6875) return "Waning Gibbous";
  if (phase < 0.8125) return "Last Quarter";
  if (phase < 0.9375) return "Waning Crescent";
  return "New Moon";
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
      const dayOfYear = monthStartDays[monthIdx] + dayNum - 1;
      if (dayOfYear < monthStartDays[monthIdx + 1] && dayOfYear <= 365)
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
      const dayOfYear = monthStartDays[monthIdx] + dayNum - 1;
      if (dayOfYear < monthStartDays[monthIdx + 1] && dayOfYear <= 365)
        return dayOfYear;
    }
    return null;
  }

  return null;
}

// ─── Moon SVG Component ───────────────────────────────────────

function Moon({
  phase,
  cx,
  cy,
  r,
}: {
  phase: number;
  cx: number;
  cy: number;
  r: number;
}) {
  const illumination = Math.cos(phase * 2 * Math.PI);
  const terminatorRx = Math.abs(illumination) * r;

  const darkColor = "#27272a";
  const lightColor = "#f4f4f5";

  return (
    <g>
      <defs>
        <clipPath id="moonClip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <filter id="soften">
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
      </defs>

      {/* Dark base */}
      <circle cx={cx} cy={cy} r={r} fill={darkColor} stroke="#3f3f46" strokeWidth="1" />

      <g clipPath="url(#moonClip)">
        {phase <= 0.5 ? (
          <>
            <path
              d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`}
              fill={lightColor}
            />
            {terminatorRx > 0.5 && (
              <ellipse
                cx={cx}
                cy={cy}
                rx={terminatorRx}
                ry={r}
                fill={illumination >= 0 ? darkColor : lightColor}
                filter="url(#soften)"
              />
            )}
          </>
        ) : (
          <>
            <path
              d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`}
              fill={lightColor}
            />
            {terminatorRx > 0.5 && (
              <ellipse
                cx={cx}
                cy={cy}
                rx={terminatorRx}
                ry={r}
                fill={illumination >= 0 ? darkColor : lightColor}
                filter="url(#soften)"
              />
            )}
          </>
        )}
      </g>
    </g>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function LunarCalendarSVG() {
  const [today] = useState(getTodayDayOfYear);
  const [selectedDay, setSelectedDay] = useState(getTodayDayOfYear);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const SIZE = 260;
  const CENTER = SIZE / 2;
  const RING_R = 80;
  const MOON_SIZE = 64;

  const displayDay = hoveredDay ?? selectedDay;
  const displayPhase = getMoonPhase(displayDay);

  // Generate marker data
  const markers = [];
  for (let day = 1; day <= 365; day++) {
    const angle = -Math.PI / 2 + ((day - 1) / 365) * Math.PI * 2;
    const isMonth = monthStartDays.includes(day);
    const isHovered = day === hoveredDay;
    const inProgress = day <= selectedDay;

    const inner = isMonth ? RING_R - 5 : RING_R - 2;
    const outer = isMonth ? RING_R + 5 : RING_R + 2;

    markers.push({
      day,
      x1: CENTER + Math.cos(angle) * inner,
      y1: CENTER + Math.sin(angle) * inner,
      x2: CENTER + Math.cos(angle) * outer,
      y2: CENTER + Math.sin(angle) * outer,
      isMonth,
      isHovered,
      inProgress,
    });
  }

  // Progress arc path
  const getProgressArc = () => {
    if (selectedDay <= 1) return null;
    const startA = -Math.PI / 2;
    const endA = startA + (selectedDay / 365) * Math.PI * 2;
    const largeArc = selectedDay > 182 ? 1 : 0;
    const sx = CENTER + Math.cos(startA) * RING_R;
    const sy = CENTER + Math.sin(startA) * RING_R;
    const ex = CENTER + Math.cos(endA) * RING_R;
    const ey = CENTER + Math.sin(endA) * RING_R;
    return `M ${sx} ${sy} A ${RING_R} ${RING_R} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  // Get day from mouse position
  function getDay(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - CENTER;
    const my = e.clientY - rect.top - CENTER;
    let a = Math.atan2(my, mx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    return Math.min(
      365,
      Math.max(1, Math.round((a / (Math.PI * 2)) * 365) + 1),
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="cursor-pointer"
        onMouseMove={(e) => setHoveredDay(getDay(e))}
        onMouseLeave={() => setHoveredDay(null)}
        onClick={(e) => setSelectedDay(getDay(e))}
      >
        {/* Base track ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_R}
          fill="none"
          stroke="rgba(75, 75, 75, 0.2)"
          strokeWidth="10"
        />

        {/* Progress arc */}
        {getProgressArc() && (
          <path
            d={getProgressArc()!}
            fill="none"
            stroke="rgba(249, 115, 22, 0.3)"
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}

        {/* Day markers */}
        {markers.map((m) => (
          <line
            key={m.day}
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            stroke={
              m.isHovered
                ? "#f97316"
                : m.inProgress
                  ? "orange"
                  : m.isMonth
                    ? "#EBEBEF"
                    : "#3f3f46"
            }
            strokeWidth={0.5}
          />
        ))}

        {/* Month labels */}
        {monthNames.map((name, i) => {
          const midDay =
            (monthStartDays[i] + monthStartDays[i + 1]) / 2;
          const angle =
            -Math.PI / 2 + ((midDay - 1) / 365) * Math.PI * 2;
          const labelR = RING_R + 18;
          return (
            <text
              key={name}
              x={CENTER + Math.cos(angle) * labelR}
              y={CENTER + Math.sin(angle) * labelR}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(161, 161, 170, 0.6)"
              fontSize="8"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.05em"
            >
              {name.toUpperCase()}
            </text>
          );
        })}

        {/* Moon in center */}
        <Moon
          phase={displayPhase}
          cx={CENTER}
          cy={CENTER}
          r={MOON_SIZE / 2}
        />
      </svg>

      {/* Info display */}
      <div className="text-center">
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
            if (e.key === "Enter") {
              const parsed = parseDateInput(inputValue);
              if (parsed) {
                setSelectedDay(parsed);
                setIsEditing(false);
                setHasError(false);
                inputRef.current?.blur();
              } else {
                setHasError(true);
              }
            }
            if (e.key === "Escape") {
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
            hasError ? "text-red-500" : "text-orange-400"
          } ${isEditing ? "border-b border-zinc-600" : "border-b border-transparent"}`}
        />
        <div className="font-sans text-xs text-zinc-500">
          {getPhaseName(displayPhase)} ·{" "}
          {Math.round(getIllumination(displayPhase) * 100)}%
        </div>
        <button
          onClick={() => setSelectedDay(today)}
          disabled={selectedDay === today}
          className={`mt-2 rounded-sm border border-zinc-700 px-3 py-1 font-sans text-xs transition-opacity ${
            selectedDay === today
              ? "cursor-default opacity-0"
              : "cursor-pointer text-zinc-500 opacity-100 hover:border-orange-400 hover:text-orange-400"
          }`}
        >
          Today
        </button>
      </div>
    </div>
  );
}
