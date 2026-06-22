"use client";
import { useState } from "react";
import { MoonIndicator } from "@/components/ui/MoonIndicator";
import { moonIlluminationForDay, moonPhasePosition } from "@/lib/utils";

export default function MoonIndicatorPage() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const today = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86400000,
  );

  // MoonIndicator is presentational — the parent owns the day and the math.
  const [day, setDay] = useState(today);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <MoonIndicator
        currentDay={day}
        percentIlluminated={moonIlluminationForDay(day)}
        phasePosition={moonPhasePosition(day)}
        yearProgress={day / 365}
        onDayClick={setDay}
        size={280}
      />
    </div>
  );
}
