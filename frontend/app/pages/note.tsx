import { useEffect, useRef, useState } from "react";
import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useFetcher,
  useParams,
  useNavigate,
  Link,
  redirect,
} from "react-router";
import type { Block } from "@blocknote/core";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  History,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  Users,
  X,
  Check,
  CornerDownRight,
} from "lucide-react";
import {
  getPage,
  savePage,
  listPages,
  listRevisions,
  setPageShare,
  mergeSetCookie,
} from "~/lib/pages.server";
import { getUser, getBackendUrl } from "~/lib/auth.server";
import { ThemeToggle } from "~/components/ThemeToggle";

export const meta: MetaFunction = () => [{ title: "Note · Notes" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId!;
  const pageId = params.pageId!;

  const [pageResult, pagesResult] = await Promise.all([
    getPage(request, groupId, pageId),
    listPages(request, groupId),
  ]);

  if (pageResult.status === 403) return redirect("/join");
  if (pageResult.status === 404) {
    throw new Response("Page not found.", { status: 404 });
  }
  if (!pageResult.ok) {
    throw new Response(pageResult.data?.error || "Couldn't load page.", {
      status: pageResult.status,
    });
  }

  const allPages = pagesResult.ok
    ? (pagesResult.data.pages as import("~/lib/pages.server").PageSummary[])
    : [];
  const groupInfo = pagesResult.ok && pagesResult.data.group
    ? (pagesResult.data.group as { name: string; code: string })
    : null;

  const backendUrl = getBackendUrl();
  const cookie = request.headers.get("Cookie");
  const headers = cookie ? { Cookie: cookie } : undefined;

  let favoritePageIds: string[] = [];
  try {
    const favRes = await fetch(`${backendUrl}/group/${groupId}/favorites`, { headers });
    if (favRes.ok) {
      const d = await favRes.json();
      favoritePageIds = d.favoritePageIds || [];
    }
  } catch {}

  let members: { id: string; name: string; avatarUrl: string | null; role: string; isGuest: boolean }[] = [];
  try {
    const memRes = await fetch(`${backendUrl}/group/${groupId}/members`, { headers });
    if (memRes.ok) {
      const d = await memRes.json();
      members = d.members || [];
    }
  } catch {}

  const user = await getUser(request);

  return {
    groupId,
    page: pageResult.data.page as import("~/lib/pages.server").Page,
    allPages,
    groupInfo,
    frontendOrigin: new URL(request.url).origin,
    favoritePageIds,
    members,
    user,
    backendUrl,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const groupId = params.groupId!;
  const pageId = params.pageId!;
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "save") {
    const content = JSON.parse(String(formData.get("content") || "[]"));
    const title = String(formData.get("title") || "");

    const result = await savePage(request, groupId, pageId, { content, title });
    if (!result.ok) {
      return Response.json(
        { error: result.data?.error || "Couldn't save." },
        { status: result.status }
      );
    }
    const headers = mergeSetCookie(new Headers(), result.setCookie);
    return Response.json({ page: result.data.page }, { headers });
  }

  if (intent === "toggle-share") {
    const isPublic = formData.get("isPublic") === "true";
    const result = await setPageShare(request, groupId, pageId, isPublic);
    if (!result.ok) {
      return Response.json(
        { error: result.data?.error || "Couldn't update sharing." },
        { status: result.status }
      );
    }
    const headers = mergeSetCookie(new Headers(), result.setCookie);
    return Response.json({ page: result.data.page }, { headers });
  }

  if (intent === "list-history") {
    const result = await listRevisions(request, groupId, pageId);
    if (!result.ok) {
      return Response.json(
        { error: result.data?.error || "Couldn't load history." },
        { status: result.status }
      );
    }
    return Response.json({ revisions: result.data.revisions });
  }

  if (intent === "delete-page") {
    const deletePageId = String(formData.get("pageId"));
    const cookie = request.headers.get("Cookie");
    const res = await fetch(`${getBackendUrl()}/group/${groupId}/pages/${deletePageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (!res.ok) return Response.json({ error: "Couldn't delete page." }, { status: res.status });
    return Response.json({ deleted: true });
  }

  if (intent === "duplicate-page") {
    const dupPageId = String(formData.get("pageId"));
    const cookie = request.headers.get("Cookie");
    const res = await fetch(`${getBackendUrl()}/group/${groupId}/pages/${dupPageId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return Response.json({ error: "Couldn't duplicate." }, { status: res.status });
    return Response.json({ duplicated: true, page: data?.page });
  }
  if (intent === "restore-revision") {
    const revisionId = String(formData.get("revisionId"));
    const cookie = request.headers.get("Cookie");
    const res = await fetch(`${getBackendUrl()}/group/${groupId}/pages/${pageId}/restore/${revisionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return Response.json({ error: "Couldn't restore." }, { status: res.status });
    return Response.json({ restored: true, page: data?.page });
  }

  if (intent === "toggle-favorite") {
    const favPageId = String(formData.get("pageId"));
    const cookie = request.headers.get("Cookie");
    const res = await fetch(`${getBackendUrl()}/group/${groupId}/pages/${favPageId}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const data = await res.json().catch(() => null);
    return Response.json({ favorited: data?.favorited });
  }

  if (intent === "rename-page") {
    const renamePageId = String(formData.get("pageId"));
    const newTitle = String(formData.get("newTitle"));
    const cookie = request.headers.get("Cookie");
    const res = await fetch(`${getBackendUrl()}/group/${groupId}/pages/${renamePageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) return Response.json({ error: "Couldn't rename." }, { status: res.status });
    return Response.json({ renamed: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}

function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function useMountTransition(active: boolean) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!active) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [active]);
  return entered;
}

export default function NotePage() {
  const { groupId, page, allPages, groupInfo, frontendOrigin, favoritePageIds, members, user, backendUrl } =
    useLoaderData<typeof loader>();
  const params = useParams();
  const navigate = useNavigate();
  const mounted = useIsMounted();

  const saveFetcher = useFetcher();
  const shareFetcher = useFetcher();
  const historyFetcher = useFetcher();
  const newPageFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [title, setTitle] = useState(page.title);

  useEffect(() => {
    setTitle(page.title);
  }, [page.id, page.title]);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string; title: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [favIds, setFavIds] = useState<Set<string>>(new Set(favoritePageIds));
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const historyEntered = useMountTransition(historyOpen);
  const shareEntered = useMountTransition(shareOpen);
  const menuEntered = useMountTransition(!!contextMenu);
  const profileMenuEntered = useMountTransition(profileMenuOpen);

  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setContextMenu(null);
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const latestBlocksRef = useRef<Block[] | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialContent = Array.isArray(page.content)
    ? (page.content as Block[])
    : undefined;

  function scheduleSave(blocks: Block[]) {
    latestBlocksRef.current = blocks;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveFetcher.submit(
        {
          intent: "save",
          content: JSON.stringify(latestBlocksRef.current),
          title,
        },
        { method: "post" }
      );
    }, 900);
  }

  function handleTitleBlur() {
    saveFetcher.submit(
      {
        intent: "save",
        content: JSON.stringify(latestBlocksRef.current ?? initialContent ?? []),
        title,
      },
      { method: "post" }
    );
  }

  function openHistory() {
    setHistoryOpen(true);
    historyFetcher.submit({ intent: "list-history" }, { method: "post" });
  }

  function toggleShare(next: boolean) {
    shareFetcher.submit(
      { intent: "toggle-share", isPublic: String(next) },
      { method: "post" }
    );
  }

  function createNewPage(parentId?: string) {
    newPageFetcher.submit(
      { title: "Untitled", ...(parentId ? { parentId } : {}) },
      { method: "post", action: `/group/${groupId}/pages` }
    );
  }

  function handleContextMenu(e: React.MouseEvent, p: { id: string; title: string }) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageId: p.id, title: p.title });
  }

  function toggleFavorite(pageId: string) {
    const next = new Set(favIds);
    if (next.has(pageId)) next.delete(pageId);
    else next.add(pageId);
    setFavIds(next);
    actionFetcher.submit({ intent: "toggle-favorite", pageId }, { method: "post" });
  }

  function handleRenameSubmit(e: React.FormEvent, pageId: string) {
    e.preventDefault();
    if (!renameValue.trim()) return;
    actionFetcher.submit({ intent: "rename-page", pageId, newTitle: renameValue }, { method: "post" });
    setRenamingId(null);
  }

  const sharePage = (shareFetcher.data?.page as typeof page | undefined) ?? page;
  const publicUrl = sharePage.publicSlug ? `${frontendOrigin}/p/${sharePage.publicSlug}` : null;

  function downloadMarkdown() {
    import("@blocknote/core").then(async ({ BlockNoteEditor }) => {
      const editor = BlockNoteEditor.create({
        initialContent: (latestBlocksRef.current ?? initialContent) || undefined,
      });
      const markdown = await editor.blocksToMarkdownLossy(editor.document);

      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "untitled"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const savingLabel =
    saveFetcher.state === "submitting"
      ? "Saving…"
      : saveFetcher.data?.page
        ? "Saved"
        : "";

  const favPages = allPages.filter(p => favIds.has(p.id));

  return (
    <main className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <style>{`
        .glass-btn:hover {
          border-color: color-mix(in srgb, rgb(var(--accent)) 45%, transparent) !important;
          box-shadow: 0 0 0 1px color-mix(in srgb, rgb(var(--accent)) 18%, transparent),
                      0 10px 24px -14px color-mix(in srgb, rgb(var(--accent)) 65%, transparent);
        }
        .glass-btn-primary {
          background: linear-gradient(135deg,
            color-mix(in srgb, rgb(var(--accent)) 92%, white 8%),
            color-mix(in srgb, rgb(var(--accent)) 78%, black 10%));
          box-shadow: 0 8px 20px -10px color-mix(in srgb, rgb(var(--accent)) 75%, transparent);
          color: #fff;
        }
        .glass-btn-primary:hover {
          filter: brightness(1.08);
          box-shadow: 0 10px 26px -10px color-mix(in srgb, rgb(var(--accent)) 80%, transparent);
        }
        .glass-btn-primary--off {
          background: color-mix(in srgb, var(--surface-1) 45%, transparent) !important;
          border: 1px solid var(--border) !important;
          color: var(--text-secondary) !important;
          text-shadow: none;
          box-shadow: none;
        }
        .glass-btn-primary--off:hover {
          background: var(--surface-2) !important;
          color: var(--text-primary) !important;
          border-color: color-mix(in srgb, rgb(var(--accent)) 45%, transparent) !important;
        }
        
        .note-editor-wrapper .bn-container {
          outline: none !important;
        }
        .note-editor-wrapper [contenteditable]:focus {
          outline: none !important;
        }
        
        .note-editor-wrapper .bn-editor {
          padding-inline: 0 !important;
        }
        .note-search {
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .note-search::placeholder {
          color: var(--text-quaternary, rgba(255,255,255,0.25));
        }
        .note-search-wrap {
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .note-search-wrap:hover {
          background: color-mix(in srgb, var(--surface-2, rgba(255,255,255,0.04)) 90%, transparent);
        }
        .note-search-wrap:focus-within {
          border-color: color-mix(in srgb, rgb(var(--accent, 201 162 75)) 45%, transparent) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, rgb(var(--accent, 201 162 75)) 10%, transparent);
          background: color-mix(in srgb, var(--surface-2, rgba(255,255,255,0.04)) 85%, transparent) !important;
        }
        .note-page-row { border: 1px solid transparent; }
        .note-page-row:hover { background: color-mix(in srgb, var(--surface-2, rgba(255,255,255,0.06)) 80%, transparent); }
        .note-active-row {
          background: color-mix(in srgb, var(--surface-2, rgba(255,255,255,0.06)) 82%, transparent);
          border-color: var(--border, rgba(255,255,255,0.08));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.045);
        }
        .note-title-rule { transition: opacity 250ms ease; }
        .note-title-wrap:focus-within .note-title-rule { opacity: 1; }
        .profile-card:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .group-name-pill {
          transition: background 150ms ease;
        }
        .group-name-pill:hover {
          background: rgba(255,255,255,0.04);
        }

        /* skeleton (hoisted so it's not re-injected per mount) */
        @keyframes note-skeleton-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .note-skeleton-line {
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--surface-2, #1a1a1a) 100%, transparent) 25%,
            color-mix(in srgb, rgb(var(--accent, 139 92 246)) 12%, var(--surface-2, #1a1a1a)) 50%,
            color-mix(in srgb, var(--surface-2, #1a1a1a) 100%, transparent) 75%
          );
          background-size: 200% 100%;
          animation: note-skeleton-shimmer 1.6s ease-in-out infinite;
        }

      `}</style>

      <aside
        className={`note-sidebar flex h-full shrink-0 flex-col ${
          sidebarOpen ? "note-sidebar--open" : "note-sidebar--closed"
        }`}
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'transparent',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >

        <div className="flex mt-2 h-[52px] items-center justify-between px-4" >
          <div className="group-name-pill flex items-center gap-2.5 min-w-0 rounded-xl px-2 py-1.5 -mx-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-wide"
              style={{
                background: 'color-mix(in srgb, var(--surface-2) 86%, transparent)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {groupInfo?.name?.slice(0, 1).toUpperCase() || "G"}
            </div>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {groupInfo?.name || "Group"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <PanelLeftClose size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="px-3 py-2">
          <div
            className="note-search-wrap flex items-center gap-2 rounded-xl px-2.5 py-1.5"
            style={{
              background: 'color-mix(in srgb, var(--surface-2) 70%, transparent)',
              border: '1px solid var(--border)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.06)',
            }}>
            <Search size={13} strokeWidth={2} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="note-search w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => createNewPage()}
            disabled={newPageFetcher.state === "submitting"}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-white/[0.06] transition-colors disabled:opacity-60"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--surface-2) 86%, transparent)',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <Plus size={10} strokeWidth={2.2} color="white" />
            </span>
            {newPageFetcher.state === "submitting" ? "Creating…" : "New page"}
          </button>
        </div>

        {/* Added scroll-smooth class here */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 scroll-smooth">
          {favPages.length > 0 && !searchQuery && (
            <div className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Favorites
              </p>
              <ul className="flex flex-col gap-0.5">
                {favPages.map((p) => (
                  <li key={p.id} onContextMenu={(e) => handleContextMenu(e, p)}>
                    {renamingId === p.id ? (
                      <form onSubmit={(e) => handleRenameSubmit(e, p.id)} className="flex items-center px-2.5 py-1.5">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => setRenamingId(null)}
                          className="w-full bg-transparent text-sm outline-none"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </form>
                    ) : (
                      <Link
                        to={`/group/${groupId}/pages/${p.id}`}
                        className={`note-page-row flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                          p.id === page.id
                            ? "note-active-row font-medium"
                            : ""
                        }`}
                        style={{ color: p.id === page.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        <FileText
                          size={14}
                          strokeWidth={1.6}
                          className="shrink-0"
                          style={{ opacity: p.id === page.id ? 0.9 : 0.5 }}
                        />
                        <span className="truncate">{p.title || "Untitled"}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            Pages
          </p>
          <PageTree
            pages={allPages}
            groupId={groupId}
            currentPageId={page.id}
            searchQuery={searchQuery}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameValue={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingId(null)}
            onContextMenu={handleContextMenu}
          />

          <div className="mt-4">
            <button 
              onClick={() => setMembersExpanded(!membersExpanded)} 
              className="flex w-full items-center justify-between px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest hover:text-white/50 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <span className="flex items-center gap-1.5">
                <Users size={11} strokeWidth={2} />
                Members ({members.length})
              </span>
              <span>{membersExpanded ? "−" : "+"}</span>
            </button>
            {membersExpanded && (
              <ul className="flex flex-col gap-0.5 mt-1">
                {members.map(m => (
                  <li key={m.id} className="px-2 py-1 flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate">{m.name}</span>
                    {m.isGuest && (
                      <span
                        className="ml-auto text-[9px] px-1 rounded"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      >
                        Guest
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="relative px-3 py-3" style={{ borderColor: 'var(--border)' }} ref={profileMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setProfileMenuOpen((v) => !v);
            }}
            className="profile-card flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {(user?.name || "Guest").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {user?.name || "Guest"}
            </span>
            <Settings size={16} strokeWidth={2} style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {profileMenuOpen && (
            <div
              className="absolute bottom-full left-3 right-3 z-50 mb-2 overflow-hidden rounded-xl border py-1.5 backdrop-blur-xl transition-all duration-150 ease-out"
              style={{
                background: 'color-mix(in srgb, var(--surface-1) 92%, transparent)',
                borderColor: 'var(--border)',
                boxShadow: '0 20px 40px -16px rgba(0,0,0,0.6)',
                opacity: profileMenuEntered ? 1 : 0,
                transform: profileMenuEntered ? 'translateY(0)' : 'translateY(6px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Settings size={14} strokeWidth={2} />
                    Profile settings
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`${backendUrl}/auth/logout`, { method: "POST", credentials: "include" });
                      window.location.href = "/login";
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-white/[0.06] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <ArrowLeft size={14} strokeWidth={2} />
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden p-2 pl-0 mx-2">
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
        <header
          className="flex h-[52px] shrink-0 items-center justify-between px-6 rounded-t-2xl"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ 
                  background: 'var(--surface-1)', 
                  border: '1px solid var(--border)', 
                  color: 'var(--text-tertiary)' 
                }}
              >
                <PanelLeft size={15} strokeWidth={2} />
              </button>
            )}
            <Link
              to={`/home`}
              className="flex items-center gap-2 text-xs transition-colors duration-150 hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={13} strokeWidth={2} />
              All pages
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>
              {saveFetcher.state === "submitting" && (
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'rgb(var(--accent))' }} />
              )}
              {savingLabel}
            </span>

            <HeaderButton onClick={downloadMarkdown}>
              <Download size={14} strokeWidth={2} /> .md
            </HeaderButton>

            <HeaderButton onClick={openHistory}>
              <History size={14} strokeWidth={2} /> History
            </HeaderButton>

            <ThemeToggle />

            <HeaderButton variant="primary" active={sharePage.isPublic} onClick={() => setShareOpen(true)}>
              <Share2 size={14} strokeWidth={2} /> {sharePage.isPublic ? "Shared" : "Share"}
            </HeaderButton>
          </div>
        </header>

        {/* Added scroll-smooth class here */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <section
            className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:px-7 note-editor-section"
            style={{
              minHeight: '60vh',
            }}
          >
            <>
                <div className="note-title-wrap relative mb-2">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-white/20"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <span
                    aria-hidden
                    className="note-title-rule pointer-events-none absolute -bottom-1 left-0 h-[2px] w-28 opacity-30"
                    style={{ background: 'linear-gradient(90deg, color-mix(in srgb, rgb(var(--accent)) 85%, white 10%), transparent)' }}
                  />
                </div>
                <p className="mb-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {page.lastEditedByName
                    ? `Last edited by ${page.lastEditedByName}`
                    : "No edits yet"}
                </p>
                <div
                  className="note-editor-wrapper"
                  style={{
                    borderRadius: 20,
                    background: 'transparent',
                  }}
                >
                  {mounted ? (
                    <NoteEditorLoader
                      key={page.id}
                      initialContent={initialContent}
                      onChange={scheduleSave}
                    />
                  ) : (
                    <EditorSkeleton />
                  )}
                </div>
            </>
          </section>
        </div>
        </div>
      </div>
      
      {historyOpen && (
        <HistoryPanel
          entered={historyEntered}
          onClose={() => setHistoryOpen(false)}
          isLoading={historyFetcher.state === "submitting"}
          revisions={
            (historyFetcher.data?.revisions as
              | import("~/lib/pages.server").Revision[]
              | undefined) ?? []
          }
          onRestore={(revisionId) => {
            actionFetcher.submit(
              { intent: "restore-revision", revisionId },
              { method: "post" }
            );
            setHistoryOpen(false);
          }}
        />
      )}

      {shareOpen && (
        <SharePanel
          entered={shareEntered}
          onClose={() => setShareOpen(false)}
          isPublic={sharePage.isPublic}
          publicUrl={publicUrl}
          onToggle={toggleShare}
          isSaving={shareFetcher.state === "submitting"}
          copyLabel={copyLabel}
          onCopy={() => {
            if (!publicUrl) return;
            navigator.clipboard.writeText(publicUrl);
            setCopyLabel("Copied!");
            setTimeout(() => setCopyLabel("Copy link"), 1500);
          }}
        />
      )}

      {contextMenu && (
        <div 
          className="context-menu fixed z-50 rounded-xl border py-1.5 shadow-xl min-w-[190px] backdrop-blur-xl transition-all duration-150 ease-out overflow-hidden"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            background: 'color-mix(in srgb, var(--surface-1) 92%, transparent)',
            borderColor: 'var(--border)',
            boxShadow: '0 20px 44px -14px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
            opacity: menuEntered ? 1 : 0,
            transform: menuEntered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(-4px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div aria-hidden className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, rgb(var(--accent)) 55%, transparent), transparent)' }} />
          <button 
            className="context-menu-item mt-1"
            onClick={() => {
              setRenamingId(contextMenu.pageId);
              setRenameValue(contextMenu.title);
              setContextMenu(null);
            }}
          >
            <Pencil size={14} strokeWidth={2} />
            Rename
          </button>
          <button 
            className="context-menu-item"
            onClick={() => {
              toggleFavorite(contextMenu.pageId);
              setContextMenu(null);
            }}
          >
            <Star size={14} strokeWidth={2} fill={favIds.has(contextMenu.pageId) ? "currentColor" : "none"} />
            {favIds.has(contextMenu.pageId) ? "Remove from favorites" : "Add to favorites"}
          </button>
          <button 
            className="context-menu-item"
            onClick={() => {
              actionFetcher.submit({ intent: "duplicate-page", pageId: contextMenu.pageId }, { method: "post" });
              setContextMenu(null);
            }}
          >
            <Copy size={14} strokeWidth={2} />
            Duplicate
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              createNewPage(contextMenu.pageId);
              setContextMenu(null);
            }}
          >
            <CornerDownRight size={14} strokeWidth={2} />
            Add nested page
          </button>
          <div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />
          <button 
            className="context-menu-item context-menu-item--danger"
            onClick={() => {
              const deletingCurrentPage = contextMenu.pageId === page.id;
              actionFetcher.submit({ intent: "delete-page", pageId: contextMenu.pageId }, { method: "post" });
              setContextMenu(null);
              if (deletingCurrentPage) {
                navigate(`/group/${groupId}/pages`);
              }
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      )}
    </main>
  );
}

function HeaderButton({
  children,
  onClick,
  variant = "outline",
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "outline" | "primary";
  disabled?: boolean;
  active?: boolean;
}) {
  if (variant === "primary") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`glass-btn-primary${active === false ? " glass-btn-primary--off" : ""} inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass-btn inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-white/[0.05] active:scale-[0.97] disabled:opacity-50"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
        background: 'color-mix(in srgb, var(--surface-1) 45%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {children}
    </button>
  );
}

type SidebarPage = import("~/lib/pages.server").PageSummary;

function PageTree({
  pages,
  groupId,
  currentPageId,
  searchQuery,
  renamingId,
  renameValue,
  onRenameValue,
  onRenameSubmit,
  onRenameCancel,
  onContextMenu,
}: {
  pages: SidebarPage[];
  groupId: string;
  currentPageId: string;
  searchQuery: string;
  renamingId: string | null;
  renameValue: string;
  onRenameValue: (value: string) => void;
  onRenameSubmit: (event: React.FormEvent, pageId: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (event: React.MouseEvent, page: { id: string; title: string }) => void;
}) {
  const children = new Map<string | null, SidebarPage[]>();
  for (const item of pages) {
    const key = item.parentId && pages.some((candidate) => candidate.id === item.parentId) ? item.parentId : null;
    children.set(key, [...(children.get(key) ?? []), item]);
  }
  const query = searchQuery.trim().toLowerCase();
  const isVisible = (item: SidebarPage): boolean =>
    !query || (item.title || "Untitled").toLowerCase().includes(query) || (children.get(item.id) ?? []).some(isVisible);

  const renderBranch = (parentId: string | null, depth = 0): React.ReactNode =>
    (children.get(parentId) ?? []).filter(isVisible).map((item) => {
      const hasChildren = (children.get(item.id) ?? []).some(isVisible);
      return (
        <li key={item.id} onContextMenu={(event) => onContextMenu(event, item)}>
          {renamingId === item.id ? (
            <form onSubmit={(event) => onRenameSubmit(event, item.id)} className="flex items-center px-2.5 py-1.5" style={{ paddingLeft: `${10 + depth * 14}px` }}>
              <input autoFocus value={renameValue} onChange={(event) => onRenameValue(event.target.value)} onBlur={onRenameCancel} className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
            </form>
          ) : (
            <Link
              to={`/group/${groupId}/pages/${item.id}`}
              className={`note-page-row flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${item.id === currentPageId ? "note-active-row font-medium" : ""}`}
              style={{ color: item.id === currentPageId ? "var(--text-primary)" : "var(--text-secondary)", marginLeft: `${depth * 14}px` }}
            >
              {depth > 0 ? <CornerDownRight size={12} strokeWidth={1.6} style={{ opacity: 0.38 }} /> : <FileText size={14} strokeWidth={1.6} style={{ opacity: item.id === currentPageId ? 0.9 : 0.5 }} />}
              <span className="truncate">{item.title || "Untitled"}</span>
              {hasChildren && <span className="ml-auto text-[10px]" style={{ color: "var(--text-quaternary)" }}>{children.get(item.id)?.filter(isVisible).length}</span>}
            </Link>
          )}
          {hasChildren && <ul className="flex flex-col gap-0.5">{renderBranch(item.id, depth + 1)}</ul>}
        </li>
      );
    });

  return <ul className="flex flex-col gap-0.5">{renderBranch(null)}</ul>;
}

function EditorSkeleton() {
  return (
    <div className="p-6" aria-hidden>
      <div className="note-skeleton-line mb-4 h-6 w-2/5" />
      <div className="mb-2.5 flex flex-col gap-2">
        <div className="note-skeleton-line h-3.5 w-full" />
        <div className="note-skeleton-line h-3.5 w-11/12" />
        <div className="note-skeleton-line h-3.5 w-4/5" />
      </div>
      <div className="note-skeleton-line mt-6 h-28 w-full" style={{ borderRadius: 12 }} />
      <div className="mt-6 flex flex-col gap-2">
        <div className="note-skeleton-line h-3.5 w-3/4" />
        <div className="note-skeleton-line h-3.5 w-1/2" />
      </div>
    </div>
  );
}

function NoteEditorLoader({
  initialContent,
  onChange,
}: {
  initialContent: Block[] | undefined;
  onChange: (blocks: Block[]) => void;
}) {
  const [Editor, setEditor] = useState<null | React.ComponentType<{
    initialContent: Block[] | undefined;
    onChange: (blocks: Block[]) => void;
  }>>(null);

  useEffect(() => {
    import("./NoteEditor").then((mod) => setEditor(() => mod.default));
  }, []);

  if (!Editor) {
    return <EditorSkeleton />;
  }

  return <Editor initialContent={initialContent} onChange={onChange} />;
}

function HistoryPanel({
  onClose,
  isLoading,
  revisions,
  onRestore,
  entered,
}: {
  onClose: () => void;
  isLoading: boolean;
  revisions: import("~/lib/pages.server").Revision[];
  onRestore: (revisionId: string) => void;
  entered: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-200 ease-out"
        style={{
          boxShadow: 'var(--shadow-modal)',
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(160px 90px at 100% 0%, color-mix(in srgb, rgb(var(--accent)) 20%, transparent), transparent 70%)' }}
        />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Edit history</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-xs hover:text-white/70"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              No saved versions yet — history builds up as you keep editing.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
                >
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {rev.editedByName || "Someone"}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(rev.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(rev.id)}
                    className="glass-btn-primary rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-[0.96]"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SharePanel({
  onClose,
  isPublic,
  publicUrl,
  onToggle,
  isSaving,
  copyLabel,
  onCopy,
  entered,
}: {
  onClose: () => void;
  isPublic: boolean;
  publicUrl: string | null;
  onToggle: (next: boolean) => void;
  isSaving: boolean;
  copyLabel: string;
  onCopy: () => void;
  entered: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-6"
      style={{ background: 'var(--glow-bg)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-200 ease-out"
        style={{
          boxShadow: 'var(--shadow-modal)',
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(160px 90px at 100% 0%, color-mix(in srgb, rgb(var(--accent)) 20%, transparent), transparent 70%)' }}
        />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Share page</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-xs transition-colors hover:opacity-70"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Public link</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Anyone with the link can view — no account or code needed.
              </p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onToggle(!isPublic)}
              aria-pressed={isPublic}
              aria-label="Toggle public link"
              className="relative h-6 w-11 shrink-0 rounded-full border transition-all duration-150 disabled:opacity-50"
              style={{
                background: isPublic
                  ? 'rgb(var(--accent))'
                  : 'var(--surface-3)',
                borderColor: isPublic
                  ? 'transparent'
                  : 'var(--border)',
                boxShadow: isPublic
                  ? '0 2px 8px -2px color-mix(in srgb, rgb(var(--accent)) 70%, transparent)'
                  : 'none',
              }}
            >
              <span
                className="absolute rounded-full bg-white shadow-sm transition-transform duration-150"
                style={{
                  top: '3px',
                  left: '3px',
                  height: '18px',
                  width: '18px',
                  transform: isPublic ? 'translateX(20px)' : 'translateX(0px)',
                }}
              />
            </button>
          </div>

          {isPublic && publicUrl && (
            <div
              className="mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--surface-2)' }}
            >
              <span className="flex-1 truncate text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {publicUrl}
              </span>
              <button
                type="button"
                onClick={onCopy}
                className="glass-btn shrink-0 flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
              >
                {publicUrl && copyLabel === "Copied!" ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                {copyLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
