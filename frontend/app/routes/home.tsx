import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "Noteblock — calm, collaborative notes" },
  { name: "description", content: "A focused space for notes your team can shape together." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  return { user: await getUser(request) };
}

function Mark() {
  return (
    <span className="landing-mark" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export default function LandingPage() {
  const { user } = useLoaderData<typeof loader>();
  const primaryTarget = user ? "/home" : "/login";

  return (
    <main className="landing-shell">
      <div className="landing-glow landing-glow--one" aria-hidden />
      <div className="landing-glow landing-glow--two" aria-hidden />

      <nav className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="Noteblock home">
          <Mark />
          <span>Noteblock</span>
        </Link>
        <Link to={primaryTarget} className="landing-text-link">
          {user ? "Open workspace" : "Sign in"}
        </Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow">A quieter workspace</p>
          <h1>Notes that leave room<br />for the thinking.</h1>
          <p className="landing-subtitle">
            Create a space, share one code, and keep the work beautifully simple.
          </p>
          <div className="landing-actions">
            <Link to={primaryTarget} className="landing-primary">
              {user ? "Continue to workspace" : "Get started"}
              <span aria-hidden>→</span>
            </Link>
            <Link to="/join" className="landing-secondary">Join with a code</Link>
          </div>
        </div>

        <div className="landing-preview" aria-label="Workspace preview">
          <div className="landing-preview__top">
            <div className="landing-preview__dots"><i /><i /><i /></div>
            <span>Product brief</span>
            <div className="landing-preview__avatar">A</div>
          </div>
          <div className="landing-preview__body">
            <div className="landing-preview__sidebar">
              <b>Notes</b>
              <span className="is-active">Overview</span>
              <span>Decisions</span>
              <span className="is-child">Launch checklist</span>
              <span>Research</span>
            </div>
            <article className="landing-preview__page">
              <div className="preview-kicker">THIS WEEK</div>
              <h2>Launch notes</h2>
              <p>One place for the small details that move the work forward.</p>
              <div className="preview-line preview-line--full" />
              <div className="preview-line preview-line--short" />
              <div className="preview-card"><span>✓</span> Keep the first release focused</div>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Private by default</span><i />
        <span>Guest-friendly</span><i />
        <span>Made for focus</span>
      </footer>
    </main>
  );
}
