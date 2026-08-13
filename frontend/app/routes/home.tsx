import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "~/hooks/useScrollReveal";
import { useCountUp } from "~/hooks/useCountUp";
import { getUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Noteblock — Collaborative docs, no friction" },
    {
      name: "description",
      content:
        "Share a code. Anyone joins instantly — no account, no setup. Edit together in real time with a block editor that stays out of your way.",
    },
    { property: "og:title", content: "Noteblock — Collaborative docs, no friction" },
    {
      property: "og:description",
      content: "Share a code. Anyone joins instantly. Edit together in real time.",
    },
    { property: "og:type", content: "website" },
    { name: "theme-color", content: "#070708" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return { user };
}

const avatars = [
  { name: "Arjun", color: "#a78bfa", initials: "AJ" },
  { name: "Priya", color: "#34d399", initials: "PR" },
  { name: "Sam", color: "#fb923c", initials: "SM" },
];

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="2" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="3" y="7.5" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <rect x="3" y="11" width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <rect x="3" y="14.5" width="7" height="1.5" rx="0.75" fill="currentColor" opacity="0.3" />
      </svg>
    ),
    title: "Block editor",
    desc: "Slash commands, drag-to-reorder, nested pages. Type / to insert anything.",
    span: "lg:col-span-2",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="6" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="15" r="3" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8.8" y1="8.5" x2="11.2" y2="6.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <line x1="8.8" y1="11.5" x2="11.2" y2="13.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    ),
    title: "No account needed",
    desc: "Share a secure 12-character code. Anyone joins with a display name.",
    span: "",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L13 8H17L14 12L15.5 18L10 15L4.5 18L6 12L3 8H7L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: "Live presence",
    desc: "See who's editing in real time. Colored cursors, no conflicts.",
    span: "",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 8H18" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <rect x="5" y="11" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="11" y="11" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    title: "Nested pages",
    desc: "Build a doc tree. Drag pages into each other. Notion-style hierarchy, your structure.",
    span: "lg:col-span-2",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3C10 3 4 6 4 11C4 14.3137 6.68629 17 10 17C13.3137 17 16 14.3137 16 11C16 6 10 3 10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="11" r="2" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    title: "Version history",
    desc: "Every edit recorded. Rewind, compare, restore in one click.",
    span: "",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6V10L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Always in sync",
    desc: "CRDT-powered. Edits merge automatically — even two typing at once.",
    span: "",
  },
];

const stats = [
  { value: 5000, suffix: "+", label: "Documents created" },
  { value: 12, prefix: "<", suffix: "ms", label: "Sync latency" },
  { value: 0, label: "Signups required", isZero: true },
  { value: 99.9, suffix: "%", label: "Uptime", decimals: 1 },
];

const steps = [
  { num: "01", title: "Create a group", desc: "Spin up a workspace in one click. Get a secure code instantly." },
  { num: "02", title: "Share the code", desc: "Paste it anywhere. Teammates join with just a display name — no account." },
  { num: "03", title: "Write together", desc: "Edit in real time with live cursors. Everything merges, nothing conflicts." },
];

const testimonials = [
  {
    quote:
      "We replaced Google Docs for sprint planning. The zero-signup flow means even external contractors can jump in without a single email.",
    name: "Maya Chen",
    role: "Engineering Lead",
    initials: "MC",
    color: "#a78bfa",
  },
  {
    quote:
      "The sync is genuinely instant. No 'syncing…' spinners, no conflict dialogs. It just works like a local app that happens to be shared.",
    name: "Daniel Okonkwo",
    role: "Founder, Basecase",
    initials: "DO",
    color: "#34d399",
  },
  {
    quote:
      "I sent a 6-char code in Slack and my whole team was editing within 15 seconds. That's the entire product thesis, delivered.",
    name: "Sarah Kim",
    role: "Product Manager",
    initials: "SK",
    color: "#fb923c",
  },
];

function EditableBlock({
  children,
  onFocus,
  onBlur,
  isCode = false,
}: {
  children: React.ReactNode;
  onFocus: () => void;
  onBlur: () => void;
  isCode?: boolean;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-white/[0.03]">
      <span className="select-none pt-0.5 text-[10px] leading-none text-white/15 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        ⋮⋮
      </span>
      <div
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={onFocus}
        onBlur={onBlur}
        className={
          isCode
            ? "flex-1 cursor-text font-mono text-[13px] leading-[1.7] text-white/60 outline-none focus:text-white/85"
            : "flex-1 cursor-text text-sm leading-[1.6] text-white/55 outline-none focus:text-white/85"
        }
      >
        {children}
      </div>
    </div>
  );
}

