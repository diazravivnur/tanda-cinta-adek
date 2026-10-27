import React from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8) var(--space-4)",
        textAlign: "center",
        color: "var(--text-muted)",
      }}
    >
      {/* Ilustrasi Garis Sederhana 2-Warna Token */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        {icon ? (
          icon
        ) : (
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="var(--border)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {/* Bentuk gelombang denyut lembut (kontraksi yang tenang) */}
            <path
              d="M20 40H28L34 30L40 50L46 36L52 40H60"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <h3
        style={{
          fontSize: "var(--font-card-title)",
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: "var(--space-2)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "var(--font-caption)",
          maxWidth: "280px",
          lineHeight: 1.4,
          marginBottom: action ? "var(--space-4)" : 0,
        }}
      >
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: "var(--space-4)",
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontSize: "var(--font-caption)",
            fontWeight: 600,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

