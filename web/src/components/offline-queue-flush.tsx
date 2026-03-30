"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { getPendingCount, getPendingMutations, removeMutation } from "@/lib/offline-queue";
import { apiInvalidateCache } from "@/lib/api";

/**
 * 백그라운드에서 오프라인 큐를 처리하는 invisible 컴포넌트.
 * - 마운트 시, 그리고 online 이벤트마다 대기 중인 뮤테이션을 FIFO 순서로 전송.
 * - 성공한 항목은 큐에서 제거하고 인메모리 캐시를 무효화.
 * - 4xx 응답: 재시도 불가 → 즉시 제거.
 * - 5xx / 네트워크 오류: 재연결 시 재시도.
 * - 동기화 상태는 offline-indicator와 공유하는 DOM 이벤트로 전파.
 */
export function OfflineQueueFlush() {
  const { locale } = useLocale();
  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [justFlushed, setJustFlushed] = useState(false);
  const isBusy = useRef(false);
  const justFlushedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const flushQueue = useCallback(async () => {
    if (isBusy.current || !navigator.onLine) return;
    isBusy.current = true;

    const initial = await getPendingCount();
    if (initial === 0) {
      isBusy.current = false;
      return;
    }

    setIsFlushing(true);
    let flushedAny = false;

    try {
      const mutations = await getPendingMutations();
      for (const mutation of mutations) {
        try {
          const res = await fetch(mutation.path, {
            method: mutation.method,
            headers: { "content-type": "application/json", ...mutation.headers },
            body: mutation.body !== undefined ? JSON.stringify(mutation.body) : undefined,
          });

          if (res.ok) {
            await removeMutation(mutation.id);
            flushedAny = true;
            // 재연결 후 최신 데이터를 가져올 수 있도록 인메모리 캐시 무효화
            if (mutation.invalidateCache) {
              if (mutation.invalidateCachePrefixes?.length) {
                for (const prefix of mutation.invalidateCachePrefixes) {
                  apiInvalidateCache(prefix);
                }
              } else {
                apiInvalidateCache();
              }
            }
          } else if (res.status >= 400 && res.status < 500) {
            // 클라이언트 오류(충돌, 유효성 검사 실패 등) → 재시도 불가, 큐에서 제거
            await removeMutation(mutation.id);
          }
          // 5xx: 큐에 유지, 다음 재연결 시 재시도
        } catch {
          // 여전히 오프라인 → 처리 중단
          break;
        }
      }
    } finally {
      isBusy.current = false;
      setIsFlushing(false);
      const remaining = await getPendingCount();
      setPendingCount(remaining);
      if (flushedAny) {
        setJustFlushed(true);
        clearTimeout(justFlushedTimer.current);
        justFlushedTimer.current = setTimeout(() => setJustFlushed(false), 2500);
      }
    }
  }, []);

  useEffect(() => {
    void refreshCount();

    const handleOnline = () => void flushQueue();
    window.addEventListener("online", handleOnline);

    // 페이지 로드 시 이미 온라인이면 대기 큐 즉시 처리
    if (navigator.onLine) void flushQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      clearTimeout(justFlushedTimer.current);
    };
  }, [flushQueue, refreshCount]);

  // 대기 항목이 없고 방금 완료된 상태도 아니면 렌더링하지 않음
  if (pendingCount === 0 && !isFlushing && !justFlushed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`offline-sync-bar ${justFlushed && !isFlushing ? "offline-sync-bar--done" : ""}`}
    >
      {isFlushing && (locale === "ko" ? `저장된 요청 ${pendingCount}개 전송 중...` : `Sending ${pendingCount} queued request(s)...`)}
      {!isFlushing && justFlushed && (locale === "ko" ? "동기화 완료" : "Sync complete")}
      {!isFlushing && !justFlushed && pendingCount > 0 &&
        (locale === "ko" ? `오프라인 저장된 요청 ${pendingCount}개` : `${pendingCount} request(s) saved offline`)}
    </div>
  );
}
