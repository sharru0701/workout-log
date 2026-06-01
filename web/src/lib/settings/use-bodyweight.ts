"use client";

import { useEffect, useState } from "react";
import { fetchSettingsSnapshot } from "./settings-api";
import { readWorkoutPreferences } from "./workout-preferences";

/**
 * 사용자 체중(prefs.bodyweight.kg)을 읽는 공용 클라이언트 훅.
 * 맨몸 운동 총무게 표기(추가중량 병기)에 필요. apiGet(SWR 캐시) 기반이라
 * 화면마다 호출해도 중복 요청은 캐시로 합쳐진다. 미설정이면 null.
 */
export function useBodyweightKg(): number | null {
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSettingsSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setBodyweightKg(readWorkoutPreferences(snapshot).bodyweightKg);
      })
      .catch(() => {
        // 설정 로드 실패 시 병기 없이 진행 (총무게 환산 생략).
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return bodyweightKg;
}
