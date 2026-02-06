"use client";
// this component is the bridge between react and the animation engine. it creates the canvas, engine and runs the animation loop.

import { useRef, useEffect } from "react";
import { MeteorAnimation } from "@/lib/meteor-animation";
import { MeteorConfig, lerpConfig } from "@/lib/utils";

interface ScrollDrivenCanvasProps {
  configs: MeteorConfig[]; // 365 daily configs
  scrollProgress: number; //0 to 364, fractional (which day to show)
}

export default function ScrollDrivenCanvas({
  configs,
  scrollProgress,
}: ScrollDrivenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MeteorAnimation | null>(null);
  const rafRef = useRef<number>(0);

  //keep scroll progress in a ref so the aniamtion loop always reads the latest value without causing re-renders
  const progressRef = useRef(scrollProgress);
  progressRef.current = scrollProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || configs.length === 0) return;

    //create the engine once
    const engine = new MeteorAnimation(configs[0]);
    engineRef.current = engine;

    //handle resize - size the canvas to fill window
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

    //track mouse position on the whole window
    const onMouseMove = (e: MouseEvent) => {
      engine.setMouse(
        e.clientX / window.innerWidth,
        e.clientY / window.innerHeight
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    //animation loop
    const loop = (timestamp: number) => {
      //figure out which two configs to blend based on scroll position
      const p = progressRef.current;
      const maxIdx = configs.length - 1;
      const clamped = Math.max(0, Math.min(maxIdx, p));
      const floor = Math.floor(clamped);
      const ceiling = Math.min(floor + 1, maxIdx);
      const frac = clamped - floor;

      //blend between adjacent configs for smooth transitions
      const interpolated =
        floor === ceiling
          ? configs[floor]
          : lerpConfig(configs[floor], configs[ceiling], frac);

      engine.updateConfig(interpolated);
      engine.render(ctx, timestamp);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    //Cleanup stop loop and remove listeners when component unmounts
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
