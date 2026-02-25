"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBrowserSettingStore,
  type PersistSettingFn,
  resolveSettingInitialValue,
  type SettingStore,
  type SettingValue,
  updateSetting,
} from "./update-setting";

type UseSettingRowMutationOptions<T extends SettingValue> = {
  key: string;
  fallbackValue: T;
  serverValue?: T;
  store?: SettingStore;
  persistServer: PersistSettingFn<T>;
  successMessage?: string;
  rollbackNotice?: string;
  errorToMessage?: (error: unknown) => string;
  noticeTtlMs?: number;
};

type CommitIgnored = {
  ignored: true;
};

type CommitCompleted<T extends SettingValue> = {
  ignored: false;
  ok: boolean;
  value: T;
  message: string | null;
};

type CommitResult<T extends SettingValue> = CommitIgnored | CommitCompleted<T>;

type UseSettingRowMutationReturn<T extends SettingValue> = {
  value: T;
  pending: boolean;
  error: string | null;
  notice: string | null;
  setNotice: (next: string | null) => void;
  commit: (nextValue: T) => Promise<CommitResult<T>>;
};

const DEFAULT_NOTICE_TTL_MS = 2200;

export function useSettingRowMutation<T extends SettingValue>({
  key,
  fallbackValue,
  serverValue,
  store: storeFromProps,
  persistServer,
  successMessage = "변경사항을 저장했습니다.",
  rollbackNotice = "저장 실패로 이전 값으로 되돌렸습니다.",
  errorToMessage,
  noticeTtlMs = DEFAULT_NOTICE_TTL_MS,
}: UseSettingRowMutationOptions<T>): UseSettingRowMutationReturn<T> {
  const store = useMemo(() => storeFromProps ?? createBrowserSettingStore(), [storeFromProps]);
  const resolvedServerValue = (serverValue ?? fallbackValue) as T;

  const [value, setValue] = useState<T>(() =>
    resolveSettingInitialValue<T>({
      key,
      store,
      serverValue: resolvedServerValue,
      fallbackValue,
    }),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const valueRef = useRef(value);
  const hadCachedAtInitRef = useRef(store.read(key) !== undefined);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (hadCachedAtInitRef.current) return;
    if (pending) return;
    setValue(resolvedServerValue);
    valueRef.current = resolvedServerValue;
  }, [pending, resolvedServerValue]);

  useEffect(() => {
    if (!notice) return;
    if (noticeTtlMs <= 0) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, noticeTtlMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, noticeTtlMs]);

  const commit = useCallback(
    async (nextValue: T): Promise<CommitResult<T>> => {
      if (pending) {
        return { ignored: true };
      }

      setPending(true);
      setError(null);
      setNotice(null);

      const result = await updateSetting<T>({
        key,
        nextValue,
        getCurrentValue: () => valueRef.current,
        applyValue: (next) => {
          valueRef.current = next;
          setValue(next);
        },
        store,
        persistServer,
        errorToMessage,
      });

      setPending(false);

      if (result.ok) {
        setNotice(successMessage);
        return {
          ignored: false,
          ok: true,
          value: result.value,
          message: successMessage,
        };
      }

      setError(result.message);
      setNotice(rollbackNotice);
      return {
        ignored: false,
        ok: false,
        value: result.value,
        message: result.message,
      };
    },
    [errorToMessage, key, pending, persistServer, rollbackNotice, store, successMessage],
  );

  return {
    value,
    pending,
    error,
    notice,
    setNotice,
    commit,
  };
}

export type {
  UseSettingRowMutationOptions,
  UseSettingRowMutationReturn,
  CommitResult,
  CommitIgnored,
  CommitCompleted,
};

