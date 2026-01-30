export type MeteorShower = {
  id: number;
  name: string;
  timing: string;
  description: string;
  image: string;
  velocity: string;
  nextPeak: string;
};

export const showers: MeteorShower[] = [
  {
    id: 1,
    name: "Quadrantids ( QUAD )",
    timing: "Active from December 28th to January 12th, 2027",
    description:
      "The Quadrantids have the potential to be the strongest shower of the year but usually fall short due to the short length of maximum activity (6 hours) and the poor weather experienced during early January. The average hourly rates one can expect under dark skies is 25. These meteors usually lack persistent trains but often produce bright fireballs. Due to the high northerly declination (celestial latitude) these meteors are not well seen from the southern hemisphere. Predictions for 2027 show a peak near 3:30 UT on January 4th. This timing favors Europe and western Asia. The lunar conditions for this date are favorable as the thin waning crescent moon will not interfere with viewing meteor activity.",
    image: "/shower-images/quadrantids.jpg",
    velocity: "25 miles/sec(medium -40.4 km/sec)",
    nextPeak:
      "The Quadrantids will next peak on the Jan 3-4, 2027 night. On this night, the moon will be 13% full",
  },
  {
    id: 2,
    name: "Lyrids ( LYR)",
    timing: "Active from April 14th to April 30th, 2026",
    description:
      "The Lyrids are a medium strength shower that usually produces good rates for three nights centered on the maximum. These meteors also usually lack persistent trains but can produce fireballs. These meteors are best seen from the northern hemisphere where the radiant is high in the sky at dawn. Activity from this shower can be seen from the southern hemisphere, but at a lower rate. In 2026, maximum activity is predicted to occur near 20 UT on April 22nd. On this date the waxing crescent moon will set before the radiant reaches a favorable elevation therefore lunar interference will be minimal in 2026.",
    image: "/shower-images/quadrantids.jpg",
    velocity: "29 miles/sec(fast -46.4 km/sec)",
    nextPeak:
      "The Lyrids will next peak on the Apr 22, 2026 night. On this night, the moon will be 99% full",
  },
  {
    id: 3,
    name: "Eta Aquarids ( ETA )",
    timing: "Active from May 5th to May 25th, 2026",
    description:
      "The Eta Aquarids are a medium strength shower that usually produces good rates for three nights centered on the maximum. These meteors also usually lack persistent trains but can produce fireballs. These meteors are best seen from the northern hemisphere where the radiant is high in the sky at dawn. Activity from this shower can be seen from the southern hemisphere, but at a lower rate. In 2026, maximum activity is predicted to occur near 10 UT on May 6th. On this date the waxing crescent moon will set before the radiant reaches a favorable elevation therefore lunar interference will be minimal in 2026.",
    image: "/shower-images/quadrantids.jpg",
    velocity: "33 miles/sec(fast -52.8 km/sec)",
    nextPeak:
      "The Eta Aquarids will next peak on the May 6, 2026 night. On this night, the moon will be 99% full",
  },
];
