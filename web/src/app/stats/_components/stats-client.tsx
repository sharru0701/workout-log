"use client";

import { StatsScreen } from "@/widgets/stats-screen";
import type { StatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";

type StatsClientProps = StatsPageBootstrap;

export function StatsClient(props: StatsClientProps) {
  return <StatsScreen {...props} />;
}
