"use client";
import { useRef, useEffect, useState, useCallback } from "react";

// Days in each month for 2026 (non-leap year)
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_LABELS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

// Calculate cumulative days at start of each month
const MONTH_START_DAYS = DAYS_IN_MONTH.reduce<number[]>((acc, days, i) => {
  acc.push(i === 0 ? 1 : acc[i - 1] + DAYS_IN_MONTH[i - 1]);
  return acc;
}, []);

// Convert day of year to month name and day
function dayToDateString(day: number): string {
  let remaining = day;
  for (let m = 0; m < 12; m++) {
    if (remaining <= DAYS_IN_MONTH[m]) {
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
      return `${monthNames[m]} ${remaining}`;
    }
    remaining -= DAYS_IN_MONTH[m];
  }
  return `Day ${day}`;
}

interface MoonIndicatorProps {
  percentIlluminated: number; // 0 to 100
  currentDay: number; // 1-365, which day of the year
  yearProgress: number; // 0 to 1, how far through the year
  phasePosition: number;
  onDayClick?: (day: number) => void; // Called when user clicks a day on the ring
  size?: number; // Size in pixels, default 140
}

export function MoonIndicator({
  percentIlluminated,
  currentDay,
  yearProgress,
  phasePosition,
  onDayClick,
  size = 140,
}: MoonIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ day: currentDay, progress: yearProgress });
  const propsRef = useRef({
    currentDay,
    yearProgress,
    percentIlluminated,
    phasePosition,
  });
  propsRef.current = {
    currentDay,
    yearProgress,
    percentIlluminated,
    phasePosition,
  };

  // Hover state - which day is being hovered (null if none)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const hoveredDayRef = useRef<number | null>(null);
  hoveredDayRef.current = hoveredDay;

  // Convert canvas coordinates to day of year
  const coordsToDay = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - size / 2;
      const y = clientY - rect.top - size / 2;

      // Check if click is near the ring (between inner and outer radius)
      const distance = Math.sqrt(x * x + y * y);
      const ringRadius = size * 0.42; // matches drawing code
      const tolerance = size * 0.08; // click tolerance

      if (Math.abs(distance - ringRadius) > tolerance) {
        return null; // Not on the ring
      }

      // Convert to angle, starting from 12 o'clock going clockwise
      let angle = Math.atan2(x, -y); // Note: swapped x,y and negated y to start at top
      if (angle < 0) angle += Math.PI * 2;

      // Convert angle to day (0 to 365)
      const progress = angle / (Math.PI * 2);
      const day = Math.floor(progress * 365) + 1;

      return Math.max(1, Math.min(365, day));
    },
    [size]
  );

  // Handle mouse move for hover effect
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const day = coordsToDay(e.clientX, e.clientY);
      setHoveredDay(day);
    },
    [coordsToDay]
  );

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredDay(null);
  }, []);

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const day = coordsToDay(e.clientX, e.clientY);
      if (day !== null && onDayClick) {
        onDayClick(day);
      }
    },
    [coordsToDay, onDayClick]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const scale = dpr * 2; // render at 2x beyond dpr for smoother edges
    canvas.width = size * scale;
    canvas.height = size * scale;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const state = stateRef.current;
      const target = propsRef.current;
      const hovered = hoveredDayRef.current;

      // Lerp toward targets
      state.day += (target.currentDay - state.day) * 0.15;
      state.progress += (target.yearProgress - state.progress) * 0.1;

      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const moonRadius = size * 0.22; // Moon takes up ~44% of the indicator
      const ringRadius = size * 0.42; // Ring is further out

      // === HALO (soft glow behind moon) ===
      const illumination = target.percentIlluminated / 100;
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        moonRadius * 0.8,
        cx,
        cy,
        moonRadius * 1.4
      );
      halo.addColorStop(0, `rgba(200,210,255,${0.2 * illumination})`);
      halo.addColorStop(1, "rgba(200,210,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // === MOON BASE (dark side) ===
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,90,110,0.12)";
      ctx.fill();

      // === MOON LIT PORTION (terminator geometry) ===
      const phasePos = target.phasePosition;
      const isWaxing = phasePos < 0.5;
      const phaseAngle = phasePos * Math.PI * 2;
      const terminatorX = Math.cos(phaseAngle);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius, 0, Math.PI * 2);
      ctx.clip();

      ctx.beginPath();
      if (isWaxing) {
        ctx.arc(cx, cy, moonRadius, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(
          cx,
          cy,
          moonRadius * Math.abs(terminatorX),
          moonRadius,
          0,
          Math.PI / 2,
          -Math.PI / 2,
          terminatorX > 0
        );
      } else {
        ctx.arc(cx, cy, moonRadius, -Math.PI / 2, Math.PI / 2, true);
        ctx.ellipse(
          cx,
          cy,
          moonRadius * Math.abs(terminatorX),
          moonRadius,
          0,
          Math.PI / 2,
          -Math.PI / 2,
          terminatorX < 0
        );
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(220,225,235,0.85)";
      ctx.fill();

      // === MARIA (dark spots) ===
      const mariaScale = moonRadius / 16; // Original was designed for radius 16
      const mariaSpots = [
        { x: -3, y: -4, r: 4.5 },
        { x: 4, y: -1, r: 3 },
        { x: -1, y: 5, r: 3.5 },
      ];
      for (const m of mariaSpots) {
        ctx.beginPath();
        ctx.arc(
          cx + m.x * mariaScale,
          cy + m.y * mariaScale,
          m.r * mariaScale,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(100,105,120,0.10)";
        ctx.fill();
      }
      ctx.restore();

      // === YEAR PROGRESS RING (background track) ===
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = size * 0.025;
      ctx.stroke();

      // === DAY TICK MARKS ===
      const tickInner = ringRadius - size * 0.02;
      const tickOuterSmall = ringRadius + size * 0.015;
      const tickOuterMonth = ringRadius + size * 0.035;

      // Draw 365 small ticks
      for (let day = 1; day <= 365; day++) {
        const angle = -Math.PI / 2 + (day / 365) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Check if this is a month boundary
        const isMonthStart = MONTH_START_DAYS.includes(day);
        const isHovered = hovered === day;

        // Determine tick style
        let tickOuter: number;
        let tickWidth: number;
        let tickAlpha: number;

        if (isMonthStart) {
          tickOuter = tickOuterMonth;
          tickWidth = 1.5;
          tickAlpha = 0.4;
        } else if (day % 7 === 0) {
          // Weekly tick (slightly more visible)
          tickOuter = tickOuterSmall;
          tickWidth = 0.5;
          tickAlpha = 0.15;
        } else {
          // Daily tick
          tickOuter = tickOuterSmall;
          tickWidth = 0.5;
          tickAlpha = 0.08;
        }

        // Highlight hovered day
        if (isHovered) {
          tickOuter = tickOuterMonth;
          tickWidth = 2;
          tickAlpha = 0.8;
        }

        ctx.beginPath();
        ctx.moveTo(cx + cos * tickInner, cy + sin * tickInner);
        ctx.lineTo(cx + cos * tickOuter, cy + sin * tickOuter);
        ctx.strokeStyle = `rgba(255,255,255,${tickAlpha})`;
        ctx.lineWidth = tickWidth;
        ctx.stroke();
      }

      // === MONTH LABELS ===
      const labelRadius = ringRadius + size * 0.07;
      ctx.font = `${size * 0.06}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.3)";

      for (let m = 0; m < 12; m++) {
        // Position label at middle of month
        const midDay = MONTH_START_DAYS[m] + DAYS_IN_MONTH[m] / 2;
        const angle = -Math.PI / 2 + (midDay / 365) * Math.PI * 2;
        const lx = cx + Math.cos(angle) * labelRadius;
        const ly = cy + Math.sin(angle) * labelRadius;
        ctx.fillText(MONTH_LABELS[m], lx, ly);
      }

      // === PROGRESS ARC ===
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * state.progress;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, startAngle, endAngle);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = size * 0.02;
      ctx.lineCap = "round";
      ctx.stroke();

      // === CURRENT DAY DOT ===
      const dotX = cx + Math.cos(endAngle) * ringRadius;
      const dotY = cy + Math.sin(endAngle) * ringRadius;
      ctx.beginPath();
      ctx.arc(dotX, dotY, size * 0.025, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fill();

      // === HOVER TOOLTIP ===
      if (hovered !== null) {
        const hoverAngle = -Math.PI / 2 + (hovered / 365) * Math.PI * 2;
        const tooltipRadius = ringRadius - size * 0.12;
        const tx = cx + Math.cos(hoverAngle) * tooltipRadius;
        const ty = cy + Math.sin(hoverAngle) * tooltipRadius;

        const dateStr = dayToDateString(hovered);
        ctx.font = `bold ${size * 0.07}px system-ui, sans-serif`;
        const textWidth = ctx.measureText(dateStr).width;

        // Tooltip background
        const padding = size * 0.02;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath();
        ctx.roundRect(
          tx - textWidth / 2 - padding,
          ty - size * 0.04 - padding,
          textWidth + padding * 2,
          size * 0.08 + padding,
          3
        );
        ctx.fill();

        // Tooltip text
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dateStr, tx, ty);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    let raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ cursor: onDayClick ? "pointer" : "default" }}
    />
  );
}
