import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "default",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  style,
  className = "",
  ...props
}) => {
  const isSm = size === "sm";

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: "var(--primary)",
          color: "var(--primary-text)",
          border: "1px solid var(--primary-border, transparent)",
          boxShadow: "var(--shadow-button)",
        };
      case "secondary":
        return {
          backgroundColor: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        };
      case "danger":
        return {
          backgroundColor: "var(--danger)",
          color: "var(--danger-text)",
          border: "1px solid var(--danger-border, transparent)",
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          color: "var(--text)",
          border: "1px solid transparent",
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    width: fullWidth ? "100%" : "auto",
    minHeight: isSm ? "44px" : "56px",
    padding: isSm ? "8px 16px" : "16px 24px",
    borderRadius: "var(--radius-sm)",
    fontSize: isSm ? "var(--font-caption)" : "var(--font-body)",
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "center",
    textDecoration: "none",
    transition: "transform var(--duration-press) var(--ease-ios), opacity var(--duration-transition) ease",
    opacity: disabled || loading ? 0.45 : 1,
    pointerEvents: disabled || loading ? "none" : "auto",
    ...getVariantStyles(),
    ...style,
  };

  return (
    <button
      disabled={disabled || loading}
      style={baseStyle}
      className={`btn-interactive ${className}`}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "scale(0.98)";
        }
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onTouchStart={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "scale(0.98)";
        }
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      {...props}
    >
      {loading ? (
        <span>Memproses...</span>
      ) : (
        <>
          {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

