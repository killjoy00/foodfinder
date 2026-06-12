"use client";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-accent bg-accent-soft font-semibold text-orange-200"
          : "border-border-soft bg-surface-2 text-muted"
      }`}
    >
      {children}
    </button>
  );
}
