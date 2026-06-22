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
    heading: "Moon calendar — iterations",
    blurb:
      "Different takes on the same circular lunar calendar. These should eventually collapse into one.",
    items: [
      {
        route: "/",
        title: "Home",
        file: "src/components/ui/MoonCanvas.tsx",
        note: "Canonical animated calendar (LunarCalendar).",
      },
      {
        route: "/experiments/moon",
        title: "Moon",
        file: "src/components/ui/MoonCanvas.tsx",
        note: "Same component as home — duplicate route.",
      },
      {
        route: "/experiments/showers",
        title: "Showers",
        file: "src/components/ui/MoonCanvasSidebar.tsx",
        note: "Sidebar variant + scroll-driven canvas.",
      },
      {
        route: "/blog/moon",
        title: "Blog · Moon",
        file: "src/app/blog/moon/page.tsx",
        note: "Inline iteration. Keeps a unique idle-RAF loop worth porting.",
      },
    ],
  },
  {
    heading: "Other experiments",
    blurb: "Distinct directions beyond the calendar.",
    items: [
      {
        route: "/experiments/meteor-showers",
        title: "Meteor Showers",
        file: "src/components/ui/ScrollDrivenCanvas.tsx",
        note: "Scroll-driven canvas + moon indicator.",
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
              <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-zinc-400">
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
