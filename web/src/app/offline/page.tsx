export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <section className="rounded-2xl border p-5 space-y-3">
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-sm text-neutral-600">
          The app shell is available. You can continue logging in <a className="underline" href="/workout/today">Today</a>,
          and queued logs will sync when network returns.
        </p>
        <a className="ui-primary-button inline-flex items-center justify-center px-4 py-2" href="/workout/today">
          Open Workout Today
        </a>
      </section>
    </div>
  );
}
