import { useEffect, useRef, useState } from "react";

export default function moon() {
  //<htmlcanvaselement> is declaring the type of element this ref is pointing to.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const center = 100;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1); // give me Jan 1 of current year
  const diffInMs = now.getTime() - startOfYear.getTime();
  const dayofYear = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  console.log("today isday: ", dayofYear);

  //current phase
  const [currentPhase, setCurrentPhase] =
    useState<keyof typeof moonPhases>("waningGibbous");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    //grab the tool to draw
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    //do this so the drawing doesnt look jagged
    const dpr = window.devicePixelRatio || 1; // if no dpr, 1 canvas px = 1 screen px
    canvas.width = 200 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = "200px";
    canvas.style.height = "200px";
    ctx.scale(dpr, dpr);

    //start drawing
    const phase = moonPhases[currentPhase]; // use square brackets when key is a variable
    drawMoon(ctx, 100, 100, 50, phase.side, phase.ellipseRadius, phase.carve);

    //outer ring
    const ringRadius = 80;
    ctx.beginPath();
    ctx.arc(100, 100, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#6b717a";
    ctx.stroke();

    //ticks on outer ring
    for (let i = 0; i < 365; i++) {
      const pointOnRing = -Math.PI / 2 + (i / 365) * (Math.PI * 2);
      const innerX = center + Math.cos(pointOnRing) * (ringRadius - 3);
      const innerY = center + Math.sin(pointOnRing) * (ringRadius - 3);
      const outerX = center + Math.cos(pointOnRing) * (ringRadius + 3);
      const outerY = center + Math.sin(pointOnRing) * (ringRadius + 3);
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = "#6b717a";
      ctx.lineWidth = 0.5;
      ctx.strokeStyle;
      ctx.stroke();
    }
    //dot on ring
    ctx.beginPath();
    const pointAngle = -Math.PI / 2 + (dayofYear / 365) * (Math.PI * 2);
    const x = center + Math.cos(pointAngle) * ringRadius;
    const y = center + Math.sin(pointAngle) * ringRadius;
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#6b717a";
    ctx.fill();
  }, [currentPhase]);

  return (
    <div className="flex flex-col gap-2 items-center">
      <canvas ref={canvasRef} width={200} height={200}></canvas>
      <button
        className="
        border border-1
        border-slate-400 
        w-fit px-4
        py-1 
        rounded-2xl 
        font-sans text-sm
        text-slate-400
        transition-all
        duration-150
        ease-out
        hover:border-slate-200
        hover:text-slate-200
        active:scale-[0.97]
        cursor-pointer
        "
        onClick={() => {
          const keys = Object.keys(moonPhases);
          const currentIndex = keys.indexOf(currentPhase);
          const nextIndex = (currentIndex + 1) % keys.length;
          setCurrentPhase(keys[nextIndex] as keyof typeof moonPhases);
        }}
      >
        Next Phase
      </button>
      <div>{now.toLocaleDateString()}</div>
    </div>
  );
}

//----------------------------------------------------------------------------

const moonPhases = {
  newMoon: { side: "right", ellipseRadius: 50, carve: true },
  waxingCrescent: { side: "right", ellipseRadius: 25, carve: true },
  firstQuarter: { side: "right", ellipseRadius: 0, carve: false },
  waxingGibbous: { side: "right", ellipseRadius: 25, carve: false },
  fullMoon: { side: "right", ellipseRadius: 50, carve: false },
  waningGibbous: { side: "left", ellipseRadius: 25, carve: false },
  thirdQuarter: { side: "left", ellipseRadius: 0, carve: false },
  waningCrescent: { side: "left", ellipseRadius: 25, carve: true },
} as const;

export function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number, //center x
  cy: number, //center y
  radius: number, //moon radius
  side: "right" | "left",
  ellipseRadius: number,
  carve: boolean
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  //dark base
  ctx.fillStyle = "#23272f";
  ctx.fill();
  //lit half
  ctx.beginPath();
  if (side === "right") {
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = "#efe2ce";
    ctx.fill();
  } else {
    ctx.arc(cx, cy, radius, Math.PI / 2, -Math.PI / 2);
    ctx.fillStyle = "#efe2ce";
    ctx.fill();
  }
  ctx.beginPath();
  if (carve) {
    ctx.ellipse(cx, cy, ellipseRadius, radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#23272f";
    ctx.fill();
  } else {
    ctx.ellipse(cx, cy, ellipseRadius, radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#efe2ce";
    ctx.fill();
  }
  ctx.restore();
}
