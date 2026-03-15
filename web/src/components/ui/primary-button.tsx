import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PillButtonVariant = "primary" | "secondary";
type PillButtonSize = "md" | "lg";

type PrimaryButtonOwnProps = {
  children: ReactNode;
  className?: string;
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  fullWidth?: boolean;
  interactive?: boolean;
};

type PrimaryButtonProps<T extends ElementType = "button"> = PrimaryButtonOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof PrimaryButtonOwnProps | "as">;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PrimaryButton<T extends ElementType = "button">({
  as,
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  interactive = true,
  ...props
}: PrimaryButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;
  const resolvedClassName = cx(
    interactive && "haptic-tap",
    "app-pill-button",
    interactive && "app-pill-button--interactive",
    variant === "primary" && "ui-primary-button",
    `app-pill-button--${variant}`,
    `app-pill-button--${size}`,
    fullWidth && "app-pill-button--full",
    className,
  );

  if (Component === "button") {
    const buttonProps = props as ComponentPropsWithoutRef<"button">;
    const { type = "button", ...restButtonProps } = buttonProps;
    return (
      <button type={type} {...restButtonProps}>
        {children}
      </button>
    );
  }

  return (
    <Component {...props}>
      {children}
    </Component>
  );
}
