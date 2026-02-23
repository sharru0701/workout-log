"use client";

export default function Home() {
  function downloadJsonExport() {
    const href = "/api/export?format=json";
    window.location.href = href;
  }

  function downloadWorkoutSetCsv() {
    const href = "/api/export?format=csv&type=workout_set";
    window.location.href = href;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Workout Log</h1>
      <ul className="list-disc pl-5">
        <li><a className="underline" href="/templates">/templates</a></li>
        <li><a className="underline" href="/plans">/plans</a></li>
        <li><a className="underline" href="/workout/today">/workout/today</a></li>
        <li><a className="underline" href="/calendar">/calendar</a></li>
        <li><a className="underline" href="/stats">/stats</a></li>
      </ul>

      <div className="max-w-xl rounded-2xl border p-4 space-y-3">
        <div className="font-medium">Export My Data</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl border px-4 py-2 font-medium" onClick={downloadJsonExport}>
            Download JSON (templates/plans/logs)
          </button>
          <button className="rounded-xl border px-4 py-2 font-medium" onClick={downloadWorkoutSetCsv}>
            Download CSV (workout_set)
          </button>
        </div>
      </div>
    </div>
  );
}
