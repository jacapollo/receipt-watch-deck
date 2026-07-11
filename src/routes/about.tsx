import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/polysnitch/Primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · PolySnitch" },
      { name: "description", content: "Methodology and sources — how PolySnitch is built from the public record." },
    ],
  }),
  component: AboutPage,
});

// Placeholder methodology/sources page — real copy to be written. Kept minimal
// and in the tactical style so the About nav link resolves to a real route.
function AboutPage() {
  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl mx-auto">
        <SectionHeader eyebrow="METHODOLOGY // SOURCES" title="About" />
        <div className="border border-border bg-surface rounded-sm p-6 space-y-3">
          <div className="mono-label text-amber">PLACEHOLDER // COPY TO COME</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PolySnitch is built from public records only — votes, bills, and campaign
            filings, each carrying a source receipt. This page will document the data
            sources, refresh cadence, and how every fact is stamped and verifiable.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
