import { useNavigate } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useSavedThreads } from "@/lib/follows";

// Thread bookmark control. Mirrors TrackButton exactly — same shape, same
// signed-out redirect. Threads are the only saveable entity for now.
export function SaveButton({ threadId, size = "md" }: { threadId: string; size?: "sm" | "md" }) {
  const navigate = useNavigate();
  const saves = useSavedThreads();
  const saved = saves.isSaved(threadId);

  const onClick = () => {
    if (!saves.signedIn) {
      navigate({ to: "/login" });
      return;
    }
    saves.toggle(threadId, !saved);
  };

  const pad = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2";
  const label = !saves.signedIn ? "Save" : saved ? "Saved" : "Save";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      title={saves.signedIn ? undefined : "Sign in to save"}
      className={`shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest ${pad} border rounded-sm transition ${
        saved
          ? "bg-amber text-primary-foreground border-amber"
          : "border-border text-muted-foreground hover:text-amber hover:border-amber"
      }`}
    >
      <Bookmark className={`h-3 w-3 ${saved ? "fill-current" : ""}`} />
      {label}
    </button>
  );
}
