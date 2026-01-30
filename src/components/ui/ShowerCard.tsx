import { MeteorShower } from "@/data/showers";

export function ShowerCard({ shower }: { shower: MeteorShower }) {
  return (
    <div
      className="
        border-gray-300
        border-stroke
        rounded-lg
        p-8
        text-foreground
        max-w-2xl
        flex
        flex-col
        items-start
        justify-start
        "
    >
      <img
        src={shower.image}
        alt={shower.name}
        className="
            w-full
            h-[300px]
            object-cover
            mb-4"
      />
      <div
        className="
            flex flex-col
            items-start
            gap-2"
      >
        <h3
          className="
            text-lg 
            font-bold 
            mb-2"
        >
          {shower.name}
        </h3>
        <p className="text-sm text-gray-400">{shower.timing}</p>
        <p>{shower.description}</p>
        <p className="gap-1 text-gray-400">
          <span className="font-bold">Velocity: </span>
          <span>{shower.velocity}</span>
        </p>
        <p className="gap-1 text-gray-400">
          <span
            className="
            font-bold"
          >
            Next Peak:{" "}
          </span>
          <span>{shower.nextPeak}</span>
        </p>
      </div>
    </div>
  );
}
