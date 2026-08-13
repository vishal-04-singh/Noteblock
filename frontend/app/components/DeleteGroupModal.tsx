import { useState, useEffect } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

export function DeleteGroupModal({
  group,
  backendUrl,
  onClose,
  onSuccess,
}: {
  group: { id: string; name: string };
  backendUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleDelete() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/group/${group.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Couldn't delete the group.");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const glassPanelStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, color-mix(in srgb, var(--bg-secondary) 86%, rgba(255,255,255,.12)), color-mix(in srgb, var(--bg-secondary) 72%, transparent))',
    backdropFilter: 'blur(32px) saturate(180%) brightness(1.05)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%) brightness(1.05)',
    border: '1px solid color-mix(in srgb, var(--border) 84%, rgba(255,255,255,.18))',
    boxShadow: 'var(--shadow-modal), inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.025)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-in fade-in duration-150"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Delete group"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 duration-150"
        style={glassPanelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{ borderColor: "rgba(239, 68, 68, 0.15)", background: "rgba(239, 68, 68, 0.05)" }}
          >
            <AlertTriangle size={20} className="text-red-500" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Delete group
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Are you sure you want to delete{" "}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {group.name}
              </span>
              ? This will permanently remove all pages and members.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "#ef4444", color: "white" }}
          >
            {isSubmitting ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Trash2 size={14} />
            )}
            {isSubmitting ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98]"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
