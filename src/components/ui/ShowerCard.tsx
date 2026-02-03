import { MeteorShower } from "@/data/types";
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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
            gap-4"
      >
        <h2
          className="
            text-lg 
            font-bold 
            mb-2
            font-space-grotesk"
        >
          {shower.name}
        </h2>
        <p className="text-sm secondary-text font-space-grotesk">
          {shower.activePeriod.start} - {shower.activePeriod.end}, 2026
        </p>
        <p className="text-sm secondary-text font-georgia">
          {shower.description}
        </p>

        {/* shower details */}
        <div className="flex flex-col gap-2 text-sm secondary-text font-space-grotesk">
          <p className="gap-1 secondary-text">
            <span className="font-bold">Velocity: </span>
            <span>{shower.velocity.kmPerSec} km/s</span>
            <span>{shower.velocity.category}</span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span
              className="
            font-bold"
            >
              Peak Date:{" "}
            </span>
            <span>
              {monthNames[shower.peak.month - 1]} {shower.peak.dayOfMonth}, 2026
            </span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span className="font-bold">ZHR: </span>
            <span>{shower.zhr}</span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span className="font-bold">Parent Object: </span>
            <span>{shower.parentObject.name}</span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span className="font-bold">Moon Phase: </span>
            <span>{shower.moonPhase2026.phaseName}</span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span className="font-bold">Radiant: </span>
            <span>{shower.radiant.constellation}</span>
          </p>
          <p className="text-sm gap-1 secondary-text">
            <span className="font-bold">Visibility: </span>
            <span>{shower.hemisphere.note}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
