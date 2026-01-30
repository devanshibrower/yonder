import { MeteorShower } from "@/data/showers";

export function ShowerCard({ shower }: { shower: MeteorShower }) {
  return (
    <div
      className="
    border-gray-200
    border-stroke
    rounded-lg
    p-8
    text-white-200
    "
    >
      <img
        src={shower.image}
        alt={shower.name}
        className="
        w-[100px]
        h-[100px]
        mb-4"
      />
      <h3
        className="
        text-lg 
        font-bold 
        mb-2"
      >
        {shower.name}
      </h3>
      <p>{shower.timing}</p>
      <p>{shower.description}</p>
      <p>{shower.velocity}</p>
      <p>{shower.nextPeak}</p>
    </div>
  );
}
