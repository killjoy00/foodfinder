"use client";

import { useRouter } from "next/navigation";

/**
 * Goes back in history (so the previous page's scroll position is restored)
 * rather than navigating forward to a fresh, scrolled-to-top page. Falls
 * back to a normal navigation when there's no history to go back to.
 */
export function BackLink({
  fallback,
  className,
  children,
}: {
  fallback: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      {children}
    </button>
  );
}
