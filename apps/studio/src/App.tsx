import { useMemo } from 'react';
import { parseStudioLaunchContext, STUDIO_BUILD, STUDIO_VERSION } from './studio-context.js';

export function StudioApp() {
  const launch = useMemo(() => parseStudioLaunchContext(window.location.search), []);

  return (
    <div className="studio-shell" data-build={STUDIO_BUILD}>
      <header className="studio-header">
        <div>
          <p className="eyebrow">GitHub Decrypter</p>
          <h1>Studio</h1>
        </div>
        <span className="build-badge">Build {STUDIO_BUILD} · {STUDIO_VERSION}</span>
      </header>

      <main className="studio-main">
        <section className="foundation-card" aria-labelledby="foundation-title">
          <div className="status-dot" aria-hidden="true" />
          <div>
            <h2 id="foundation-title">Installable Studio shell ready</h2>
            <p>
              The browser Studio now has an installable PWA app shell with same-origin offline fallback.
              Unified design system and IDE layout remain owned by later Builds.
            </p>
          </div>
        </section>

        {launch.kind === 'repository' ? (
          <section className="repository-card" aria-labelledby="repository-title">
            <p className="eyebrow">Repository handoff</p>
            <h2 id="repository-title">{launch.repository.fullName}</h2>
            <p>The public repository identity was validated locally from the Studio launch parameters.</p>
            <a href={launch.repository.githubUrl} target="_blank" rel="noreferrer">
              View repository on GitHub
            </a>
          </section>
        ) : null}

        {launch.kind === 'invalid' ? (
          <section className="warning-card" role="status" aria-labelledby="launch-warning-title">
            <p className="eyebrow">Launch context rejected</p>
            <h2 id="launch-warning-title">Repository handoff was not accepted</h2>
            <p>{launch.reason}</p>
          </section>
        ) : null}

        {launch.kind === 'empty' ? (
          <section className="empty-card" aria-labelledby="empty-title">
            <p className="eyebrow">Studio entry</p>
            <h2 id="empty-title">No repository selected</h2>
            <p>The Studio can start independently without claiming a GitHub or Local Runtime connection.</p>
          </section>
        ) : null}

        <section className="boundary-grid" aria-label="Build 28 boundaries">
          <article>
            <span>React</span>
            <strong>Active</strong>
          </article>
          <article>
            <span>PWA</span>
            <strong>Active</strong>
          </article>
          <article>
            <span>Offline shell</span>
            <strong>Active</strong>
          </article>
          <article>
            <span>Design System</span>
            <strong>Build 29</strong>
          </article>
          <article>
            <span>IDE Layout</span>
            <strong>Build 30</strong>
          </article>
          <article>
            <span>Local Runtime</span>
            <strong>Not connected</strong>
          </article>
        </section>
      </main>
    </div>
  );
}
