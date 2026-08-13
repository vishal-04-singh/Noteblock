import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { listPages, createPage, mergeSetCookie } from "~/lib/pages.server";

/**
 * This route no longer renders a page list. Instead it:
 *   1. Fetches all pages in the group
 *   2. If pages exist → redirect to the first one
 *   3. If no pages → create an "Untitled" page, then redirect to it
 *
 * The note page's sidebar already shows all pages, so this
 * intermediate list screen was redundant.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId!;
  const result = await listPages(request, groupId);

  if (result.status === 403) {
    return redirect("/join");
  }
  if (!result.ok) {
    throw new Response(result.data?.error || "Couldn't load pages.", {
      status: result.status,
    });
  }

  const pages = result.data.pages as { id: string }[];

  // If pages exist, redirect to the first one
  if (pages.length > 0) {
    return redirect(`/group/${groupId}/pages/${pages[0].id}`);
  }

  // No pages — create one and redirect
  const createResult = await createPage(request, groupId, "Untitled");
  if (!createResult.ok) {
    throw new Response(createResult.data?.error || "Couldn't create a page.", {
      status: createResult.status,
    });
  }

  const headers = mergeSetCookie(new Headers(), createResult.setCookie);
  return redirect(`/group/${groupId}/pages/${createResult.data.page.id}`, { headers });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const groupId = params.groupId!;
  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || undefined;

  const result = await createPage(request, groupId, title || "Untitled", parentId);

  if (!result.ok) {
    throw new Response(result.data?.error || "Couldn't create page.", {
      status: result.status,
    });
  }

  const headers = mergeSetCookie(new Headers(), result.setCookie);
  return redirect(`/group/${groupId}/pages/${result.data.page.id}`, { headers });
}

// This component should never render (the loader always redirects),
// but React Router requires a default export.
export default function PagesRedirect() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)" }}
    >
      <p className="text-sm">Redirecting…</p>
    </main>
  );
}
