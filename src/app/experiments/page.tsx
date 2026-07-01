import Link from "next/link";

type Experiment = {
  route: string;
  title: string;
  file: string;
  note: string;
};

type Group = {
  heading: string;
  blurb: string;
  items: Experiment[];
};

const groups: Group[] = [
  {
    heading: "Components",
    blurb:
      "Each reusable component, rendered on its own. Titles match the repo exactly.",
    items: [
      {
        route: "/experiments/moon-calendar",
        title: "MoonCalendar",
        file: "src/components/ui/MoonCalendar.tsx",
        note: "Moon phase for any date. Two models side by side — simple 29.53-day clock vs real-orbit accurate.",
      },
      {
        route: "/experiments/moon-dial",
        title: "MoonDial",
        file: "src/components/ui/MoonDial.tsx",
        note: "Interactive moon phase dial with date selection.",
      },
      {
        route: "/experiments/moon-canvas",
        title: "MoonCanvas",
        file: "src/components/ui/MoonCanvas.tsx",
        note: "Full date-input calendar dial. Also what the homepage renders.",
      },
      {
        route: "/experiments/moon-canvas-sidebar",
        title: "MoonCanvasSidebar",
        file: "src/components/ui/MoonCanvasSidebar.tsx",
        note: "Controlled dial variant (selectedDay / onDaySelect props).",
      },
      {
        route: "/experiments/moon-indicator",
        title: "MoonIndicator",
        file: "src/components/ui/MoonIndicator.tsx",
        note: "Small presentational dial — halo, maria, tooltip. Props in, draw out.",
      },
      {
        route: "/experiments/scroll-driven-canvas",
        title: "ScrollDrivenCanvas",
        file: "src/components/ui/ScrollDrivenCanvas.tsx",
        note: "Meteor animation engine — scroll moves through the year.",
      },
    ],
  },
  {
    heading: "Pages",
    blurb: "Standalone experiment pages (not shared components).",
    items: [
      {
        route: "/experiments/blog-moon",
        title: "BlogMoon",
        file: "src/app/experiments/blog-moon/page.tsx",
        note: "Inline moon dial — the cleaner iteration (idle loop, ring-band hit detection).",
      },
      {
        route: "/experiments/showers",
        title: "Showers",
        file: "src/app/experiments/showers/page.tsx",
        note: "Scroll experience composing MoonCanvasSidebar + ScrollDrivenCanvas.",
      },
      {
        route: "/experiments/meteor-showers",
        title: "Meteor Showers",
        file: "src/app/experiments/meteor-showers/page.tsx",
        note: "Scroll experience composing MoonIndicator + ScrollDrivenCanvas.",
      },
    ],
  },
];

export default function Experiments() {
  return (
    <main className="min-h-screen bg-zinc-900 px-6 py-16 text-zinc-200">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12">
          <h1 className="font-sans text-2xl tracking-tight text-zinc-100">
            Experiments
          </h1>
          <p className="mt-2 font-sans text-sm text-zinc-500">
            Every page and experiment in the project, in one place.
          </p>
        </header>

        <div className="flex flex-col gap-12">
          {groups.map((group) => (
            <section key={group.heading}>
              <h2 className="font-sans text-xs font-medium tracking-widest text-zinc-400 uppercase">
                {group.heading}
              </h2>
              <p className="mt-1 mb-4 font-sans text-sm text-zinc-600">
                {group.blurb}
              </p>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.route}>
                    <Link
                      href={item.route}
                      className="group flex items-baseline justify-between gap-4 rounded-lg border border-zinc-800 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-800/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-sans text-sm text-zinc-100">
                            {item.title}
                          </span>
                          <span className="font-mono text-xs text-zinc-500">
                            {item.route}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-sans text-xs text-zinc-500">
                          {item.note}
                        </p>
                      </div>
                      <code className="shrink-0 font-mono text-[10px] text-zinc-600">
                        {item.file}
                      </code>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
