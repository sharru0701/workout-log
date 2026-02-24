import Link from "next/link";

const primaryRoutes = [
  {
    href: "/workout/today",
    label: "Today",
    copy: "Start or continue today's workout log.",
  },
  {
    href: "/plans",
    label: "Plans",
    copy: "Create and tune active training plans.",
  },
  {
    href: "/calendar",
    label: "Calendar",
    copy: "Preview upcoming sessions by date.",
  },
  {
    href: "/stats",
    label: "Stats",
    copy: "Review volume, e1RM, and compliance trends.",
  },
];

const utilityRoutes = [
  {
    href: "/templates",
    label: "Templates",
    copy: "Manage base program templates and versions.",
  },
  {
    href: "/settings",
    label: "Settings",
    copy: "App tools, export, and offline utilities.",
  },
];

export default function Home() {
  return (
    <div className="native-page native-page-enter home-screen">
      <section className="ui-card home-hero">
        <p className="home-hero-kicker">Workout Log</p>
        <h1 className="home-hero-title">Training control center</h1>
        <p className="home-hero-copy">
          Move through today&apos;s training flow without jumping between legacy links.
        </p>
        <Link className="haptic-tap ui-primary-button home-hero-action" href="/workout/today">
          Continue Today
        </Link>
      </section>

      <section className="home-section">
        <h2 className="home-section-title">Primary</h2>
        <div className="home-primary-grid">
          {primaryRoutes.map((route) => (
            <Link key={route.href} href={route.href} className="haptic-tap motion-card home-primary-card">
              <span className="home-card-label">{route.label}</span>
              <span className="home-card-copy">{route.copy}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ui-card home-tools">
        <h2 className="home-section-title">Tools</h2>
        <div className="home-tools-list">
          {utilityRoutes.map((route) => (
            <Link key={route.href} href={route.href} className="haptic-tap home-tool-link">
              <span className="home-tool-label">{route.label}</span>
              <span className="home-tool-copy">{route.copy}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
