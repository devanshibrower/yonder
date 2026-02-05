"use client";
import { ShowerCard } from "@/components/ui/ShowerCard";
import showersData from "@/data/showers.json";
import { MeteorShower } from "@/data/types";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import { All_Showers, buildYearConfigs } from "@/lib/utils";
import { useMemo } from "react";

const showers = showersData.showers as MeteorShower[];

export default function Home() {
  const yearConfigs = useMemo(() => buildYearConfigs(All_Showers), []);
  return (
    <div
      className="
      flex
      flex-col
      items-center
      max-w-5xl
      mx-auto"
    >
      <ScrollDrivenCanvas configs={yearConfigs} scrollProgress={224} />

      <div>
        {showers.map((shower) => (
          <ShowerCard shower={shower} key={shower.id} />
        ))}
      </div>
    </div>
  );
}
