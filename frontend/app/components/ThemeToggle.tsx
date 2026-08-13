import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun, Palette } from "lucide-react";
import { useTheme, type AccentColor } from "~/lib/theme";

// lib/theme.tsx's AccentColor type isn't exported as a runtime array, so the
// list of selectable accents lives here, next to the component that renders
// them. Keep this in sync with the AccentColor union in ~/lib/theme.tsx.
export type AccentChoice = AccentColor;
export const ACCENTS: AccentChoice[] = ["violet", "indigo", "blue", "cyan", "emerald", "lime", "amber", "coral", "rose"];

const ACCENT_HEX: Record<AccentChoice, string> = {
  violet: "#8b5cf6",
  blue: "#3b82f6",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  indigo: "#6366f1",
  lime: "#84cc16",
  coral: "#f97316",
};

const ACCENT_GRADIENT: Record<AccentChoice, string> = {
  violet: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  blue: "linear-gradient(135deg, #60a5fa, #2563eb)",
  emerald: "linear-gradient(135deg, #34d399, #059669)",
  rose: "linear-gradient(135deg, #fb7185, #e11d48)",
  amber: "linear-gradient(135deg, #fbbf24, #d97706)",
  cyan: "linear-gradient(135deg, #22d3ee, #0891b2)",
  indigo: "linear-gradient(135deg, #a5b4fc, #4f46e5)",
  lime: "linear-gradient(135deg, #bef264, #65a30d)",
  coral: "linear-gradient(135deg, #fdba74, #ea580c)",
};

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light", Icon: Sun },
  { value: "dark" as const, label: "Dark", Icon: Moon },
  { value: "dim" as const, label: "Dim", Icon: Moon },
  { value: "system" as const, label: "System", Icon: Monitor },
];

type ThemeToggleProps = {
  controlSize?: "compact" | "page";
};

/**
 * Header pill that opens a small glass POPOVER anchored directly under the
 * button (not a centered modal) — same footprint as a menu, not a dialog.
 * Click outside or Escape closes it.
 */
function ThemeToggleComponent({ controlSize = "compact" }: ThemeToggleProps = {}) {
  const { mode, setMode, accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const ActiveIcon = mode === "dark" || mode === "dim" ? Moon : mode === "light" ? Sun : Monitor;
  const isPageControl = controlSize === "page";
  const iconSize = isPageControl ? 15 : 14;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`glass-btn inline-flex items-center rounded-full border font-medium transition-all duration-150 hover:bg-white/[0.05] active:scale-[0.97] ${
          isPageControl ? "h-9 gap-2 px-3.5 text-sm" : "gap-1.5 px-3.5 py-1.5 text-xs"
        }`}
        style={{
          borderColor: 'var(--border, rgba(255,255,255,0.1))',
          color: 'var(--text-secondary, rgba(255,255,255,0.7))',
          background: 'color-mix(in srgb, var(--surface-1, #121212) 45%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <ActiveIcon size={iconSize} strokeWidth={2} />
        Theme
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Theme settings"
          // ✅ Increased z-index to z-[100] so it sits above profile dropdowns
          className="absolute right-0 z-[100] mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all duration-150 ease-out"
          style={{
            boxShadow: "0 24px 48px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
            background: 'color-mix(in srgb, var(--surface-1, #121212) 92%, transparent)',
            borderColor: 'var(--border, rgba(255,255,255,0.08))',
            opacity: entered ? 1 : 0,
            transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(-6px)',
          }}
        >
          {/* <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: `radial-gradient(160px 90px at 100% 0%, ${ACCENT_HEX[accent]}33, transparent 70%)` }}
          /> */}
          <div className="relative">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.3))' }}>
              Appearance
            </p>
            <div
              className="mb-5 grid grid-cols-4 gap-1.5 rounded-xl border p-1"
              style={{ borderColor: 'var(--border, rgba(255,255,255,0.08))', background: 'rgba(0,0,0,0.2)' }}
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={active}
                    className="flex flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] font-medium transition-all duration-150"
                    style={
                      active
                        ? { background: ACCENT_GRADIENT[accent], color: '#fff', boxShadow: `0 6px 16px -6px ${ACCENT_HEX[accent]}aa` }
                        : { color: 'var(--text-secondary, rgba(255,255,255,0.55))' }
                    }
                  >
                    <Icon size={14} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.3))' }}>
              <Palette size={11} strokeWidth={2} />
              Accent color
            </p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const active = a === accent;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccent(a)}
                    title={a}
                    aria-label={`Accent: ${a}`}
                    aria-pressed={active}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
                    style={{
                      background: ACCENT_GRADIENT[a],
                      boxShadow: active
                        ? `0 0 0 2px rgba(0,0,0,0.6), 0 0 0 4px ${ACCENT_HEX[a]}, 0 6px 16px -4px ${ACCENT_HEX[a]}99`
                        : `0 3px 10px -3px ${ACCENT_HEX[a]}77`,
                    }}
                  >
                    {active && <Check size={13} strokeWidth={3.5} color="#fff" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const ThemeToggle = ThemeToggleComponent;
export default ThemeToggleComponent;

/** Standalone exports kept for a dedicated settings page, if you want them there too. */
export function AccentPicker({ size = 20 }: { size?: number }) {
  const { accent, setAccent } = useTheme();
  return (
    <div className="flex flex-wrap gap-2">
      {ACCENTS.map((a) => {
        const active = a === accent;
        return (
          <button
            key={a}
            type="button"
            onClick={() => setAccent(a)}
            title={a}
            aria-label={`Accent: ${a}`}
            aria-pressed={active}
            className="flex items-center justify-center rounded-full transition duration-150 hover:scale-110"
            style={{
              width: size + 8,
              height: size + 8,
              background: ACCENT_GRADIENT[a],
              boxShadow: active
                ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${ACCENT_HEX[a]}, 0 6px 16px -4px ${ACCENT_HEX[a]}99`
                : `0 3px 10px -3px ${ACCENT_HEX[a]}77`,
            }}
          >
            {active && <Check size={size - 6} strokeWidth={3} color="#fff" />}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeChooser() {
  const { mode, setMode, accent } = useTheme();
  return (
    <div className="inline-flex rounded-xl border border-border p-1">
      {THEME_OPTIONS.map(({ value, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150 " +
              (active ? "text-white" : "text-muted hover:text-fg")
            }
            style={active ? { background: ACCENT_GRADIENT[accent], boxShadow: `0 6px 16px -6px ${ACCENT_HEX[accent]}aa` } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
