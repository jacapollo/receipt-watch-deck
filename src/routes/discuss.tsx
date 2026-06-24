import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader, ReportButton } from "@/components/polysnitch/Primitives";
import { threads, formatTimeAgo } from "@/lib/mock-data";
import { ArrowBigUp, ArrowBigDown, MessageSquare, ShieldAlert, X } from "lucide-react";

export const Route = createFileRoute("/discuss")({
  head: () => ({
    meta: [
      { title: "Discuss · PolySnitch" },
      { name: "description", content: "Anonymous, location-scoped discussion of the public record." },
    ],
  }),
  component: DiscussPage,
});

function DiscussPage() {
  const [tag, setTag] = useState<string | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const allTags = useMemo(
    () => Array.from(new Set(threads.flatMap((t) => t.tags))).sort(),
    [],
  );
  const list = threads.filter((t) => !tag || t.tags.includes(tag));

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="COMMUNITY // ANONYMOUS"
          title="Discuss"
          right={
            <button
              onClick={() => setGuidelinesOpen(true)}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-border bg-surface px-2.5 py-1.5 rounded-sm text-muted-foreground hover:text-amber hover:border-amber"
            >
              <ShieldAlert className="h-3 w-3" />
              Community guidelines
            </button>
          }
        />

        <div className="flex items-center gap-2 flex-wrap mb-6">
          <span className="mono-label mr-1">FILTER</span>
          <button
            onClick={() => setTag(null)}
            className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-[2px] ${
              !tag ? "bg-amber/10 border-amber/50 text-amber" : "border-border text-muted-foreground"
            }`}
          >
            ALL
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t === tag ? null : t)}
              className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-[2px] ${
                tag === t
                  ? "bg-amber/10 border-amber/50 text-amber"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {list.map((t) => (
            <article key={t.id} className="border border-border bg-surface rounded-sm p-5 hover:border-amber/40 transition">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-0.5 shrink-0 font-mono">
                  <ArrowBigUp className="h-5 w-5 text-muted-foreground hover:text-amber cursor-pointer" />
                  <span className="text-sm font-bold">{t.upvotes - t.downvotes}</span>
                  <ArrowBigDown className="h-5 w-5 text-muted-foreground hover:text-status-red cursor-pointer" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {t.tags.map((tg) => (
                      <span
                        key={tg}
                        className="font-mono text-[10px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                      >
                        {tg}
                      </span>
                    ))}
                    <span className="mono-label">SCOPE · {t.scope}</span>
                  </div>
                  <Link
                    to="/discuss/$id"
                    params={{ id: t.id }}
                    className="text-base md:text-lg font-bold hover:text-amber leading-tight block"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.body}</p>
                  <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>@{t.author}</span>
                    <span>{formatTimeAgo(t.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t.comments.length} replies
                    </span>
                    <ReportButton />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {guidelinesOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setGuidelinesOpen(false)}
        >
          <div
            className="relative max-w-lg w-full border border-border bg-surface rounded-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGuidelinesOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-amber"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mono-label text-amber">COMMUNITY GUIDELINES</div>
            <h3 className="mt-1 text-xl font-bold">Stay on the record.</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-foreground/90">
              {[
                "Discuss public actions of public officials only.",
                "No harassment, slurs, or threats — ever.",
                "No doxxing. No home addresses, family, or private individuals.",
                "Source your claims. Receipts > vibes.",
                "Reports go to mods within 24h. Repeat offenders are removed.",
              ].map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-amber text-xs mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setGuidelinesOpen(false)}
              className="mt-5 w-full bg-amber text-primary-foreground font-bold uppercase tracking-wider text-xs py-2.5 rounded-sm hover:brightness-110"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
