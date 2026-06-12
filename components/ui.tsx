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

/** Joined single-choice control, e.g. [ $ | $$ | $$$ | $$$$ ]. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: React.ReactNode; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-border-soft bg-surface-2">
      {options.map((opt, i) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-2 text-sm transition ${
            i > 0 ? "border-l border-border-soft" : ""
          } ${
            opt.value === value
              ? "bg-accent font-bold text-black"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
