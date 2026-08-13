import { useState, useEffect, useRef } from "react";

export function RenameGroupModal({
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
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name cannot be empty.");
      return;
    }
    if (name.trim() === group.name) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/group/${group.id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Couldn't rename the group.");
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

  const glassInputStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-in fade-in duration-150"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rename group"
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

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <EditMark />
          </div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Rename group
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Choose a new name for this workspace.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rename-name" className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Group name
            </label>
            <input
              ref={inputRef}
              id="rename-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              maxLength={60}
              className="rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
              style={glassInputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "rgb(var(--accent))", color: "white" }}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 14l1-3 7-7 2 2-7 7-3 1z"
        stroke="var(--text-primary)"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 6l2 2"
        stroke="var(--text-primary)"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
