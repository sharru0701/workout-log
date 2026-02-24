export default function OfflinePage() {
  return (
    <div className="native-page native-page-enter tab-screen">
      <section className="motion-card rounded-2xl border p-5 space-y-3">
        <h1 className="tab-screen-title">You are offline</h1>
        <p className="tab-screen-caption">
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
