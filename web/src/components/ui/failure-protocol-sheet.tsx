"use client";

import { BottomSheet } from "./bottom-sheet";
import { Card, CardContent } from "./card";

export type FailureProtocolChoice = "cancel" | "hold" | "reset" | "increase";

type FailureProtocolSheetProps = {
  open: boolean;
  title: string;
  message: string;
  /** block-completion: Operator 블록 완료 / greyskull-reset: Greyskull 리셋 기준 도달 */
  mode: "block-completion" | "greyskull-reset";
  onSelect: (choice: FailureProtocolChoice) => void;
};

export function FailureProtocolSheet({
  open,
  title,
  message,
  mode,
  onSelect,
}: FailureProtocolSheetProps) {
  const isBlockCompletion = mode === "block-completion";

  return (
    <BottomSheet
      open={open}
      title={title}
      description=""
      onClose={() => onSelect("cancel")}
      closeLabel="닫기"
      footer={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
            width: "100%",
          }}
        >
          {isBlockCompletion ? (
            <>
              <button type="button" className="btn btn-primary btn-full" onClick={() => onSelect("increase")}>
                증량하여 저장
              </button>
              <button type="button" className="btn btn-secondary btn-full" onClick={() => onSelect("hold")}>
                유지하여 저장
              </button>
              <button type="button" className="btn btn-danger btn-full" onClick={() => onSelect("reset")}>
                감소하여 저장
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-danger btn-full" onClick={() => onSelect("reset")}>
                감소 적용하여 저장
              </button>
              <button type="button" className="btn btn-secondary btn-full" onClick={() => onSelect("hold")}>
                무게 유지하여 저장
              </button>
              <button type="button" className="btn btn-secondary btn-full" onClick={() => onSelect("increase")}>
                무게 증가하여 저장
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary btn-full" onClick={() => onSelect("cancel")}>
            취소
          </button>
        </div>
      }
    >
      <Card tone={mode === "greyskull-reset" ? "danger" : "subtle"} padding="md" elevated={false}>
        <CardContent>
          <p style={{ whiteSpace: "pre-line" }}>{message}</p>
        </CardContent>
      </Card>
    </BottomSheet>
  );
}
