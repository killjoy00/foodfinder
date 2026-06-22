"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/actions";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(changePasswordAction, null);
  const inputCls =
    "rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start text-sm text-accent underline"
      >
        Change group password →
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted">Set a new group password</p>
      <input type="password" name="password" placeholder="New password" required className={inputCls} />
      <input
        type="password"
        name="confirm"
        placeholder="Confirm new password"
        required
        className={inputCls}
      />
      {state && (
        <p className={`text-sm ${state.ok ? "text-green-300" : "text-red-400"}`}>{state.message}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending ? "Saving…" : "Update password"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border-soft px-4 py-2 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
