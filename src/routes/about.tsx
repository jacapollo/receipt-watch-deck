import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/polysnitch/Primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · PoliSnitch" },
      {
        name: "description",
        content: "Methodology and sources: how PoliSnitch is built from the public record.",
      },
    ],
  }),
  component: AboutPage,
});

const linkClass =
  "text-cyan underline underline-offset-2 decoration-cyan/40 hover:text-amber hover:decoration-amber focus:text-amber focus:outline-none focus-visible:text-amber transition";

const chipClass =
  "inline-flex items-center font-mono text-[10px] uppercase tracking-widest border border-border bg-surface-2 text-muted-foreground px-1.5 py-0.5 rounded-[2px]";

const sectionHeadingClass =
  "mt-2 text-lg md:text-xl font-bold tracking-tight text-foreground border-b border-border pb-2";

const proseClass = "text-sm md:text-base leading-relaxed text-foreground";

function AboutPage() {
  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl mx-auto">
        <SectionHeader eyebrow="METHODOLOGY // SOURCES" title="About PoliSnitch" />
        <article className="space-y-10">
          <section className="space-y-3">
            <p className={proseClass}>
              PoliSnitch is a Florida-focused public-records tool. It shows what elected officials
              actually do: how they vote and who funds them. It uses primary public records only,
              and every figure traces back to the filing it came from.
            </p>
            <p className={proseClass}>
              The rule behind the whole site is simple. If we can&apos;t source it, we don&apos;t
              show it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={sectionHeadingClass}>Where the data comes from</h2>
            <p className={proseClass}>
              Everything on PoliSnitch is built from official public records, not commentary or
              third-party summaries:
            </p>
            <ul className={`${proseClass} list-disc pl-5 space-y-2 marker:text-amber`}>
              <li>
                <strong>State votes &amp; bills.</strong>{" "}
                <a
                  href="https://openstates.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Open States
                </a>
                , which compiles Florida Legislature roll calls and bill histories from the
                legislature&apos;s own records.
              </li>
              <li>
                <strong>Federal campaign finance.</strong> The{" "}
                <a
                  href="https://www.fec.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Federal Election Commission (FEC)
                </a>
                , the government&apos;s official record of federal contributions and spending.
              </li>
              <li>
                <strong>State campaign finance.</strong> The Florida Department of State, Division
                of Elections{" "}
                <a
                  href="https://dos.elections.myflorida.com/campaign-finance/contributions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Campaign Finance Database
                </a>
                , the state&apos;s official record of contributions to state candidates and
                committees.
              </li>
              <li>
                <strong>Districts &amp; ZIP lookup.</strong> The U.S. Census Bureau&apos;s{" "}
                <a
                  href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  TIGER/Line geographic files
                </a>
                , used to map ZIP codes to legislative and congressional districts.
              </li>
            </ul>
            <p className={proseClass}>
              Each record on the site links back to its source so you can check it yourself.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={sectionHeadingClass}>How it&apos;s put together</h2>
            <p className={proseClass}>
              <strong>Officials, votes &amp; bills.</strong> We pull roll-call votes and bill
              records, then match each vote to the official who cast it. Where a vote can&apos;t be
              matched to a specific member with confidence, it&apos;s left out rather than guessed
              at. An unverified vote is worse than a missing one.
            </p>
            <p className={proseClass}>
              <strong>Money.</strong> Contributions are grouped by campaign and by donor. State and
              federal money come from different official sources (Florida filings and the FEC), so
              figures are always tied to the record that reported them.
            </p>
            <p className={proseClass}>
              <strong>Find your reps.</strong> ZIP codes don&apos;t line up neatly with districts,
              and one ZIP can fall across several. We use Census geographic data to show{" "}
              <em>all</em> the districts a ZIP touches, rather than pretending each ZIP has one
              clean answer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={sectionHeadingClass}>Nonpartisan by design</h2>
            <p className={proseClass}>
              PoliSnitch doesn&apos;t take sides. Officials of every party are shown the same way,
              from the same records, using the same math. The site reports the record. What you make
              of it is up to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={sectionHeadingClass}>What we don&apos;t claim</h2>
            <p className={proseClass}>
              Being honest about the limits is part of the point. Here&apos;s what the numbers do
              and don&apos;t mean:
            </p>
            <ul className={`${proseClass} list-disc pl-5 space-y-4 marker:text-amber`}>
              <li>
                <strong>The data is a snapshot, not a live feed.</strong> Figures reflect the most
                recent data load, not real-time filings. New records may not appear until the next
                refresh.
              </li>
              <li>
                <strong>Donation processors aren&apos;t donors.</strong> Large pass-through services
                like ActBlue and WinRed can appear near the top of a campaign&apos;s funding, but
                they&apos;re conduits routing money from many individual donors, not a single
                interest. We label these <strong className={chipClass}>PROCESSOR</strong> so
                they&apos;re not mistaken for one big backer. Rows labeled{" "}
                <strong className={chipClass}>AGGREGATE</strong> (such as unitemized totals)
                likewise bundle many smaller receipts.
              </li>
              <li>
                <strong>&quot;Donor-funded&quot; is not &quot;outside money.&quot;</strong> When a
                funding split shows <em>donor-funded</em>, that means everything that isn&apos;t the
                candidate&apos;s own money. It is <strong>not</strong> a measure of Super PAC or
                independent-expenditure spending. That data isn&apos;t part of these filings, and we
                don&apos;t pretend to track it.
              </li>
              <li>
                <strong>Donor names are matched conservatively.</strong> We combine records that
                differ only by capitalization or spacing, but we won&apos;t merge names that differ
                in punctuation or word order. This means the same donor can occasionally appear
                twice, which we accept, because wrongly merging two different people or
                organizations would be the bigger error.
              </li>
              <li>
                <strong>Coverage is Florida-first.</strong> State officials are covered most fully.
                Federal data covers Florida&apos;s congressional delegation.
              </li>
            </ul>
            <p className={proseClass}>
              If a number ever looks wrong, that&apos;s exactly the kind of thing the next section
              is for.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={sectionHeadingClass}>Found an error?</h2>
            <p className={proseClass}>
              Point us to the record. Email <strong>info@polisnitch.org</strong> with what&apos;s
              wrong and, ideally, a link to the official filing that shows it. If the record backs
              you up, it gets fixed. That&apos;s the whole deal: receipts over opinions.
            </p>
          </section>
        </article>
      </div>
    </AppShell>
  );
}
