import {
  BaseGroupedList,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
}

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

function formatMetrics(raw: string) {
  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) return "없음";
  if (values.length === 4) return "전체";
  return `${values.length}개 선택`;
}

export default async function StatsFiltersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const planScope = readString(params, "planScope", "all");
  const bucket = readString(params, "bucket", "week");
  const exercise = readString(params, "exercise", "Back Squat");
  const metrics = readString(params, "metrics", "e1rm,volume,compliance,prs");
  const days = readString(params, "days", "90");
  const from = readString(params, "from", "");
  const to = readString(params, "to", "");

  const returnQuery = new URLSearchParams();
  returnQuery.set("planScope", planScope);
  returnQuery.set("bucket", bucket);
  returnQuery.set("exercise", exercise);
  returnQuery.set("metrics", metrics);
  returnQuery.set("days", days);
  if (from) returnQuery.set("from", from);
  if (to) returnQuery.set("to", to);
  const returnTo = `/stats/filters?${returnQuery.toString()}`;

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="grid gap-1 px-1">
        <h1 className="type-title m-0">통계 필터</h1>
        <p className="type-caption m-0">수정할 필터를 선택하세요.</p>
      </header>

      <section className="grid gap-2">
        <SectionHeader title="범위" />
        <BaseGroupedList ariaLabel="Stats filter scope">
          <ValueRow
            href={toSelectionHref("/stats/filters/select/plan-scope", returnTo)}
            label="플랜 필터"
            description="플랜 집계 범위를 선택합니다."
            value={planScope}
            leading={<RowIcon symbol="PL" tone="neutral" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/select/bucket", returnTo)}
            label="집계 단위"
            description="추세 집계 단위를 선택합니다."
            value={bucket}
            leading={<RowIcon symbol="RG" tone="tint" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/select/exercise", returnTo)}
            label="운동 필터"
            description="운동을 검색해 선택합니다."
            value={exercise}
            leading={<RowIcon symbol="EX" tone="blue" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/select/metrics", returnTo)}
            label="지표"
            description="표시할 지표를 선택합니다."
            value={formatMetrics(metrics)}
            leading={<RowIcon symbol="MT" tone="green" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/picker/days", returnTo)}
            label="기본 일수"
            description="기본 조회 일수를 설정합니다."
            value={days}
            leading={<RowIcon symbol="DY" tone="orange" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/picker/from", returnTo)}
            label="시작일"
            description="조회 시작일을 설정합니다(선택)."
            value={from || "미설정"}
            leading={<RowIcon symbol="FR" tone="neutral" />}
          />
          <ValueRow
            href={toSelectionHref("/stats/filters/picker/to", returnTo)}
            label="종료일"
            description="조회 종료일을 설정합니다(선택)."
            value={to || "미설정"}
            leading={<RowIcon symbol="TO" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>하위 화면에서 돌아오면 각 값이 바로 반영됩니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="적용" />
        <BaseGroupedList ariaLabel="Stats filter apply">
          <ValueRow
            href={`/stats/dashboard?${returnQuery.toString()}`}
            label="대시보드 열기"
            description="현재 필터로 대시보드를 엽니다."
            value="열기"
            leading={<RowIcon symbol="GO" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>대시보드에서 필터 결과를 바로 확인하세요.</SectionFootnote>
      </section>
    </div>
  );
}
