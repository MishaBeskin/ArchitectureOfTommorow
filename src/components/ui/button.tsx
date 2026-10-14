import type { ComponentProps } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";
import { Spinner } from "./spinner";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and sets aria-busy. Keep the label meaningful ("Saving…"). */
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  type = "button",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
