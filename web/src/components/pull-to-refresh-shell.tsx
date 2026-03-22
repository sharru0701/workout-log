"use client";

import type { PropsWithChildren } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import type { usePullToRefresh } from "@/lib/usePullToRefresh";

type PullToRefreshState = ReturnType<typeof usePullToRefresh>;

type PullToRefreshShellProps = PropsWithChildren<{
  pullToRefresh: PullToRefreshState;
  className?: string;
}>;

export function PullToRefreshShell({ pullToRefresh, className, children }: PullToRefreshShellProps) {
  return (
    <div
      {...pullToRefresh.bind}
      className={className}
      data-ptr-container={pullToRefresh.isEnabled ? "true" : "false"}
    >
      <div
        className="pull-to-refresh-trigger-zone"
        data-pull-refresh-trigger="true"
        aria-hidden="true"
      />
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
      />
      {children}
    </div>
  );
}
