import Link from "next/link";

const exportOptions = [
  {
    href: "/api/export?format=json",
    title: "Download JSON",
    detail: "templates, plans, generated sessions, and logs",
  },
  {
    href: "/api/export?format=csv&type=workout_set",
    title: "Download CSV",
    detail: "flat workout_set rows for analysis",
  },
];

export default function DataExportPage() {
  return (
    <div className="native-page native-page-enter settings-screen">
      <header className="settings-header">
        <h1 className="settings-title">Data Export</h1>
        <p className="settings-copy">
          Export is separated from the home feed so training actions stay focused.
        </p>
      </header>

      <section className="ui-card settings-export-card">
        <h2 className="settings-section-title">Export Files</h2>
        <div className="settings-export-list">
          {exportOptions.map((item) => (
            <a key={item.href} href={item.href} className="ui-primary-button settings-export-action">
              <span>{item.title}</span>
              <span className="settings-export-action-copy">{item.detail}</span>
            </a>
          ))}
        </div>
      </section>

      <Link href="/" className="settings-back-link">
        Back to Home
      </Link>
    </div>
  );
}
