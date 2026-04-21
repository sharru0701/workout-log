import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export type ButtonProps<T extends ElementType = "button"> = ButtonOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | "as">;

export function Button<T extends ElementType = "button">({
  as,
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  ...props
}: ButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;
  const resolvedClassName = cx(
    "btn",
    variant && `btn-${variant}`,
    size && `btn-${size}`,
    fullWidth && "btn-full",
    className,
  );

  if (Component === "button") {
    const buttonProps = props as ComponentPropsWithoutRef<"button">;
    const { type = "button", ...restButtonProps } = buttonProps;

    return (
      <button type={type} className={resolvedClassName} {...restButtonProps}>
        {children}
      </button>
    );
  }

  return (
    <Component className={resolvedClassName} {...props}>
      {children}
    </Component>
  );
}
