import { ShowerCard } from "@/components/ui/ShowerCard";
import showersData from "@/data/showers.json";
import { MeteorShower } from "@/data/types";
import { MoonIndicator } from "@/components/ui/MoonIndicator";

const showers = showersData.showers as MeteorShower[];

export default function Home() {
  return (
    <div
      className="
      flex
      flex-col
      items-center
      max-w-5xl
      mx-auto"
    >
      <h1
        className="
        text-3xl 
        font-bold
        mb-2"
      >
        Meteor Showers
      </h1>
      <MoonIndicator
        percentIlluminated={25}
        currentDay={180}
        yearProgress={0.2}
      />
      <div>
        {showers.map((shower) => (
          <ShowerCard shower={shower} key={shower.id} />
        ))}
      </div>
    </div>
  );
}
