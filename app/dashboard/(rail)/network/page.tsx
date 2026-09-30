"use client";

import { useState } from "react";
import { Avatar, Icon, icons } from "@/components/ui";

// Static placeholders until the database is connected
const counts = [
  { label: "Connections", value: 312 },
  { label: "Following", value: 58 },
  { label: "Groups", value: 4 },
  { label: "Events", value: 2 },
];
const initialInvites = [
  { id: "i1", name: "Rohan Desai", headline: "DevOps Engineer at Cloudline", mutual: 12 },
  { id: "i2", name: "Sneha Iyer", headline: "Product Designer", mutual: 4 },
];
const suggestions = [
  { id: "s1", name: "Aarav Mehta", headline: "Staff Engineer at Northwind", mutual: 18 },
  { id: "s2", name: "Priya Shah", headline: "Talent Partner", mutual: 9 },
  { id: "s3", name: "Kabir Rao", headline: "Backend Engineer · Go, Postgres", mutual: 6 },
  { id: "s4", name: "Ananya Gupta", headline: "Engineering Manager", mutual: 21 },
  { id: "s5", name: "Vikram Joshi", headline: "Data Engineer at Finloop", mutual: 3 },
  { id: "s6", name: "Meera Nair", headline: "Frontend Engineer · React", mutual: 11 },
];

const btn = "h-8 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnPrimary = `${btn} bg-foreground text-background hover:bg-white`;
const btnGhost = `${btn} text-muted hover:bg-surface-hover hover:text-foreground`;
const btnOutline = `${btn} border border-border text-foreground hover:bg-surface-hover`;

export default function NetworkPage() {
  const [invites, setInvites] = useState(initialInvites);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const respond = (id: string) => setInvites((list) => list.filter((i) => i.id !== id));
  const toggle = (id: string) =>
    setPending((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const people = suggestions.filter((p) => `${p.name} ${p.headline}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur">
        <h1 className="text-sm font-semibold">My Network</h1>
      </header>

      {/* Overview */}
      <div className="grid grid-cols-4 border-b border-border">
        {counts.map((c) => (
          <button key={c.label} type="button" className="py-4 text-center transition-colors hover:bg-surface">
            <p className="text-base font-semibold tabular-nums">{c.value}</p>
            <p className="text-xs text-muted">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Invitations */}
      <section className="border-b border-border">
        <div className="flex h-12 items-center justify-between px-4">
          <h2 className="text-sm font-semibold">
            Invitations <span className="font-normal text-muted">{invites.length}</span>
          </h2>
        </div>
        {invites.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">No pending invitations.</p>
        ) : (
          <ul>
            {invites.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">{p.headline}</p>
                  <p className="text-xs text-muted">{p.mutual} mutual connections</p>
                </div>
                <button type="button" className={btnGhost} onClick={() => respond(p.id)}>Ignore</button>
                <button type="button" className={btnOutline} onClick={() => respond(p.id)}>Accept</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* People you may know */}
      <section className="p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">People you may know</h2>
          <label className="flex h-8 w-44 items-center gap-2 rounded-md border border-border bg-surface px-2 text-muted focus-within:border-ring">
            <Icon d={icons.search} size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search people"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
            />
          </label>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {people.map((p) => {
            const sent = pending.has(p.id);
            return (
              <li key={p.id} className="flex flex-col items-center rounded-xl border border-border bg-surface p-4 text-center">
                <Avatar name={p.name} size={56} />
                <p className="mt-3 w-full truncate text-sm font-medium">{p.name}</p>
                <p className="w-full truncate text-xs text-muted">{p.headline}</p>
                <p className="mt-1 text-xs text-muted">{p.mutual} mutual</p>
                <button type="button" className={`mt-4 flex w-full items-center justify-center gap-1.5 ${sent ? btnOutline : btnPrimary}`} onClick={() => toggle(p.id)}>
                  {!sent && <Icon d={icons.connect} size={14} />}
                  {sent ? "Pending" : "Connect"}
                </button>
              </li>
            );
          })}
        </ul>
        {people.length === 0 && <p className="py-8 text-center text-sm text-muted">No people match “{query}”.</p>}
      </section>
    </>
  );
}
