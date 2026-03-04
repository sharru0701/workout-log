"use client";

import { useEffect, useState } from "react";

export function useQuerySettled(queryKey: string | null, loading: boolean) {
  const [settledKey, setSettledKey] = useState<string | null>(null);

  useEffect(() => {
    if (!queryKey) {
      setSettledKey(null);
      return;
    }
    if (!loading) {
      setSettledKey(queryKey);
    }
  }, [loading, queryKey]);

  return queryKey !== null && settledKey === queryKey;
}
