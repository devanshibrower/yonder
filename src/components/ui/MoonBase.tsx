import { useEffect, useRef, useState } from "react";

//-----CONSTANTS (outside components and tokens that dont change)-------

//--colors for moon and markers
export const colors = {
  secondaryMarkers: "#3f3f46",
  primaryMarkers: "#f4f4f5",
  moonLight: "#f4f4f5",
  moonDark: "#27272a",
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
const CANVAS_SIZE = 260;
const CENTER = CANVAS_SIZE / 2;
const MOON_RADIUS = 50;
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
) {
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

//-----------------------------------MAIN FUNCTION------------------------------------------

export default function LunarCalendar() {
  //------------------------REFS AND STATE----------------------------------------

  //<htmlcanvaselement> is declaring the type of element this ref is pointing to.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1); // give me Jan 1 of current year
  const diffInMs = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffInMs / (1000 * 60 * 60 * 24) + 1);

  //current phase
  const [selectedDay, setSelectedDay] = useState<number>(dayOfYear);
  //hovered day state
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  //------------------------EFFECTS----------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    //grab the tool to draw
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    //do this so the drawing doesnt look jagged
    const dpr = window.devicePixelRatio || 1; // if no dpr, 1 canvas px = 1 screen px
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    //start drawing
    const phaseValue = getMoonPhase(selectedDay); //0-1 value representing moon phase
    const phaseName = getPhaseName(phaseValue); //"firstQuarter", "fullMoon", etc
    const phase = moonPhases[phaseName]; //get the parameters for that phase, side:"right", ellipseRadius: 25, carve: true, etc

    drawMoon(
      ctx,
      CENTER,
      CENTER,
      MOON_RADIUS,
      phase.side,
      phase.ellipseRadius,
      phase.carve,
    );

    //-----markers on outer ring-----
    for (let day = 1; day <= 365; day++) {
      //calculate length of marker depending on day of year
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RING_RADIUS, 0, Math.PI * 2);
      const isHovered = day === hoveredDay;
      const isMonthStart = MonthStartDates.includes(day);
      const tickInner = isMonthStart
        ? RING_RADIUS - 6
        : RING_RADIUS - 3; // longer markers for month starts
      const tickOuter = isMonthStart
        ? RING_RADIUS + 6
        : RING_RADIUS + 3;

      //calculate position of marker on the ring (angle)
      const angle = -Math.PI / 2 + ((day - 1) / 365) * (Math.PI * 2);

      //calculate inner and outer points of the marker
      const innerX = CENTER + Math.cos(angle) * tickInner;
      const innerY = CENTER + Math.sin(angle) * tickInner;
      const outerX = CENTER + Math.cos(angle) * tickOuter;
      const outerY = CENTER + Math.sin(angle) * tickOuter;

      //draw markers with appropriate styling
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.lineWidth = isHovered ? 1 : isMonthStart ? 1 : 0.5;
      ctx.strokeStyle = isHovered
        ? "orange"
        : isMonthStart
          ? colors.primaryMarkers
          : colors.secondaryMarkers;
      ctx.stroke();
    }

    //dot on ring
    ctx.beginPath();
    const pointAngle =
      -Math.PI / 2 + (dayOfYear / 365) * (Math.PI * 2);
    const x = CENTER + Math.cos(pointAngle) * RING_RADIUS;
    const y = CENTER + Math.sin(pointAngle) * RING_RADIUS;
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.primaryMarkers;
    ctx.fill();

    //-----------tooltip on canvas-----------//
    if (hoveredDay !== null) {
      const tooltipAngle =
        -Math.PI / 2 + ((hoveredDay - 1) / 365) * (Math.PI * 2);
      const tooltipX =
        CENTER + Math.cos(tooltipAngle) * (RING_RADIUS + 12);
      const tooltipY =
        CENTER + Math.sin(tooltipAngle) * (RING_RADIUS + 12);

      ctx.font = "12px sans-serif";
      ctx.fillStyle = "orange";

      // Use a threshold for "close to center"
      const threshold = 5;
      if (Math.abs(tooltipX - CENTER) < threshold) {
        ctx.textAlign = "center";
      } else if (tooltipX > CENTER) {
        ctx.textAlign = "left";
      } else {
        ctx.textAlign = "right";
      }

      if (Math.abs(tooltipY - CENTER) < threshold) {
        ctx.textBaseline = "middle";
      } else if (tooltipY > CENTER) {
        ctx.textBaseline = "top";
      } else {
        ctx.textBaseline = "bottom";
      }

      ctx.fillText(daytoDateString(hoveredDay), tooltipX, tooltipY);
    }

    //-----------mouse interaction-----------//

    const handleMouseMove = (event: MouseEvent) => {
      //mouse position relative to canvas, mouse doesnt have hover states so we need to calculate it ourselves
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - canvasRect.left - CENTER;
      const mouseY = event.clientY - canvasRect.top - CENTER;

      let mouseAngle = Math.atan2(mouseY, mouseX);
      mouseAngle = mouseAngle + Math.PI / 2;
      if (mouseAngle < 0) mouseAngle += Math.PI * 2; // convert to positive angle
      const hoveredDay =
        Math.round((mouseAngle / (Math.PI * 2)) * 365) + 1; // convert angle to day of year
      setHoveredDay(hoveredDay);
    };

    //click event to set selected day and update moon phase
    const handleClick = (event: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - canvasRect.left - CENTER;
      const mouseY = event.clientY - canvasRect.top - CENTER;
      let mouseAngle = Math.atan2(mouseY, mouseX);
      mouseAngle = mouseAngle + Math.PI / 2; // adjust so 0 is at top
      if (mouseAngle < 0) mouseAngle += Math.PI * 2; // convert to positive angle
      const clickedDay =
        Math.round((mouseAngle / (Math.PI * 2)) * 365) + 1; // convert angle to day of year
      setSelectedDay(clickedDay);
    };

    //add mouse move event listener to canvas to track mouse position and update hovered day state
    const handleMouseLeave = () => setHoveredDay(null);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    //cleanup function to remove event listener when component unmounts or dependencies change
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
    };
  }, [hoveredDay, selectedDay]);

  return (
    <div className="flex flex-col items-center gap-0">
      <div className="relative flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
        ></canvas>
        {selectedDay !== null && (
          <div className="text-primary text-sm">
            {daytoDateString(selectedDay)}
          </div>
        )}
      </div>
    </div>
  );
}
