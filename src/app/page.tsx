import { ShowerCard } from "@/components/ui/ShowerCard";
import showersData from "@/data/showers.json";
import { MeteorShower } from "@/data/types";
const showers = showersData.showers as MeteorShower[];

export default function Home() {
  return (
    <div
      className="
      flex
      flex-col
      items-center
      justify-center
      max-w-5xl
      mx-auto
      p-8"
    >
      <h1
        className="
        text-3xl 
        font-bold
        mb-2"
      >
        Meteor Showers
      </h1>
      <div>
        {showers.map((shower) => (
          <ShowerCard shower={shower} key={shower.id} />
        ))}
      </div>
    </div>
  );
}
