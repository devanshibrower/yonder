"use client";

import { useRef, useEffect } from "react";
import { MeteorAnimation, MeteorConfig } from "@/lib/meteor-animation";
import { lerpConfig } from "@/lib/playground-utils";

interface ScrollDrivenCanvasProps {
  configs: MeteorConfig[];
  scrollProgress: number; // 0 to configs.length - 1, fractional
}

export default function ScrollDrivenCanvas({
  configs,
  scrollProgress,
}: ScrollDrivenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MeteorAnimation | null>(null);
  const rafRef = useRef<number>(0);
  const progressRef = useRef(scrollProgress);

  // Keep ref in sync (avoids React re-renders driving animation)
  progressRef.current = scrollProgress;

  // Initialize engine + animation loop + resize + mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || configs.length === 0) return;

    const engine = new MeteorAnimation(configs[0]);
    engineRef.current = engine;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      engine.setSize(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking on window (since content overlays the canvas)
    const onMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      engine.setMouse(
        Math.max(0, Math.min(1, x)),
        Math.max(0, Math.min(1, y))
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill initial background
    ctx.fillStyle = "rgb(9, 9, 11)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loop = (timestamp: number) => {
      const p = progressRef.current;
      const maxIdx = configs.length - 1;
      const clamped = Math.max(0, Math.min(maxIdx, p));
      const floor = Math.floor(clamped);
      const ceil = Math.min(floor + 1, maxIdx);
      const frac = clamped - floor;

      const interpolated = floor === ceil
        ? configs[floor]
        : lerpConfig(configs[floor], configs[ceil], frac);

      engine.updateConfig(interpolated);
      engine.render(ctx, timestamp);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [configs]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
    />
  );
}
