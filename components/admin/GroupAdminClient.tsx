"use client";

import { useState, useTransition } from "react";
import {
  adminDeleteGroupAction,
  adminRenameGroupAction,
  adminResetGroupPasswordAction,
} from "@/app/admin/actions";

export function GroupAdminClient({ id, name }: { id: string; name: string }) {
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renamed, setRenamed] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function rename(formData: FormData) {
    setRenamed(false);
    startTransition(async () => {
      const r = await adminRenameGroupAction(id, formData);
      setRenameError(r?.error ?? null);
      setRenamed(!r);
    });
  }

  function resetPassword(formData: FormData) {
    setPwDone(false);
    startTransition(async () => {
      const r = await adminResetGroupPasswordAction(id, formData);
      setPwError(r?.error ?? null);
      setPwDone(!r);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Rename group</h2>
        <form action={rename} className="flex gap-2">
          <input
            name="name"
            defaultValue={name}
            className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent"
          />
          <button
            disabled={pending}
            className="rounded-xl bg-surface-2 px-4 py-2.5 font-semibold disabled:opacity-50"
          >
            Rename
          </button>
        </form>
        {renameError && <p className="text-sm text-red-400">{renameError}</p>}
        {renamed && <p className="text-sm text-green-300">Renamed. The family logs in with the new name.</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Reset password</h2>
        <p className="text-sm text-muted">
          Set a new group password and pass it along — useful when a family is locked out on every
          device.
        </p>
        <form action={resetPassword} className="flex gap-2">
          <input
            name="password"
            placeholder="New password"
            className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent"
          />
          <button
            disabled={pending}
            className="rounded-xl bg-surface-2 px-4 py-2.5 font-semibold disabled:opacity-50"
          >
            Set
          </button>
        </form>
        {pwError && <p className="text-sm text-red-400">{pwError}</p>}
        {pwDone && <p className="text-sm text-green-300">Password updated.</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-red-900 bg-red-950/30 p-4">
        <h2 className="font-bold text-red-300">Delete group</h2>
        <p className="text-sm text-muted">
          Removes the group and everything it owns — members, list, ratings, visit history. The
          shared catalog is untouched. This can&apos;t be undone.
        </p>
        {confirming ? (
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => startTransition(() => adminDeleteGroupAction(id))}
              className="rounded-xl bg-red-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : `Yes, delete “${name}”`}
            </button>
            <button
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-xl bg-surface-2 px-4 py-2.5 font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="self-start rounded-xl border border-red-800 px-4 py-2.5 font-semibold text-red-300"
          >
            Delete this group…
          </button>
        )}
      </section>
    </div>
  );
}
