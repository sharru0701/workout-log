import Link from "next/link";

const settingsLinks = [
  {
    href: "/settings/data",
    title: "Data Export",
    detail: "Download JSON/CSV snapshots of training data.",
  },
  {
    href: "/templates",
    title: "Templates",
    detail: "Manage and fork training templates.",
  },
  {
    href: "/offline",
    title: "Offline Help",
    detail: "Offline behavior and quick recovery path.",
  },
];

export default function SettingsPage() {
  return (
    <div className="native-page native-page-enter settings-screen">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-copy">Utility actions are grouped here so the home screen stays focused on training.</p>
      </header>

      <section className="motion-card rounded-2xl border settings-menu-card">
        <h2 className="settings-section-title">Utilities</h2>
        <div className="settings-menu-list">
          {settingsLinks.map((item) => (
            <Link key={item.href} href={item.href} className="haptic-tap settings-menu-link">
              <span className="settings-menu-title">{item.title}</span>
              <span className="settings-menu-copy">{item.detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <Link href="/" className="settings-back-link">
        Back to Home
      </Link>
    </div>
  );
}
