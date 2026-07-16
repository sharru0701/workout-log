"use client";

import type { CSSProperties } from "react";

/**
 * V2Icon — Material Symbols 아이콘 렌더의 단일 진입점.
 *
 * fill/weight를 모두 생략하면 fontVariationSettings를 출력하지 않아,
 * 기존에 variation을 지정하지 않던 span들의 기본값을 그대로 보존한다.
 */
export function V2Icon({
  name,
  style,
  fill,
  weight,
  className,
}: {
  name: string;
  style?: CSSProperties;
  fill?: boolean;
  weight?: number;
  className?: string;
}) {
  const hasVariation = fill !== undefined || weight !== undefined;
  return (
    <span
      className={["material-symbols-outlined", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...(hasVariation
          ? {
              fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight ?? 400}`,
            }
          : {}),
        ...style,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
