import React from "react";
import type { PatternStatus } from "../../types";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
} from "./Icons";

export interface StatusBadgeProps {
  status: PatternStatus;
  subtext?: string;
  size?: "default" | "sm";
}

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  color: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  subtext,
  size = "default",
}) => {
  const isSm = size === "sm";

  const getStatusConfig = (): StatusConfig => {
    switch (status) {
      case "ACTIVE_511":
        return {
          label: "Pola 5-1-1 Terpenuhi",
          icon: <AlertTriangleIcon size={isSm ? 16 : 18} />,
          bg: "var(--danger-surface)",
          border: "var(--danger-border)",
          color: "var(--danger)",
        };
      case "REGULAR":
        return {
          label: "Mulai Teratur",
          icon: <CheckCircleIcon size={isSm ? 16 : 18} />,
          bg: "var(--warn-surface)",
          border: "var(--warn-border)",
          color: "var(--warn)",
        };
      case "IRREGULAR":
        return {
          label: "Belum Teratur",
          icon: <ActivityIcon size={isSm ? 16 : 18} />,
          bg: "var(--surface-2)",
          border: "var(--border)",
          color: "var(--text-muted)",
        };
      case "INSUFFICIENT":
      default:
        return {
          label: "Mengumpulkan Data",
          icon: <InfoIcon size={isSm ? 16 : 18} />,
          bg: "var(--surface)",
          border: "var(--border)",
          color: "var(--text-muted)",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: isSm ? "4px 10px" : "8px 14px",
        borderRadius: "var(--radius-full)",
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: isSm ? "13px" : "15px",
        fontWeight: 600,
        lineHeight: 1.2,
      }}
    >
      <span style={{ display: "inline-flex", color: config.color }}>{config.icon}</span>
      <span>{config.label}</span>
      {subtext && (
        <span
          style={{
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: isSm ? "12px" : "13px",
            marginLeft: "4px",
          }}
        >
          • {subtext}
        </span>
      )}
    </div>
  );
};

