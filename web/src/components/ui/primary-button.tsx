import type { ElementType } from "react";
import { Button, type ButtonProps } from "./button";

export type PrimaryButtonProps<T extends ElementType = "button"> = ButtonProps<T> & {
  interactive?: boolean;
};

export function PrimaryButton<T extends ElementType = "button">({
  interactive = true,
  ...props
}: PrimaryButtonProps<T>) {
  void interactive;
  return <Button {...(props as ButtonProps<T>)} />;
}
