import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";


type CreatedGroup = { code: string; name: string; groupId: string };

export function CreateGroupModal({
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
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<CreatedGroup | null>(null);
  const [copied, setCopied] = useState(false);
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
    if (!name.trim()) {
      setError("Enter a group name.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/group/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), displayName: displayName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Couldn't create the group. Try again.");
        return;
      }
      onSuccess();
      setCreatedGroup({
        code: data.group.code,
        name: data.group.name,
        groupId: data.group.id,
      });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopy() {
    if (createdGroup) {
      navigator.clipboard.writeText(createdGroup.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleContinue() {
    if (createdGroup) {
      navigate(`/group/${createdGroup.groupId}/pages`);
    }
  }

  // ✅ Using native theme variables
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
      aria-label="Create a group"
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
            <PlusMark />
          </div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Create a group
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {createdGroup ? "Your group is ready to share." : "Give it a name — you'll get a code to share."}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {createdGroup ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div
              className="flex items-center gap-2 rounded-xl border px-5 py-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
            >
              <span
                className="text-2xl font-medium tracking-[0.2em]"
                style={{ color: 'var(--text-primary)' }}
              >
                {createdGroup.code}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.98]"
              style={{
                borderColor: 'var(--border)',
                color: copied ? "rgb(var(--accent))" : 'var(--text-secondary)',
              }}
            >
              {copied ? "Copied!" : "Copy code"}
            </button>

            <button
              type="button"
              onClick={handleContinue}
              className="mt-2 flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98]"
              style={{ background: "rgb(var(--accent))", color: "white" }}
            >
              Continue to group
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-name" className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Group name
              </label>
              <input
                ref={inputRef}
                id="create-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                placeholder="e.g. Product team notes"
                maxLength={60}
                className="rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                style={glassInputStyle}
              />
            </div>

            {!user && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-display" className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Display name
                </label>
                <input
                  id="create-display"
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
              {isSubmitting ? "Creating…" : "Create group"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PlusMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="15" height="15" rx="4" stroke="var(--text-primary)" strokeOpacity="0.7" strokeWidth="1.4" />
      <path d="M10 6.5v7M6.5 10h7" stroke="var(--text-primary)" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
