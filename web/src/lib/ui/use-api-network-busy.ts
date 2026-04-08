"use client";

import { useEffect, useState } from "react";
import { getApiNetworkInflightCount, subscribeApiNetworkInflight } from "@/shared/api/api";

type UseApiNetworkBusyOptions = {
  idleDelayMs?: number;
};

export function useApiNetworkBusy({ idleDelayMs = 120 }: UseApiNetworkBusyOptions = {}) {
  const [busy, setBusy] = useState(() => getApiNetworkInflightCount() > 0);

  useEffect(() => {
    let idleTimer: number | null = null;
    const unsubscribe = subscribeApiNetworkInflight((count) => {
      if (count > 0) {
        if (idleTimer !== null) {
          window.clearTimeout(idleTimer);
          idleTimer = null;
        }
        setBusy(true);
        return;
      }

      if (idleDelayMs <= 0) {
        setBusy(false);
        return;
      }

      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        setBusy(false);
      }, idleDelayMs);
    });

    return () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      unsubscribe();
    };
  }, [idleDelayMs]);

  return busy;
}
