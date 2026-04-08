import { apiGet } from "@/shared/api/api";
import type { AppLocale } from "@/lib/i18n/messages";
import type { HomeData } from "@/server/home/home-service";

export type {
  HomeData,
  HomeTodaySummary,
  HomeQuickStats,
  HomePlanOverview,
  HomeWeeklySummary,
  HomeLastSession,
  HomeTodayExercise,
  HomeTodayLoggedExercise,
  HomeRecentSession,
  HomeStrengthItem,
  HomeVolumeTrendPoint,
} from "@/server/home/home-service";

export interface HomeDataSource {
  load(): Promise<HomeData>;
}

export type HomeDataLocale = AppLocale;

const DEFAULT_RECENT_LIMIT = 3;

// ─── Data Sources ───────────────────────────────────────────────────

export class ApiHomeDataSource implements HomeDataSource {
  constructor(
    private readonly recentLimit = DEFAULT_RECENT_LIMIT,
    private readonly locale: HomeDataLocale = "ko",
  ) {}

  async load(): Promise<HomeData> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return await apiGet<HomeData>(`/api/home?timezone=${encodeURIComponent(timezone)}&recentLimit=${this.recentLimit}&locale=${this.locale}`, {
      maxAgeMs: 60_000,
      staleWhileRevalidateMs: 300_000,
    });
  }
}

// NOTE: PreviewHomeDataSource 및 getHomePreviewData는 테스트용으로 남겨둘 수 있으나,
// 이제 서버 서비스에서도 관리 가능하므로 필요 시 리팩터링 대상임.
