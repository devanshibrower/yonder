"use client";
import MoonBase from "@/components/ui/MoonBase";

export default function Moon() {
  const day = 112;
  return (
    <div className="flex min-h-screen items-center justify-center">
      {/* <MoonIndicator
        currentDay={day}
        yearProgress={(day - 1) / 364}
        phasePosition={moonPhasePosition(day)}
        percentIlluminated={moonIlluminationForDay(day)}
      /> */}
      <MoonBase></MoonBase>
    </div>
  );
}
