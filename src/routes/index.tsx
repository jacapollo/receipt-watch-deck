import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Radar, FileText, DollarSign, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PolySnitch — Public officials, on the record" },
      {
        name: "description",
        content:
          "A clear dashboard for political accountability. Public records, real funding, no spin.",
      },
      { property: "og:title", content: "PolySnitch — Public officials, on the record" },
      {
        property: "og:description",
        content: "Follow the public record of local, state, and federal officials.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [zip, setZip] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden bg-black">
      {/* Tactical USA map background */}
      <div
        className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/tactical-usa.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/40" />
      <div className="fixed inset-0 hud-scanlines pointer-events-none z-[1] opacity-40" />


      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-amber" />
          <span className="font-black text-lg tracking-tight">
            POLY<span className="text-amber">SNITCH</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-mono text-[12px] uppercase tracking-widest text-white font-bold">
          <Link to="/feed" className="px-2 py-1 rounded-sm border border-white/20 bg-white/5 hover:bg-amber hover:text-primary-foreground hover:border-amber transition-colors">Feed</Link>
          <Link to="/map" className="px-2 py-1 rounded-sm border border-white/20 bg-white/5 hover:bg-amber hover:text-primary-foreground hover:border-amber transition-colors">Map</Link>
          <Link to="/officials" className="px-2 py-1 rounded-sm border border-white/20 bg-white/5 hover:bg-amber hover:text-primary-foreground hover:border-amber transition-colors">Officials</Link>
          <Link to="/bills" className="px-2 py-1 rounded-sm border border-white/20 bg-white/5 hover:bg-amber hover:text-primary-foreground hover:border-amber transition-colors">Bills</Link>
          <Link to="/discuss" className="px-2 py-1 rounded-sm border border-white/20 bg-white/5 hover:bg-amber hover:text-primary-foreground hover:border-amber transition-colors">Discuss</Link>
        </div>
        <Link
          to="/feed"
          className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest bg-amber text-primary-foreground px-3 py-2 rounded-sm hover:brightness-110"
        >
          Enter watchfloor <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-16 md:pt-24 pb-12 max-w-6xl mx-auto">
        <div className="mono-label text-amber flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
          LIVE · PUBLIC RECORD · {new Date().getUTCFullYear()}
        </div>
        <h1 className="mt-4 text-5xl md:text-8xl font-black tracking-tight leading-[0.95]">
          POLY<span className="text-amber">SNITCH</span>
          <span className="block text-foreground/65 text-2xl md:text-4xl font-bold mt-2 tracking-tight">
            Track them the way they track you.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base md:text-lg text-white leading-relaxed font-medium drop-shadow">
          A live operations dashboard for local, state, and federal officials —
          built from <span className="font-bold">public records only</span>.
          Their votes, their donors, their words. On the record.
        </p>

        {/* ZIP input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/feed" });
          }}
          className="mt-10 max-w-xl border border-border bg-surface rounded-sm p-1.5 flex items-center gap-2 focus-within:border-amber transition"
        >
          <div className="pl-3 mono-label text-amber shrink-0">ZIP / CITY</div>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="94110 or San Vicente, CA"
            className="flex-1 min-w-0 bg-transparent outline-none px-2 py-2.5 text-sm placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            className="shrink-0 inline-flex items-center gap-1 bg-amber text-primary-foreground font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded-sm hover:brightness-110"
          >
            Show me who runs my area
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          DEMO MODE · Any input drops you into a sample district.
        </div>

        {/* Value cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: FileText, label: "PUBLIC RECORDS", body: "Votes, bills, statements — sourced and stamped." },
            { icon: DollarSign, label: "REAL FUNDING", body: "Donors and sectors from official filings." },
            { icon: ShieldCheck, label: "NO SPIN", body: "No press release laundering. The record itself." },
          ].map((c) => (
            <div
              key={c.label}
              className="group border border-border bg-surface rounded-sm p-5 hover:border-amber/60 transition relative overflow-hidden"
            >
              <c.icon className="h-5 w-5 text-amber" />
              <div className="mt-3 mono-label">{c.label}</div>
              <p className="mt-2 text-sm text-foreground/90">{c.body}</p>
              <div className="absolute right-3 top-3 mono-label text-muted-foreground/40">001</div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px bg-border flex-1" />
          PolySnitch tracks the public record of public officials only.
          <span className="h-px bg-border flex-1" />
        </div>
      </section>
    </div>
  );
}
