"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="password"
        name="secret"
        placeholder="Admin secret"
        autoFocus
        className="rounded-xl border border-border-soft bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-3 font-bold text-black disabled:opacity-50"
      >
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
