import React from "react";
import { AlertTriangleIcon, InfoIcon, WifiOffIcon, XIcon } from "./Icons";

export type BannerVariant = "info" | "warn" | "danger" | "offline";

export interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

export const Banner: React.FC<BannerProps> = ({
  variant = "info",
  title,
  message,
  action,
  onDismiss,
}) => {
  const getStyles = () => {
    switch (variant) {
      case "danger":
        return {
          bg: "var(--danger-surface)",
          border: "var(--danger-border)",
          color: "var(--danger)",
          icon: <AlertTriangleIcon size={20} />,
        };
      case "warn":
        return {
          bg: "var(--warn-surface)",
          border: "var(--warn-border)",
          color: "var(--warn)",
          icon: <AlertTriangleIcon size={20} />,
        };
      case "offline":
        return {
          bg: "var(--surface-2)",
          border: "var(--border)",
          color: "var(--text-muted)",
          icon: <WifiOffIcon size={20} />,
        };
      case "info":
      default:
        return {
          bg: "var(--surface)",
          border: "var(--border)",
          color: "var(--primary)",
          icon: <InfoIcon size={20} />,
        };
    }
  };

  const current = getStyles();

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        color: "var(--text)",
        fontSize: "var(--font-caption)",
        lineHeight: 1.4,
        position: "relative",
      }}
    >
      <span style={{ color: current.color, flexShrink: 0, marginTop: "2px" }}>
        {current.icon}
      </span>

      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: "2px", color: current.color }}>
            {title}
          </div>
        )}
        <div style={{ color: "var(--text)", opacity: 0.9 }}>{message}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              marginTop: "6px",
              fontWeight: 600,
              color: current.color,
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          style={{
            padding: "4px",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <XIcon size={18} />
        </button>
      )}
    </div>
  );
};
