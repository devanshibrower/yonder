"use client";

import { useRef, useEffect } from "react";
import {
  moonIlluminationForDay,
  moonPhaseNameForDay,
  moonPhasePosition,
} from "@/lib/playground-utils";

interface MoonIndicatorProps {
  currentDay: number;
  yearProgress: number;
  opacity: number;
}

export default function MoonIndicator({
  currentDay,
  yearProgress,
  opacity,
}: MoonIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    day: currentDay,
    progress: yearProgress,
    frameCount: 0,
  });
  const propsRef = useRef({ currentDay, yearProgress });
  propsRef.current = { currentDay, yearProgress };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const CSS_SIZE = 72;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CSS_SIZE * dpr;
    canvas.height = CSS_SIZE * dpr;
    canvas.style.width = CSS_SIZE + "px";
    canvas.style.height = CSS_SIZE + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const draw = () => {
      const state = stateRef.current;
      const target = propsRef.current;

      // Lerp smoothing
      state.day += (target.currentDay - state.day) * 0.15;
      state.progress += (target.yearProgress - state.progress) * 0.1;
      state.frameCount++;

      const day = state.day;
      const progress = state.progress;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);

      const cx = CSS_SIZE / 2;
      const cy = CSS_SIZE / 2;

      // --- Year-progress ring ---
      const ringR = 30;
      // Faint circle outline
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Progress arc from 12 o'clock
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * Math.max(0, Math.min(1, progress));
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, startAngle, endAngle);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Small dot at current position
      const dotX = cx + Math.cos(endAngle) * ringR;
      const dotY = cy + Math.sin(endAngle) * ringR;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();

      // --- Moon phase ---
      const moonR = 16;
      const phasePos = moonPhasePosition(Math.round(day));
      const illumination = moonIlluminationForDay(Math.round(day)) / 100;

      // Halo
      const haloGrad = ctx.createRadialGradient(cx, cy, moonR * 0.8, cx, cy, moonR * 1.4);
      haloGrad.addColorStop(0, `rgba(200,210,255,${0.06 * illumination})`);
      haloGrad.addColorStop(1, "rgba(200,210,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, moonR * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();

      // Earthshine (faint glow on dark side)
      ctx.beginPath();
      ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,90,110,0.12)";
      ctx.fill();

      // Lit surface with terminator
      // Phase position: 0 = new, 0.5 = full, 1 = new
      // Waxing (0-0.5): lit on right, Waning (0.5-1): lit on left
      const isWaxing = phasePos < 0.5;
      const phaseAngle = phasePos * Math.PI * 2; // 0 to 2PI
      // Terminator x-scale: cos maps phase to terminator position
      const terminatorX = Math.cos(phaseAngle);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
      ctx.clip();

      // Draw lit portion
      ctx.beginPath();
      // Right half or left half lit
      if (isWaxing) {
        // Waxing: lit on right side
        // Draw from top to bottom: right half arc + terminator ellipse
        ctx.moveTo(cx, cy - moonR);
        // Right semicircle
        ctx.arc(cx, cy, moonR, -Math.PI / 2, Math.PI / 2);
        // Terminator (ellipse back)
        ctx.ellipse(cx, cy, moonR * Math.abs(terminatorX), moonR, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0);
      } else {
        // Waning: lit on left side
        ctx.moveTo(cx, cy - moonR);
        // Left semicircle
        ctx.arc(cx, cy, moonR, -Math.PI / 2, Math.PI / 2, true);
        // Terminator (ellipse back)
        ctx.ellipse(cx, cy, moonR * Math.abs(terminatorX), moonR, 0, Math.PI / 2, -Math.PI / 2, terminatorX < 0);
      }
      ctx.closePath();

      // Lit surface color
      const litGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, moonR);
      litGrad.addColorStop(0, "rgba(220,225,235,0.85)");
      litGrad.addColorStop(0.7, "rgba(200,205,215,0.75)");
      litGrad.addColorStop(1, "rgba(170,175,185,0.55)");
      ctx.fillStyle = litGrad;
      ctx.fill();

      // Maria (dark patches on moon surface)
      const mariaSpots = [
        { x: -3, y: -4, r: 4.5 },
        { x: 4, y: -1, r: 3 },
        { x: -1, y: 5, r: 3.5 },
        { x: 5, y: 4, r: 2 },
        { x: -5, y: 1, r: 2.5 },
      ];
      for (const m of mariaSpots) {
        ctx.beginPath();
        ctx.arc(cx + m.x, cy + m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,105,120,0.15)";
        ctx.fill();
      }

      // Limb darkening
      const limbGrad = ctx.createRadialGradient(cx, cy, moonR * 0.5, cx, cy, moonR);
      limbGrad.addColorStop(0, "rgba(0,0,0,0)");
      limbGrad.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.beginPath();
      ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
      ctx.fillStyle = limbGrad;
      ctx.fill();

      ctx.restore();

      ctx.restore();

      // Update text label (throttled to every 6 frames)
      if (state.frameCount % 6 === 0 && labelRef.current) {
        const roundedDay = Math.round(day);
        const phaseName = moonPhaseNameForDay(roundedDay);
        const illumPct = Math.round(moonIlluminationForDay(roundedDay));
        labelRef.current.textContent = `${phaseName} \u00B7 ${illumPct}%`;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        opacity,
        transition: "opacity 0.6s ease-out",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      <canvas ref={canvasRef} />
      <div
        ref={labelRef}
        style={{
          fontSize: 10,
          fontFamily: "system-ui, sans-serif",
          color: "rgba(255,255,255,0.25)",
          marginTop: 4,
          textAlign: "right",
          whiteSpace: "nowrap",
          width: 140,
        }}
      />
    </div>
  );
}
