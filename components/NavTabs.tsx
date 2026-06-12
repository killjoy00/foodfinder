"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Tonight", emoji: "🎲" },
  { href: "/vote", label: "Vote", emoji: "🗳️" },
  { href: "/restaurants", label: "Places", emoji: "📍" },
  { href: "/discover", label: "Discover", emoji: "✨" },
  { href: "/settings", label: "More", emoji: "⚙️" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border-soft bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl justify-around">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-xs ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-xl">{tab.emoji}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
