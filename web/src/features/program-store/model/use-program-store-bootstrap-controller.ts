import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, isAbortError } from "@/lib/api";
import type { ProgramTemplate } from "@/lib/program-store/model";
import type {
  ExerciseOption,
  ExerciseResponse,
  PlanItem,
  PlansResponse,
  ProgramStoreQueryState,
  TemplatesResponse,
} from "./types";

function readSearchQueryFromLocation(): ProgramStoreQueryState {
  if (typeof window === "undefined") {
    return {
      detail: "",
      customize: "",
      create: "",
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    detail: params.get("detail") ?? "",
    customize: params.get("customize") ?? "",
    create: params.get("create") ?? "",
  };
}

function replaceAbortController(ref: { current: AbortController | null }) {
  ref.current?.abort();
  const controller = new AbortController();
  ref.current = controller;
  return controller;
}

type UseProgramStoreBootstrapControllerInput = {
  locale: "ko" | "en";
  setTemplates: React.Dispatch<React.SetStateAction<ProgramTemplate[]>>;
  setPlans: React.Dispatch<React.SetStateAction<PlanItem[]>>;
  setExerciseOptions: React.Dispatch<React.SetStateAction<ExerciseOption[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useProgramStoreBootstrapController({
  locale,
  setTemplates,
  setPlans,
  setExerciseOptions,
  setError,
}: UseProgramStoreBootstrapControllerInput) {
  const [loading, setLoading] = useState(true);
  const [storeLoadKey, setStoreLoadKey] = useState("program-store:init");
  const [exerciseOptionsLoading, setExerciseOptionsLoading] = useState(false);
  const [queryState, setQueryState] = useState<ProgramStoreQueryState>(() =>
    readSearchQueryFromLocation(),
  );

  const storeLoadControllerRef = useRef<AbortController | null>(null);
  const storeHasLoadedRef = useRef(false);
  const exerciseOptionsControllerRef = useRef<AbortController | null>(null);

  const loadStore = useCallback(
    async (options?: { isRefresh?: boolean }) => {
      const controller = replaceAbortController(storeLoadControllerRef);
      try {
        if (!storeHasLoadedRef.current && !options?.isRefresh) {
          setLoading(true);
        }
        setError(null);
        setStoreLoadKey(`program-store:${Date.now()}`);
        const [templatesRes, plansRes] = await Promise.all([
          apiGet<TemplatesResponse>("/api/templates?limit=200", {
            signal: controller.signal,
          }),
          apiGet<PlansResponse>("/api/plans", {
            signal: controller.signal,
          }),
        ]);
        if (storeLoadControllerRef.current !== controller) return;
        storeHasLoadedRef.current = true;
        setTemplates(templatesRes.items ?? []);
        setPlans(plansRes.items ?? []);
      } catch (error: any) {
        if (isAbortError(error) || storeLoadControllerRef.current !== controller) {
          return;
        }
        setError(
          error?.message ??
            (locale === "ko"
              ? "프로그램 데이터를 불러오지 못했습니다."
              : "Could not load program data."),
        );
      } finally {
        if (storeLoadControllerRef.current === controller) {
          storeLoadControllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [locale, setError, setPlans, setTemplates],
  );

  const loadExerciseOptions = useCallback(async () => {
    const controller = replaceAbortController(exerciseOptionsControllerRef);
    try {
      setExerciseOptionsLoading(true);
      const response = await apiGet<ExerciseResponse>("/api/exercises?limit=250", {
        signal: controller.signal,
      });
      if (exerciseOptionsControllerRef.current !== controller) return;
      setExerciseOptions(response.items ?? []);
    } catch (error) {
      if (
        isAbortError(error) ||
        exerciseOptionsControllerRef.current !== controller
      ) {
        return;
      }
      setExerciseOptions([]);
    } finally {
      if (exerciseOptionsControllerRef.current === controller) {
        exerciseOptionsControllerRef.current = null;
        setExerciseOptionsLoading(false);
      }
    }
  }, [setExerciseOptions]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    void loadExerciseOptions();
  }, [loadExerciseOptions]);

  useEffect(() => {
    return () => {
      storeLoadControllerRef.current?.abort();
      exerciseOptionsControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setQueryState(readSearchQueryFromLocation());
    const onPopState = () => {
      setQueryState(readSearchQueryFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return {
    loading,
    storeLoadKey,
    exerciseOptionsLoading,
    queryState,
    loadStore,
  };
}
