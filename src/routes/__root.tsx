import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 hud-grid">
      <div className="max-w-md text-center border border-border bg-surface p-8 rounded-md">
        <div className="mono-label text-amber">ERR_404 // SIGNAL_LOST</div>
        <h1 className="mt-3 text-6xl font-black tracking-tight text-foreground">404</h1>
        <h2 className="mt-2 text-lg font-semibold text-foreground">Page off the record</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We searched the public record. This page isn't in it.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-amber px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
          >
            Return to watchfloor
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center border border-border bg-surface p-8 rounded-md">
        <div className="mono-label text-status-red">ERR_500 // SYSTEM_FAULT</div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">
          Something tripped a wire
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again, or head back to the feed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-sm bg-amber px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-sm border border-border bg-surface px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-surface-2"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PolySnitch — Track them the way they track you" },
      {
        name: "description",
        content:
          "PolySnitch is a public-record accountability dashboard for local, state, and federal officials. Real votes. Real funding. No spin.",
      },
      { name: "author", content: "PolySnitch" },
      { name: "theme-color", content: "#0a0c10" },
      { property: "og:title", content: "PolySnitch — Track them the way they track you" },
      {
        property: "og:description",
        content:
          "An intelligence-dashboard for political accountability. Built on public records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
