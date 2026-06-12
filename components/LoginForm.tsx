"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <input
        type="password"
        name="password"
        placeholder="Family password"
        autoFocus
        required
        className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-center text-lg outline-none focus:border-accent"
      />
      {state?.error && <p className="text-center text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-3 text-lg font-semibold text-black disabled:opacity-50"
      >
        {pending ? "Checking…" : "Come on in"}
      </button>
    </form>
  );
}
