"use client";
import { useEffect, useMemo, useState } from "react";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import { All_Showers, buildYearConfigs } from "@/lib/utils";

export default function ScrollDrivenCanvasPage() {
  const configs = useMemo(() => buildYearConfigs(All_Showers), []);
  const [progress, setProgress] = useState(0);

  // Map page scroll (0–1) onto the year (0–364) so scrolling drives the engine.
  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const frac = max > 0 ? window.scrollY / max : 0;
      setProgress(frac * 364);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative">
      <ScrollDrivenCanvas configs={configs} scrollProgress={progress} />
      {/* Scroll space to drive the animation through the year */}
      <div style={{ height: "600vh" }} />
      <div className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 font-mono text-xs text-zinc-400">
        scroll to move through the year · day {Math.round(progress) + 1}/365
      </div>
    </div>
  );
}
