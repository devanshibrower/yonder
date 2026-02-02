"use client";

import { useRef, useEffect } from "react";
import { MeteorAnimation, MeteorConfig } from "@/lib/meteor-animation";

interface MeteorCanvasProps {
  config: MeteorConfig;
  className?: string;
}

export default function MeteorCanvas({ config, className }: MeteorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MeteorAnimation | null>(null);
  const rafRef = useRef<number>(0);

  // Initialize engine once
  useEffect(() => {
    engineRef.current = new MeteorAnimation(config);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Push config updates to engine
  useEffect(() => {
    engineRef.current?.updateConfig(config);
  }, [config]);

  // Canvas sizing + animation loop + mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      engineRef.current?.setSize(rect.width, rect.height);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Track mouse for parallax
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      engineRef.current?.setMouse(
        Math.max(0, Math.min(1, x)),
        Math.max(0, Math.min(1, y))
      );
    };

    const onMouseLeave = () => {
      // Reset to center when mouse leaves
      engineRef.current?.setMouse(0.5, 0.5);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill initial background
    ctx.fillStyle = "rgb(9, 9, 11)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loop = (timestamp: number) => {
      engineRef.current?.render(ctx, timestamp);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
