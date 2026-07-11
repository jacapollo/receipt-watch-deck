import { useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useFollows } from "@/lib/follows";

// One Track/Follow control shared by Officials and Bills. Reflects real
// user_follows state via useFollows(). Logged out, it doesn't fail silently —
// clicking sends the user to /login to sign in first.
export function TrackButton({
  kind,
  id,
  size = "md",
}: {
  kind: "official" | "bill";
  id: string;
  size?: "sm" | "md";
}) {
  const navigate = useNavigate();
  const follows = useFollows();
  const following = kind === "official" ? follows.isFollowingOfficial(id) : follows.isFollowingBill(id);

  const onClick = () => {
    if (!follows.signedIn) {
      navigate({ to: "/login" });
      return;
    }
    if (kind === "official") follows.toggleOfficial(id, !following);
    else follows.toggleBill(id, !following);
  };

  const pad = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2";
  const label = !follows.signedIn ? "Track" : following ? "Tracking" : "Track";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={following}
      title={follows.signedIn ? undefined : "Sign in to track"}
      className={`shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest ${pad} border rounded-sm transition ${
        following
          ? "bg-amber text-primary-foreground border-amber"
          : "border-border text-muted-foreground hover:text-amber hover:border-amber"
      }`}
    >
      <Star className={`h-3 w-3 ${following ? "fill-current" : ""}`} />
      {label}
    </button>
  );
}
