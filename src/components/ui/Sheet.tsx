import React, { useEffect, useState } from "react";
import { XIcon } from "./Icons";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  autoCloseSeconds?: number;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  autoCloseSeconds,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Auto-close timer
  useEffect(() => {
    if (!isOpen || !autoCloseSeconds) {
      setSecondsLeft(null);
      return;
    }

    setSecondsLeft(autoCloseSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          onClose();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoCloseSeconds, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(2px)",
          animation: "sheet-fade-in 200ms ease forwards",
        }}
      />

      {/* Sheet Content Card */}
      <div
        style={{
          position: "relative",
          zIndex: 101,
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
          borderTopLeftRadius: "var(--radius-md)",
          borderTopRightRadius: "var(--radius-md)",
          borderTop: "1px solid var(--border)",
          boxShadow: "var(--shadow-sheet)",
          padding: "var(--space-4) var(--space-6)",
          paddingBottom: "max(var(--space-6), var(--safe-bottom))",
          animation: "sheet-slide-up var(--duration-sheet) var(--ease-ios) forwards",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* iOS Drag Handle */}
        <div
          style={{
            width: "36px",
            height: "5px",
            borderRadius: "999px",
            backgroundColor: "var(--border)",
            margin: "0 auto var(--space-4) auto",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "var(--space-3)",
          }}
        >
          <div>
            {title && (
              <h2
                style={{
                  fontSize: "var(--font-card-title)",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                style={{
                  fontSize: "var(--font-caption)",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                {description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {secondsLeft !== null && (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  backgroundColor: "var(--surface)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                }}
              >
                Tutup {secondsLeft}d
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup lembar"
              style={{
                padding: "6px",
                borderRadius: "var(--radius-full)",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ marginTop: "var(--space-2)" }}>{children}</div>
      </div>

      <style>{`
        @keyframes sheet-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

