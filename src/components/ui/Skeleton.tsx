import React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "24px",
  borderRadius = "var(--radius-sm)",
  style,
  className = "",
}) => {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "var(--surface)",
        animation: "skeleton-shimmer 1.8s ease-in-out infinite",
        ...style,
      }}
    >
      <style>{`
        @keyframes skeleton-shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 0.9; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

