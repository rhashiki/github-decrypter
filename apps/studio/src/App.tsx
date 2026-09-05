import { Badge, Card, SectionHeading, Stack, Status } from '@github-decrypter/ui';
import { useMemo } from 'react';
import { parseStudioLaunchContext, STUDIO_BUILD, STUDIO_VERSION } from './studio-context.js';

export function StudioApp() {
  const launch = useMemo(() => parseStudioLaunchContext(window.location.search), []);

  return (
    <div className="studio-shell" data-build={STUDIO_BUILD} data-gd-theme="dark">
      <header className="studio-header">
        <SectionHeading eyebrow="GitHub Decrypter">
          <h1>Studio</h1>
        </SectionHeading>
        <Badge>Build {STUDIO_BUILD} · {STUDIO_VERSION}</Badge>
      </header>

      <main className="studio-main">
        <Card className="studio-card foundation-card" role="region" aria-labelledby="foundation-title">
          <Stack gap="lg">
            <Status tone="success" label="Design system active" />
            <div>
              <h2 id="foundation-title">Unified design foundation ready</h2>
              <p>
                The Studio now consumes the canonical GitHub Decrypter tokens and accessible UI primitives.
                IDE chrome and workspace layout remain owned by Build 30.
              </p>
            </div>
          </Stack>
        </Card>

        {launch.kind === 'repository' ? (
          <Card className="studio-card" role="region" aria-labelledby="repository-title">
            <SectionHeading eyebrow="Repository handoff">
              <h2 id="repository-title">{launch.repository.fullName}</h2>
            </SectionHeading>
            <p>The public repository identity was validated locally from the Studio launch parameters.</p>
            <a href={launch.repository.githubUrl} target="_blank" rel="noreferrer">
              View repository on GitHub
            </a>
          </Card>
        ) : null}

        {launch.kind === 'invalid' ? (
          <Card className="studio-card" tone="warning" role="status" aria-labelledby="launch-warning-title">
            <SectionHeading eyebrow="Launch context rejected">
              <h2 id="launch-warning-title">Repository handoff was not accepted</h2>
            </SectionHeading>
            <p>{launch.reason}</p>
          </Card>
        ) : null}

        {launch.kind === 'empty' ? (
          <Card className="studio-card" role="region" aria-labelledby="empty-title">
            <SectionHeading eyebrow="Studio entry">
              <h2 id="empty-title">No repository selected</h2>
            </SectionHeading>
            <p>The Studio can start independently without claiming a GitHub or Local Runtime connection.</p>
          </Card>
        ) : null}

        <section className="boundary-grid" aria-label="Build 29 boundaries">
          <Card className="boundary-item">
            <span>React</span>
            <strong>Active</strong>
          </Card>
          <Card className="boundary-item">
            <span>PWA</span>
            <strong>Active</strong>
          </Card>
          <Card className="boundary-item">
            <span>Design System</span>
            <strong>Active</strong>
          </Card>
          <Card className="boundary-item">
            <span>IDE Layout</span>
            <strong>Build 30</strong>
          </Card>
          <Card className="boundary-item">
            <span>Onboarding</span>
            <strong>Build 31</strong>
          </Card>
          <Card className="boundary-item">
            <span>Local Runtime</span>
            <strong>Not connected</strong>
          </Card>
        </section>
      </main>
    </div>
  );
}
