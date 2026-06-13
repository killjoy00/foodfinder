"use client";

import { useActionState, useState } from "react";
import { createGroupAction, loginAction } from "@/app/actions";

export function LoginForm() {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [joinState, joinAction, joinPending] = useActionState(loginAction, null);
  const [createState, createSubmit, createPending] = useActionState(createGroupAction, null);

  const isCreate = mode === "create";
  const state = isCreate ? createState : joinState;
  const pending = isCreate ? createPending : joinPending;
  const inputCls =
    "rounded-xl border border-border-soft bg-surface px-4 py-3 text-center text-lg outline-none focus:border-accent";

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <div className="flex overflow-hidden rounded-xl border border-border-soft bg-surface-2">
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 py-2 text-sm font-semibold ${!isCreate ? "bg-accent text-black" : "text-muted"}`}
        >
          Join a group
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 py-2 text-sm font-semibold ${isCreate ? "bg-accent text-black" : "text-muted"}`}
        >
          New group
        </button>
      </div>

      <form action={isCreate ? createSubmit : joinAction} className="flex flex-col gap-3">
        <input
          name="group"
          placeholder="Group name"
          autoComplete="off"
          required
          className={inputCls}
        />
        <input
          type="password"
          name="password"
          placeholder={isCreate ? "Choose a password" : "Group password"}
          required
          className={inputCls}
        />
        {state?.error && <p className="text-center text-sm text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-3 text-lg font-semibold text-black disabled:opacity-50"
        >
          {pending ? "…" : isCreate ? "Create group" : "Come on in"}
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        {isCreate
          ? "Anyone you share the group name + password with can join."
          : "Ask your group for its name and password."}
      </p>
    </div>
  );
}
