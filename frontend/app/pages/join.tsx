import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Form, useLoaderData } from "react-router";
import { getUser, getBackendUrl } from "~/lib/auth.server";
import { PageBackButton } from "~/components/PageBackButton";

export const meta: MetaFunction = () => [{ title: "Join a group · Notes" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return { user };
}

type ActionData = { error: string } | undefined;

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getBackendUrl();
  const formData = await request.formData();

  const code = String(formData.get("code") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();

  if (!code) {
    return { error: "Enter a group code." };
  }

  const cookie = request.headers.get("Cookie");

  const res = await fetch(`${backendUrl}/group/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ code, displayName }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { error: data?.error || "Couldn't join that group. Try again." };
  }

  // Forward any Set-Cookie header from the backend (guest cookie) to the
  // browser, then redirect into the app.
  const setCookie = res.headers.get("set-cookie");
  const headers = new Headers();
  if (setCookie) headers.append("Set-Cookie", setCookie);

  const groupId = data?.group?.id;
  return redirect(groupId ? `/group/${groupId}/pages` : "/home", { headers });
}

export default function JoinPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData() as ActionData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main 
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="absolute left-6 top-6 z-10 sm:left-8">
        <PageBackButton />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white/[0.04] backdrop-blur-xl"
            style={{ borderColor: 'var(--border)' }}
          >
            <GroupMark />
          </div>
          <h1 
            className="text-xl font-medium tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Join a group
          </h1>
          <p className="text-sm text-white/40">
            Enter the code someone shared with you.
          </p>
        </div>

        <div
          className="rounded-2xl border bg-white/[0.04] p-6 backdrop-blur-xl"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)", borderColor: 'var(--border)' }}
        >
          {actionData?.error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="code"
                className="text-xs font-medium text-white/50"
              >
                Group code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="e.g. 7QK3PZ8M4VHT"
                maxLength={12}
                className="rounded-xl border px-3.5 py-2.5 text-sm placeholder:text-white/25 outline-none transition-colors duration-150 focus:border-white/[0.2] focus:bg-white/[0.05]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            </div>

            {!user && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="displayName"
                  className="text-xs font-medium text-white/50"
                >
                  Display name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  placeholder="What should we call you?"
                  maxLength={40}
                  className="rounded-xl border px-3.5 py-2.5 text-sm placeholder:text-white/25 outline-none transition-colors duration-150 focus:border-white/[0.2] focus:bg-white/[0.05]"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs text-white/30">
                  Already signed in? This is optional — we'll use your account
                  name instead.
                </p>
              </div>
            )}

            {user && (
              <p className="text-center text-sm text-white/50 mt-2">
                Signed in as <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex items-center justify-center rounded-xl border bg-white/[0.08] px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:bg-white/[0.14] hover:border-white/[0.2] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {isSubmitting ? "Joining…" : "Join group"}
            </button>
          </Form>

          {!user && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-xs uppercase tracking-wider text-white/30">
                  or
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <a
                href="/login"
                className="flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium text-white/70 transition-all duration-150 hover:bg-white/[0.04] hover:text-[var(--text-primary)] active:scale-[0.98]"
                style={{ borderColor: 'var(--border)' }}
              >
                Sign in instead
              </a>
            </>
          )}
        </div>

        {!user && (
          <p className="mt-6 text-center text-xs text-white/30">
            No account needed — you'll join as a guest with just a display name.
          </p>
        )}
      </div>
    </main>
  );
}

function GroupMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle
        cx="7"
        cy="7"
        r="3"
        stroke="var(--text-primary)"
        strokeOpacity="0.7"
        strokeWidth="1.4"
      />
      <circle
        cx="14"
        cy="9"
        r="2.3"
        stroke="var(--text-primary)"
        strokeOpacity="0.5"
        strokeWidth="1.4"
      />
      <path
        d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4"
        stroke="var(--text-primary)"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11.8 12.4c1.6.2 2.9 1.4 3.4 3.6"
        stroke="var(--text-primary)"
        strokeOpacity="0.5"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
