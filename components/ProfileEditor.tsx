"use client";

import { useState } from "react";
import { Profile } from "@/lib/types";

export const PROFILE_EMOJI = [
  "😀", "😎", "🥳", "🤠", "🤓", "😇",
  "🦊", "🐻", "🐼", "🐸", "🦄", "🐯",
  "🦁", "🐨", "🐷", "🐙", "🦖", "🐢",
  "🦋", "🐝", "🦉", "🐬", "🦈", "🐺",
  "🍕", "🌮", "🍣", "🍜", "🍩", "🧁",
  "🍓", "🥑", "🍔", "⚽", "🎸", "🚀",
];

export const PROFILE_COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#ef4444",
];

/** Add/edit a family member: tap an emoji, tap a color, see it live. */
export function ProfileEditor({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Pick<Profile, "name" | "emoji" | "color">;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? PROFILE_EMOJI[0]);
  const [color, setColor] = useState(initial?.color ?? PROFILE_COLORS[0]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="color" value={color} />

      {/* live preview */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-4xl ring-2 ring-white/25"
          style={{ backgroundColor: color }}
        >
          {emoji}
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-lg outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Pick a face
        </span>
        <div className="grid grid-cols-6 gap-1.5">
          {PROFILE_EMOJI.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${
                emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Pick a color
        </span>
        <div className="flex gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-9 flex-1 rounded-xl transition ${
                color === c ? "ring-2 ring-white" : "opacity-70"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!name.trim()}
        className="rounded-xl bg-accent px-4 py-2.5 font-bold text-black disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
