"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import {
  BaseGroupedList,
  InfoRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { useLocale } from "@/components/locale-provider";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { apiInvalidateCache } from "@/lib/api";

type SessionItem = {
  tokenMask: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isExpired: boolean;
};

type SessionListResponse = {
  items: SessionItem[];
};

function formatDateTime(value: string, locale: "ko" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsAccountPage() {
  const { locale } = useLocale();
  const { confirm, alert } = useAppDialog();
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/sessions", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<
        SessionListResponse & { error?: string }
      >;
      if (!response.ok) {
        throw new Error(payload.error ?? `failed (${response.status})`);
      }
      setSessions(payload.items ?? []);
    } catch (e: any) {
      setError(
        e?.message ??
          (locale === "ko"
            ? "세션 목록을 불러오지 못했습니다."
            : "Failed to load sessions."),
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const otherSessionCount = sessions
    ? sessions.filter((s) => !s.isCurrent && !s.isExpired).length
    : 0;

  const runRevokeOthers = async () => {
    const confirmed = await confirm({
      title: locale === "ko" ? "다른 세션 종료" : "Revoke Other Sessions",
      message:
        locale === "ko"
          ? `현재 기기를 제외한 활성 세션 ${otherSessionCount}개를 즉시 종료합니다. 다른 기기에서는 다시 로그인해야 합니다.`
          : `${otherSessionCount} active sessions on other devices will be terminated immediately. Those devices must sign in again.`,
      confirmText: locale === "ko" ? "종료" : "Revoke",
      cancelText: locale === "ko" ? "취소" : "Cancel",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setRevoking(true);
      setError(null);
      setNotice(null);
      const response = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        revoked?: number | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `failed (${response.status})`);
      }
      setNotice(
        locale === "ko"
          ? `다른 세션 ${payload.revoked ?? 0}개를 종료했습니다.`
          : `Revoked ${payload.revoked ?? 0} other sessions.`,
      );
      void loadSessions();
    } catch (e: any) {
      setError(
        e?.message ??
          (locale === "ko" ? "세션 종료에 실패했습니다." : "Failed to revoke sessions."),
      );
    } finally {
      setRevoking(false);
    }
  };

  const runDeleteAccount = async () => {
    if (!deletePassword) {
      setError(
        locale === "ko"
          ? "비밀번호를 입력하세요."
          : "Enter your password.",
      );
      return;
    }
    const confirmed = await confirm({
      title: locale === "ko" ? "계정 삭제" : "Delete Account",
      message:
        locale === "ko"
          ? "계정과 운동 기록, 세트, 플랜, 커스텀 템플릿이 영구 삭제됩니다.\n\n이 작업은 복구할 수 없습니다. 계속하시겠습니까?"
          : "Your account and all logs, sets, plans, and custom templates will be permanently deleted.\n\nThis action cannot be undone. Continue?",
      confirmText: locale === "ko" ? "삭제" : "Delete",
      cancelText: locale === "ko" ? "취소" : "Cancel",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setDeleting(true);
      setError(null);
      setNotice(null);
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmToken: "DELETE_MY_ACCOUNT",
          password: deletePassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `failed (${response.status})`);
      }
      apiInvalidateCache();
      await alert({
        title: locale === "ko" ? "삭제 완료" : "Deleted",
        message:
          locale === "ko"
            ? "계정이 삭제되었습니다. 로그인 화면으로 이동합니다."
            : "Your account has been deleted. Returning to the sign-in screen.",
      });
      router.replace("/login");
    } catch (e: any) {
      setError(
        e?.message ??
          (locale === "ko" ? "계정 삭제에 실패했습니다." : "Failed to delete account."),
      );
      await alert({
        title: locale === "ko" ? "삭제 실패" : "Delete Failed",
        message:
          e?.message ??
          (locale === "ko"
            ? "계정 삭제에 실패했습니다."
            : "Failed to delete the account."),
        tone: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <NoticeStateRows
        message={notice}
        tone="success"
        label={locale === "ko" ? "완료" : "Done"}
      />
      <NoticeStateRows
        message={error}
        tone="warning"
        label={locale === "ko" ? "오류" : "Error"}
      />

      <section>
        <SectionHeader
          title={locale === "ko" ? "활성 세션" : "Active Sessions"}
          description={
            locale === "ko"
              ? "현재 계정에 로그인된 기기/브라우저 목록입니다. 의심스러운 세션이 있으면 다른 세션을 모두 종료하세요."
              : "Devices and browsers currently signed in to your account. If you see anything suspicious, revoke all other sessions."
          }
        />
        {loading && !sessions ? (
          <SectionFootnote>
            {locale === "ko" ? "불러오는 중..." : "Loading..."}
          </SectionFootnote>
        ) : null}
        {sessions && sessions.length > 0 ? (
          <BaseGroupedList
            ariaLabel={locale === "ko" ? "세션 목록" : "Session list"}
          >
            {sessions.map((session) => (
              <InfoRow
                key={session.tokenMask + session.createdAt}
                label={
                  session.isCurrent
                    ? locale === "ko"
                      ? "현재 세션"
                      : "Current session"
                    : session.tokenMask
                }
                description={
                  locale === "ko"
                    ? `생성: ${formatDateTime(session.createdAt, locale)} · 만료: ${formatDateTime(session.expiresAt, locale)}`
                    : `Created: ${formatDateTime(session.createdAt, locale)} · Expires: ${formatDateTime(session.expiresAt, locale)}`
                }
                value={
                  session.isExpired
                    ? locale === "ko"
                      ? "만료됨"
                      : "Expired"
                    : session.isCurrent
                      ? locale === "ko"
                        ? "현재"
                        : "Current"
                      : locale === "ko"
                        ? "활성"
                        : "Active"
                }
                tone={
                  session.isCurrent
                    ? "neutral"
                    : session.isExpired
                      ? "neutral"
                      : "neutral"
                }
              />
            ))}
          </BaseGroupedList>
        ) : sessions && sessions.length === 0 ? (
          <SectionFootnote>
            {locale === "ko"
              ? "활성 세션이 없습니다."
              : "No active sessions."}
          </SectionFootnote>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-full"
          style={{ marginTop: "var(--space-sm)" }}
          onClick={() => {
            void runRevokeOthers();
          }}
          disabled={revoking || otherSessionCount === 0}
        >
          {revoking
            ? locale === "ko"
              ? "종료 중..."
              : "Revoking..."
            : otherSessionCount > 0
              ? locale === "ko"
                ? `다른 세션 모두 종료 (${otherSessionCount})`
                : `Revoke All Other Sessions (${otherSessionCount})`
              : locale === "ko"
                ? "다른 세션 없음"
                : "No Other Sessions"}
        </button>
        <SectionFootnote>
          {locale === "ko"
            ? "현재 기기의 세션은 유지되며, 다른 기기에서는 다시 로그인이 필요합니다."
            : "Your current session is preserved; other devices must sign in again."}
        </SectionFootnote>
      </section>

      <section>
        <SectionHeader
          title={locale === "ko" ? "계정 삭제" : "Delete Account"}
          description={
            locale === "ko"
              ? "계정과 본인 데이터를 영구 삭제합니다. 공용 운동 카탈로그는 보존됩니다."
              : "Permanently delete your account and personal data. The shared exercise catalog is preserved."
          }
        />
        <BaseGroupedList
          ariaLabel={locale === "ko" ? "삭제 범위" : "Deletion scope"}
        >
          <InfoRow
            label={
              locale === "ko" ? "삭제되는 데이터" : "Data Removed"
            }
            description={
              locale === "ko"
                ? "운동 기록, 세트, 플랜, 커스텀 템플릿, 인증 토큰, 비밀번호 재설정 토큰, 이메일 인증 토큰"
                : "Workout logs, sets, plans, custom templates, auth sessions, reset and verification tokens"
            }
            value={locale === "ko" ? "전체" : "All"}
            tone="critical"
          />
          <InfoRow
            label={locale === "ko" ? "보존되는 데이터" : "Data Preserved"}
            description={
              locale === "ko"
                ? "공용 운동 카탈로그, 다른 사용자의 데이터"
                : "Shared exercise catalog, other users' data"
            }
            value={locale === "ko" ? "공용" : "Shared"}
            tone="neutral"
          />
        </BaseGroupedList>
        <label
          style={{
            display: "block",
            marginTop: "var(--space-sm)",
            fontFamily: "var(--font-label-family)",
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {locale === "ko"
            ? "본인 확인용 현재 비밀번호"
            : "Current password (required)"}
          <input
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder={locale === "ko" ? "비밀번호" : "Password"}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-container)",
              color: "var(--color-text)",
              font: "inherit",
              boxSizing: "border-box",
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-danger btn-full"
          style={{ marginTop: "var(--space-sm)" }}
          onClick={() => {
            void runDeleteAccount();
          }}
          disabled={deleting || !deletePassword}
        >
          {deleting
            ? locale === "ko"
              ? "삭제 중..."
              : "Deleting..."
            : locale === "ko"
              ? "계정 삭제"
              : "Delete Account"}
        </button>
        <SectionFootnote>
          {locale === "ko"
            ? "이 작업은 복구할 수 없습니다. 비밀번호 재확인 후에만 진행됩니다."
            : "This action cannot be undone. You will be asked to re-enter your password."}
        </SectionFootnote>
      </section>
    </div>
  );
}
