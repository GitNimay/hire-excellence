import type { ReactNode } from "react";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Avatar, card } from "@/components/ui";

// Static placeholders until the database is connected
const stats = [
  { label: "Profile viewers", value: 120 },
  { label: "Post impressions", value: 792 },
];
const notifications = [
  { name: "Aarav Mehta", text: "viewed your profile", time: "2h" },
  { name: "Priya Shah", text: "liked your post", time: "5h" },
  { name: "Rohan Desai", text: "sent you a connection request", time: "1d" },
];

/** Feed column + quick settings. Pages outside this group can use the full width. */
export default async function RailLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const name = user?.fullName || user?.username || "You";

  return (
    <>
      {/* Main feed */}
      <main className="min-w-0 flex-1 pb-16 sm:border-r sm:border-border sm:pb-0 lg:max-w-[600px]">{children}</main>

      {/* Quick settings */}
      <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 space-y-4 overflow-y-auto p-4 lg:block">
        <section className={`${card} overflow-hidden`}>
          <div className="h-16 bg-gradient-to-r from-[#1e293b] to-[#312e81]" />
          <div className="px-4 pb-4">
            <div className="-mt-8 w-fit rounded-full ring-4 ring-surface">
              <Avatar name={name} src={user?.imageUrl} size={64} />
            </div>
            <p className="mt-3 font-semibold tracking-tight">{name}</p>
            <p className="text-sm text-muted">Add a headline</p>
          </div>
        </section>

        <section className={card}>
          <div className="space-y-2 p-4">
            {stats.map((s) => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-muted">{s.label}</span>
                <span className="font-medium text-link tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <Link href="/dashboard/notifications" className="text-xs text-muted hover:text-foreground">View all</Link>
            </div>
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li key={n.name} className="flex items-start gap-3 text-sm">
                  <Avatar name={n.name} size={32} />
                  <p className="min-w-0 flex-1 leading-snug">
                    <span className="font-medium">{n.name}</span> <span className="text-muted">{n.text}</span>
                  </p>
                  <span className="text-xs text-muted">{n.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </aside>
    </>
  );
}
