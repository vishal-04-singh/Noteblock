import { getBackendUrl } from "~/lib/auth.server";

export type PageSummary = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  updatedAt: string;
  createdAt: string;
  lastEditedByName: string | null;
  isPublic: boolean;
};

export type Page = {
  id: string;
  groupId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  content: unknown;
  isPublic: boolean;
  publicSlug: string | null;
  lastEditedByName: string | null;
  updatedAt: string;
  createdAt: string;
};

export type Revision = {
  id: string;
  pageId: string;
  editedByName: string | null;
  snapshot: unknown;
  createdAt: string;
};

function authHeaders(request: Request): HeadersInit {
  const cookie = request.headers.get("Cookie");
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

/**
 * Runs a fetch against the backend and returns both the parsed JSON and any
 * Set-Cookie header, so callers can forward guest cookies to the browser
 * the same way join/create already do.
 */
async function backendFetch(
  request: Request,
  path: string,
  init?: RequestInit
) {
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: { ...authHeaders(request), ...(init?.headers || {}) },
  });

  const data = await res.json().catch(() => null);
  const setCookie = res.headers.get("set-cookie");

  return { ok: res.ok, status: res.status, data, setCookie };
}

export async function listPages(request: Request, groupId: string) {
  return backendFetch(request, `/group/${groupId}/pages`);
}

export async function createPage(
  request: Request,
  groupId: string,
  title?: string,
  parentId?: string
) {
  return backendFetch(request, `/group/${groupId}/pages`, {
    method: "POST",
    body: JSON.stringify({ title, parentId }),
  });
}

export async function getPage(
  request: Request,
  groupId: string,
  pageId: string
) {
  return backendFetch(request, `/group/${groupId}/pages/${pageId}`);
}

export async function savePage(
  request: Request,
  groupId: string,
  pageId: string,
  body: { content?: unknown; title?: string }
) {
  return backendFetch(request, `/group/${groupId}/pages/${pageId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listRevisions(
  request: Request,
  groupId: string,
  pageId: string
) {
  return backendFetch(request, `/group/${groupId}/pages/${pageId}/revisions`);
}

export async function setPageShare(
  request: Request,
  groupId: string,
  pageId: string,
  isPublic: boolean
) {
  return backendFetch(request, `/group/${groupId}/pages/${pageId}/share`, {
    method: "POST",
    body: JSON.stringify({ isPublic }),
  });
}

export function mergeSetCookie(headers: Headers, setCookie: string | null) {
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return headers;
}
