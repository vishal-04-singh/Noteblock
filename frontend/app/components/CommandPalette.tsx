import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { glassPanelStyle, glassInputStyle, glassOverlayStyle } from "~/lib/glass";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: "15vh",
  paddingLeft: "1rem",
  paddingRight: "1rem",
  ...glassOverlayStyle,
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "36rem",
  overflow: "hidden",
  borderRadius: "16px",
  ...glassPanelStyle(),
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  ...glassInputStyle,
  border: "none",
  outline: "none",
  padding: "16px 20px",
  fontSize: "15px",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 85%, transparent)",
};
export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon?: "page" | "group" | "action";
};

/**
 * A ⌘K command palette. Self-registers its Cmd/Ctrl+K listener, so mounting it
 * anywhere is enough to enable the shortcut. Searches client-side over the
 * `items` prop (e.g. the dashboard's real groups + recent pages) plus a set of
 * built-in actions — no backend round-trip, no global URL hack.
 */
export default function CommandPalette({ items = [] }: { items?: SearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Listen for Cmd/Ctrl+K and Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset + focus when opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const defaults = useMemo(() => getDefaultActions(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return defaults;
    return [...items, ...defaults].filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle?.toLowerCase().includes(q) ?? false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, items]);

  // Keep active index in bounds as results change.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results]);

  const select = useCallback(
    (result: SearchItem) => {
      setOpen(false);
      navigate(result.href);
    },
    [navigate]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      select(results[activeIndex]);
    }
  }

  if (!open) return null;

  // ✅ Matching glassmorphism style
  const glassOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "15vh",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  const glassPanelStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "36rem",
    overflow: "hidden",
    borderRadius: "16px",
    background: "color-mix(in srgb, var(--surface-1, #121212) 92%, transparent)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    border: "1px solid var(--border, rgba(255,255,255,0.08))",
    boxShadow: "0 24px 48px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
  };

  const glassInputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "16px 20px",
    fontSize: "15px",
    color: "var(--text-primary, rgba(255,255,255,0.9))",
    borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
  };

  return (
    <div
      style={glassOverlayStyle}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div style={glassPanelStyle} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={glassInputStyle}
          placeholder="Search groups, pages, or actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={{ maxHeight: "400px", overflowY: "auto", padding: "8px" }}>
          {results.length === 0 && query ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              No results for “{query}”
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Type to search…
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                onClick={() => select(r)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "var(--text-primary, rgba(255,255,255,0.9))",
                  background: i === activeIndex ? "rgba(255,255,255,0.05)" : "transparent",
                  transition: "background 0.1s ease",
                }}
              >
                <PaletteIcon type={r.icon || "page"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  {r.subtitle && (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary, rgba(255,255,255,0.5))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "8px 16px", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, color: "var(--text-quaternary, rgba(255,255,255,0.3))" }}>↑↓ Navigate</span>
          <span style={{ fontSize: 11, color: "var(--text-quaternary, rgba(255,255,255,0.3))" }}>↵ Open</span>
          <span style={{ fontSize: 11, color: "var(--text-quaternary, rgba(255,255,255,0.3))" }}>esc Close</span>
        </div>
      </div>
    </div>
  );
}

function getDefaultActions(): SearchItem[] {
  return [
    { id: "action-create", title: "Create a group", subtitle: "Start a new workspace", href: "/create", icon: "action" },
    { id: "action-join", title: "Join a group", subtitle: "Enter a group code", href: "/join", icon: "action" },
    { id: "action-home", title: "Go home", subtitle: "View all groups", href: "/home", icon: "action" },
    { id: "action-profile", title: "Profile settings", subtitle: "Edit your profile", href: "/profile", icon: "action" },
  ];
}

function PaletteIcon({ type }: { type: "page" | "group" | "action" }) {
  if (type === "page") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
        <path d="M4 2h5l3 3v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "group") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
        <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