function PlayableMockup() {
  const cardRef = useRef<HTMLDivElement>(null);
  const cursorArjunRef = useRef<HTMLDivElement>(null);
  const cursorPriyaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let raf: number;
    let t = 0;
    const animate = () => {
      t += 0.015;
      if (cursorArjunRef.current) {
        cursorArjunRef.current.style.transform = `translate(${Math.sin(t) * 8}px, ${Math.cos(t * 0.7) * 6}px)`;
      }
      if (cursorPriyaRef.current) {
        cursorPriyaRef.current.style.transform = `translate(${Math.cos(t * 0.8) * 10}px, ${Math.sin(t * 1.1) * 5}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCopy = async () => {
    const code = document.querySelector(".code-content-pre") as HTMLElement;
    if (code) {
      await navigator.clipboard.writeText(code.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleFocus = () => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow =
        "0 40px 96px rgba(0,0,0,0.65), 0 0 40px rgba(139,92,246,0.12), 0 0 0 1px rgba(255,255,255,0.04) inset";
    }
    setSynced(true);
  };

  const handleBlur = () => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow = "";
    }
  };

  const codeContent = `const sync = async () => {
  const doc = await crdt.open(id);
  doc.on('change', (ops) => {
    applyOps(ops); // live 🔥
  });
};`;

  return (
    <div className="relative w-full max-w-[520px]">
      {/* Glow */}
      <div
        className="pointer-events-none absolute -z-10"
        style={{
          inset: "-50px",
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.12) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)",
          animation: "glowPulse 5s ease-in-out infinite alternate",
        }}
      />
      {/* Shadow cards */}
      <div
        className="absolute rounded-[18px] border border-white/[0.03] bg-white/[0.01]"
        style={{ top: 24, left: 24, right: -24, bottom: -24, opacity: 0.4 }}
      />
      <div
        className="absolute rounded-[18px] border border-white/[0.03] bg-white/[0.01]"
        style={{ top: 12, left: 12, right: -12, bottom: -12 }}
      />

      {/* Main card */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
        style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset" }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3.5 border-b border-white/[0.05] bg-white/[0.02] px-[18px] py-3.5">
          <div className="flex gap-[7px]">
            <span className="block h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
            <span className="block h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
            <span
              className="block h-[11px] w-[11px] rounded-full bg-[#28c840]"
              style={{ animation: "pulseGreen 2.5s ease-in-out infinite" }}
            />
          </div>
          <div
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="flex-1 cursor-text text-[12.5px] font-medium tracking-[-0.1px] text-white/35 outline-none focus:text-white/70"
          >
            Q3 Planning — Team Docs
          </div>
          <div className="flex gap-1.5">
            {avatars.map((a) => (
              <div
                key={a.name}
                title={a.name}
                className="flex h-7 w-7 cursor-default items-center justify-center rounded-full border-2 bg-black/50 text-[9px] font-bold tracking-wide transition-transform duration-200 hover:scale-110"
                style={{ borderColor: a.color, color: a.color }}
              >
                {a.initials}
              </div>
            ))}
            <div
              title="You"
              className="flex h-7 w-7 cursor-default items-center justify-center rounded-full border-2 bg-black/50 text-[9px] font-bold tracking-wide transition-transform duration-200 hover:scale-110"
              style={{ borderColor: "#60a5fa", color: "#60a5fa", animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              YO
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-7 pb-8 pt-7">
          <div className="mb-1.5 text-[26px]">📄</div>
          <div
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="mb-5 cursor-text text-[22px] font-bold tracking-[-0.6px] text-white outline-none"
          >
            Q3 Roadmap
          </div>

          <EditableBlock onFocus={handleFocus} onBlur={handleBlur}>
            Launch dark-mode dashboard
          </EditableBlock>
          <EditableBlock onFocus={handleFocus} onBlur={handleBlur}>
            Refactor auth flow with OAuth2
          </EditableBlock>

          {/* Code block — with live highlighting to match the editor */}
          <div className="group my-2.5 mb-3.5 overflow-hidden rounded-[10px] border border-white/[0.06] bg-black/35 transition-colors hover:bg-black/40">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-3.5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/30">typescript</span>
              <span
                onClick={handleCopy}
                className="cursor-pointer text-[10px] font-medium text-white/25 transition-colors hover:text-white/55"
              >
                {copied ? "Copied!" : "Copy"}
              </span>
            </div>
            <pre
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="code-content-pre m-0 cursor-text whitespace-pre-wrap px-3.5 py-3 font-mono text-[12.5px] leading-[1.7] text-white/60 outline-none focus:text-white/85"
            >
              {codeContent}
            </pre>
          </div>

          <EditableBlock onFocus={handleFocus} onBlur={handleBlur}>
            Update landing page animations
          </EditableBlock>

          {/* Live cursors */}
          <div
            ref={cursorArjunRef}
            className="pointer-events-none absolute z-10 flex items-start gap-1.5"
            style={{ left: 28, top: 166 }}
          >
            <div className="h-5 w-[2.5px] rounded-sm" style={{ background: "#a78bfa", animation: "blink 1.2s step-start infinite" }} />
            <div className="mt-[-2px] whitespace-nowrap rounded-[5px] px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "#a78bfa" }}>
              Arjun
            </div>
          </div>
          <div
            ref={cursorPriyaRef}
            className="pointer-events-none absolute z-10 flex items-start gap-1.5"
            style={{ left: "58%", top: 206 }}
          >
            <div className="h-5 w-[2.5px] rounded-sm" style={{ background: "#34d399", animation: "blink 1.2s step-start infinite 0.4s" }} />
            <div className="mt-[-2px] whitespace-nowrap rounded-[5px] px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#34d399", color: "#0a0a0a" }}>
              Priya
            </div>
          </div>

          {/* Sync indicator — fires when you focus a block */}
          <div
            className="mt-[72px] flex items-center gap-2.5 rounded-[10px] border px-4 py-3 transition-all duration-300"
            style={{
              background: synced ? "rgba(52,211,153,0.07)" : "rgba(251,146,60,0.06)",
              borderColor: synced ? "rgba(52,211,153,0.18)" : "rgba(251,146,60,0.12)",
            }}
          >
            <span className="flex-shrink-0 text-base">{synced ? "✅" : "💡"}</span>
            <p className="text-[13px] text-white/45">
              {synced ? "Synced — your edits are live for everyone." : "Try typing in any block above — it really works."}
            </p>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div
        className="mt-5 flex items-center justify-center gap-2 text-xs text-white/20"
        style={{ animation: "fadeUp 0.8s 0.6s both" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
        Click any block to start editing
      </div>

      <style>{`
        @keyframes glowPulse {
          from { opacity: 0.6; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1.03); }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(40,200,64,0.4); }
          50% { box-shadow: 0 0 0 5px rgba(40,200,64,0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 40px); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, -30px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

function StatNumber({ stat }: { stat: (typeof stats)[number] }) {
  const { ref, value } = useCountUp<HTMLDivElement>(stat.isZero ? 0 : stat.value, {
    duration: 1400,
    decimals: stat.decimals ?? 0,
  });
  return (
    <div ref={ref} className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
      {stat.prefix}
      {stat.isZero ? "Zero" : value}
      {stat.suffix}
    </div>
  );
}

type LandingUser = {
  name: string;
  avatarUrl: string | null;
};

function LandingUserPill({ user }: { user: LandingUser }) {
  return (
    <Link
      to="/profile"
      title="Profile settings"
      className="group inline-flex h-11 max-w-[260px] items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.055] py-1 pl-1.5 pr-4 text-sm font-semibold text-white/70 no-underline shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-px hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-1 ring-white/[0.10] transition-transform duration-200 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white/70 ring-1 ring-white/[0.10]">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate">{user.name}</span>
    </Link>
  );
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <main
      className="relative min-h-screen overflow-x-hidden antialiased text-[#e8e8e8]"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#070708",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Ambient orbs */}
      <div
        className="fixed pointer-events-none -z-0 rounded-full"
        style={{
          top: "-10%",
          right: "-5%",
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orbFloat1 24s ease-in-out infinite",
        }}
      />
      <div
        className="fixed pointer-events-none -z-0 rounded-full"
        style={{
          bottom: "-15%",
          left: "-8%",
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orbFloat2 28s ease-in-out infinite",
        }}
      />

      <div className="relative z-10">
        {/* ── NAV ── */}
        <nav
          className="sticky top-0 z-[100] flex items-center justify-between border-b border-white/[0.04] px-6 py-4 sm:px-10"
          style={{ background: "rgba(7,7,8,0.75)", backdropFilter: "blur(20px) saturate(1.2)", WebkitBackdropFilter: "blur(20px) saturate(1.2)" }}
        >
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="2" fill="white" opacity="0.9" />
              <rect x="12" y="2" width="8" height="8" rx="2" fill="white" opacity="0.5" />
              <rect x="2" y="12" width="8" height="8" rx="2" fill="white" opacity="0.5" />
              <rect x="12" y="12" width="8" height="8" rx="2" fill="white" opacity="0.25" />
            </svg>
            <span className="text-[15px] font-bold tracking-[-0.3px] text-white">Noteblock</span>
          </Link>
          <div className="flex items-center gap-2.5">
            {user ? (
              <LandingUserPill user={user} />
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white/45 no-underline transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/create"
                  className="rounded-[10px] bg-white px-[18px] py-2 text-sm font-semibold text-[#070708] no-underline transition-all hover:-translate-y-px hover:opacity-90"
                  style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                >
                  Start free
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-16 px-6 pb-20 pt-20 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
          <div style={{ animation: "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.01em]"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", color: "rgba(167,139,250,0.9)" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]"
                style={{ boxShadow: "0 0 8px rgba(167,139,250,0.6)", animation: "pulseDot 2s ease-in-out infinite" }}
              />
              Now with live code blocks
            </div>

            <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-1.5px] text-white sm:text-[56px]">
              Your team's notes,
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #a78bfa, #34d399)" }}
              >
                live and in sync.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/45">
              Share a code. Anyone joins instantly — no account, no setup. Edit together in real time with a block editor that stays out of your way.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/create"
                className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#070708] no-underline transition-all hover:-translate-y-0.5 hover:opacity-90"
                style={{ boxShadow: "0 8px 24px rgba(255,255,255,0.12)" }}
              >
                Create a group →
              </Link>
              <Link
                to="/join"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/80 no-underline transition-all hover:-translate-y-0.5 hover:bg-white/[0.06]"
              >
                Join with a code
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end" style={{ animation: "fadeUp 0.8s 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
            <PlayableMockup />
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 80}>
                <div className="text-center">
                  <StatNumber stat={stat} />
                  <div className="mt-2 text-[13px] text-white/40">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── FEATURES (bento) ── */}
        <section className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10">
          <Reveal>
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">What's inside</h2>
              <p className="mt-3 text-white/40">Everything your team needs, nothing it doesn't.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 60} as="div">
                <div
                  className={`group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.04] ${f.span}`}
                  style={{ boxShadow: "0 0 0 0 rgba(139,92,246,0)" }}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition-colors"
                    style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.18)" }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10">
          <Reveal>
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">How it works</h2>
              <p className="mt-3 text-white/40">From zero to editing together in 15 seconds.</p>
            </div>
          </Reveal>

          <div className="relative mx-auto max-w-2xl">
            {/* Vertical gradient connector */}
            <div
              className="absolute left-[27px] top-2 bottom-2 w-px"
              style={{ background: "linear-gradient(180deg, rgba(139,92,246,0.5), rgba(52,211,153,0.5))" }}
            />
            <div className="flex flex-col gap-8">
              {steps.map((step, i) => (
                <Reveal key={step.num} delay={i * 120} as="div">
                  <div className="relative flex gap-5">
                    <div
                      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#070708] text-sm font-bold"
                      style={{ color: "#a78bfa" }}
                    >
                      {step.num}
                    </div>
                    <div className="pt-2">
                      <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/45">{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10">
          <Reveal>
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Teams that switched.</h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 100} as="div">
                <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]">
                  <p className="text-[15px] leading-relaxed text-white/70">“{t.quote}”</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="text-xs text-white/40">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-[1280px] px-6 py-24 sm:px-10">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-12 text-center sm:p-20">
              <div
                className="absolute inset-0 -z-10"
                style={{ background: "radial-gradient(circle at 50% 0%, rgba(139,92,246,0.15), transparent 70%)" }}
              />
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">Ready to write together?</h2>
              <p className="mx-auto mt-4 max-w-md text-white/45">
                Create a group, share the code, and start editing in real time. No account required.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/create"
                  className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#070708] no-underline transition-all hover:-translate-y-0.5 hover:opacity-90"
                  style={{ boxShadow: "0 8px 24px rgba(255,255,255,0.15)" }}
                >
                  Create a group →
                </Link>
                <Link
                  to="/join"
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/80 no-underline transition-all hover:-translate-y-0.5 hover:bg-white/[0.06]"
                >
                  Join with a code
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/[0.04] py-8">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 sm:px-10">
            <div className="flex items-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="2" fill="white" opacity="0.9" />
                <rect x="12" y="2" width="8" height="8" rx="2" fill="white" opacity="0.5" />
                <rect x="2" y="12" width="8" height="8" rx="2" fill="white" opacity="0.5" />
                <rect x="12" y="12" width="8" height="8" rx="2" fill="white" opacity="0.25" />
              </svg>
              <span className="text-sm font-semibold text-white/60">Noteblock</span>
            </div>
            <span className="text-xs text-white/30">© 2026 Noteblock</span>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </main>
  );
}
