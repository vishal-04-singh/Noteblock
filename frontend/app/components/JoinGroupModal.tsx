import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";

export function JoinGroupModal({
  user,
  backendUrl,
  onClose,
  onSuccess,
}: {
  user: any;
  backendUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
    if (!code.trim()) {
      setError("Enter a group code.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/group/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim(), displayName: displayName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Couldn't join that group. Try again.");
        return;
      }
      onSuccess();
      const groupId = data?.group?.id;
      navigate(groupId ? `/group/${groupId}/pages` : "/home");
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
      aria-label="Join a group"
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
            <GroupMark />
          </div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Join a group
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Enter the code someone shared with you.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="join-code" className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Group code
            </label>
            <input
              ref={inputRef}
              id="join-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. 7QK3PZ8M4VHT"
              maxLength={12}
              className="rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
              style={glassInputStyle}
            />
          </div>

          {!user && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="join-display" className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Display name
              </label>
              <input
                id="join-display"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="What should we call you?"
                maxLength={40}
                className="rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                style={glassInputStyle}
              />
              <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>
                Already signed in? This is optional.
              </p>
            </div>
          )}

          {user && (
            <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Signed in as <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "rgb(var(--accent))", color: "white" }}
          >
            {isSubmitting ? "Joining…" : "Join group"}
          </button>
        </form>
      </div>
    </div>
  );
}

function GroupMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="3" stroke="var(--text-primary)" strokeOpacity="0.7" strokeWidth="1.4" />
      <circle cx="14" cy="9" r="2.3" stroke="var(--text-primary)" strokeOpacity="0.5" strokeWidth="1.4" />
      <path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" stroke="var(--text-primary)" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.8 12.4c1.6.2 2.9 1.4 3.4 3.6" stroke="var(--text-primary)" strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
