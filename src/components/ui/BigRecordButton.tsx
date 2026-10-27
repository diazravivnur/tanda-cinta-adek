import React from "react";
import { PlayIcon, SquareIcon } from "./Icons";

export interface BigRecordButtonProps {
  status: "idle" | "running";
  onClick: () => void;
  disabled?: boolean;
  sublabel?: string;
}

export const BigRecordButton: React.FC<BigRecordButtonProps> = ({
  status,
  onClick,
  disabled = false,
  sublabel,
}) => {
  const isRunning = status === "running";

  const buttonStyle: React.CSSProperties = {
    position: "relative",
    width: "230px",
    height: "230px",
    borderRadius: "var(--radius-full)",
    backgroundColor: isRunning ? "var(--danger)" : "var(--primary)",
    color: isRunning ? "var(--danger-text)" : "var(--primary-text)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition:
      "transform var(--duration-press) var(--ease-ios), background-color var(--duration-transition) ease",
    boxShadow: isRunning
      ? "0 0 0 6px var(--danger-surface), var(--shadow-sheet)"
      : "0 0 0 6px var(--primary-surface), var(--shadow-button)",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div style={{ position: "relative", display: "inline-block", padding: "16px" }}>
      {/* Cincin denyut halus saat timer kontraksi berjalan */}
      {isRunning && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "var(--radius-full)",
            border: "2px solid var(--danger)",
            animation: "pulse-ring 2.4s cubic-bezier(0.2, 0, 0, 1) infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={isRunning ? "Selesaikan pencatatan kontraksi" : "Mulai pencatatan kontraksi"}
        style={buttonStyle}
        onMouseDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onTouchStart={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span style={{ marginBottom: "8px", opacity: 0.95 }}>
          {isRunning ? <SquareIcon size={36} /> : <PlayIcon size={36} />}
        </span>

        <span
          style={{
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {isRunning ? "Selesai" : "Mulai"}
        </span>

        {sublabel && (
          <span
            style={{
              marginTop: "8px",
              fontSize: "13px",
              fontWeight: 500,
              opacity: 0.85,
              maxWidth: "160px",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {sublabel}
          </span>
        )}
      </button>

      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.96);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.2;
          }
          100% {
            transform: scale(1.16);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

