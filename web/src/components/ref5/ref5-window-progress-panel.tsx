import type { Ref5Status } from "@workout/core/program-engine/ref5-status";
import { V2Card } from "@/components/v2/primitives";
import {
  buildRef5WindowProgressRows,
  getRef5WindowProgressDescription,
} from "@/features/ref5/model/window-progress";

type Props = {
  status: Ref5Status | null;
  locale: "ko" | "en";
  loading?: boolean;
  variant?: "paper" | "terminal";
};

export function Ref5WindowProgressPanel({
  status,
  locale,
  loading = false,
  variant = "paper",
}: Props) {
  const terminal = variant === "terminal";
  const title = locale === "ko" ? "기본 판정창" : "Base judgment windows";
  const description = getRef5WindowProgressDescription(locale);

  if (!status) {
    return (
      <V2Card
        tone="inset"
        padding="var(--v2-s-3)"
        radius={terminal ? "var(--v2-r-1)" : "var(--v2-r-3)"}
        style={terminal ? { boxShadow: "inset 0 0 0 1px var(--term-line-box)" } : undefined}
      >
        <div className="v2-mono-label" style={{ color: terminal ? "var(--term-dim)" : "var(--v2-ink-3)" }}>
          {loading
            ? locale === "ko" ? "기본 판정창을 불러오는 중..." : "Loading judgment windows..."
            : locale === "ko" ? "기본 판정창을 불러오지 못했습니다." : "Judgment windows are unavailable."}
        </div>
      </V2Card>
    );
  }

  const rows = buildRef5WindowProgressRows(status, locale);

  return (
    <V2Card
      tone="inset"
      padding="var(--v2-s-4)"
      radius={terminal ? "var(--v2-r-1)" : "var(--v2-r-3)"}
      style={terminal ? { boxShadow: "inset 0 0 0 1px var(--term-line-box)" } : undefined}
    >
      <section aria-label={title}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--v2-s-2)",
          }}
        >
          <strong
            className={terminal ? "v2-mono-label" : "v2-label"}
            style={{ color: terminal ? "var(--term-cyan)" : "var(--v2-ink)" }}
          >
            {title}
          </strong>
          <span
            className="v2-mono-label"
            style={{ color: terminal ? "var(--term-dim)" : "var(--v2-ink-3)" }}
          >
            REF5
          </span>
        </div>

        <p
          className={terminal ? "v2-mono-label" : "v2-small"}
          style={{
            margin: "var(--v2-s-1) 0 0",
            color: terminal ? "var(--term-dim)" : "var(--v2-ink-2)",
          }}
        >
          {description}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
            gap: "var(--v2-s-2)",
            marginTop: "var(--v2-s-3)",
          }}
        >
          {rows.map((row) => (
            <div
              key={row.key}
              role="progressbar"
              aria-label={`${row.label} ${row.current}/${row.threshold}`}
              aria-valuemin={0}
              aria-valuemax={row.threshold}
              aria-valuenow={row.current}
              style={{
                minWidth: 0,
                padding: "var(--v2-s-2)",
                background: terminal ? "var(--term-panel)" : "var(--v2-paper)",
                borderRadius: "var(--v2-r-2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--v2-s-1)",
                }}
              >
                <span
                  className="v2-mono-label"
                  style={{
                    color: terminal ? "var(--term-fg)" : "var(--v2-ink)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.label}
                </span>
                <span
                  className="v2-mono-label"
                  style={{
                    color: terminal ? "var(--term-amber)" : "var(--v2-c-progress)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.current}/{row.threshold}
                </span>
              </div>
              <div
                aria-hidden
                style={{
                  height: 4,
                  marginTop: "var(--v2-s-2)",
                  overflow: "hidden",
                  borderRadius: "var(--v2-r-pill)",
                  background: terminal ? "var(--term-line-box)" : "var(--v2-paper-3)",
                }}
              >
                <div
                  style={{
                    width: `${row.ratio * 100}%`,
                    height: "100%",
                    background: terminal ? "var(--term-green)" : "var(--v2-c-progress)",
                    transition: "width 180ms ease",
                  }}
                />
              </div>
              <div
                className="v2-mono-label"
                style={{
                  marginTop: "var(--v2-s-1)",
                  color: terminal ? "var(--term-dim)" : "var(--v2-ink-3)",
                  fontSize: "var(--v2-t-12)",
                }}
              >
                {locale === "ko" ? `판정 완료 ${row.completed}회` : `${row.completed} judged`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </V2Card>
  );
}
