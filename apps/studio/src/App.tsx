import {
  Badge,
  Button,
  Card,
  SectionHeading,
  Stack,
  Status,
  Workbench,
  WorkbenchActivityBar,
  WorkbenchEditor,
  WorkbenchPanel,
  WorkbenchSidebar,
  WorkbenchStatusBar,
  WorkbenchTabBar,
  WorkbenchTopBar,
} from '@github-decrypter/ui';
import { useMemo, useState } from 'react';
import { OnboardingFlow } from './OnboardingFlow.js';
import {
  describeAdaptiveExperience,
  type AdaptiveUserProfile,
} from './onboarding-profile.js';
import { parseStudioLaunchContext, STUDIO_BUILD, STUDIO_VERSION } from './studio-context.js';

const RESERVED_SURFACES = Object.freeze([
  { label: 'Developer Console', build: 71 },
  { label: 'Problems & Diagnostics', build: 72 },
  { label: 'Code Explorer', build: 73 },
  { label: 'Terminal', build: 75 },
  { label: 'Git Panel', build: 76 },
]);

export function StudioApp() {
  const launch = useMemo(() => parseStudioLaunchContext(window.location.search), []);
  const [profile, setProfile] = useState<AdaptiveUserProfile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.matchMedia?.('(max-width: 760px)').matches ?? false,
  );
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const workspaceLabel = launch.kind === 'repository'
    ? launch.repository.fullName
    : launch.kind === 'invalid'
      ? 'Launch rejected'
      : 'No repository selected';
  const experience = profile ? describeAdaptiveExperience(profile) : null;
  const activeSurface = profile ? 'Overview' : 'Onboarding';

  return (
    <Workbench
      className="studio-workbench"
      sidebarCollapsed={sidebarCollapsed}
      panelCollapsed={panelCollapsed}
      data-build={STUDIO_BUILD}
      data-gd-theme="dark"
    >
      <WorkbenchTopBar className="studio-topbar">
        <div className="studio-brand">
          <span className="studio-brand-mark" aria-hidden="true">GD</span>
          <div>
            <strong>GitHub Decrypter</strong>
            <span>{workspaceLabel}</span>
          </div>
        </div>
        <div className="studio-layout-actions" aria-label="Layout controls">
          <Badge>Build {STUDIO_BUILD} · {STUDIO_VERSION}</Badge>
          <Button
            className="studio-layout-button"
            variant="ghost"
            aria-expanded={!sidebarCollapsed}
            aria-controls="studio-sidebar"
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            Sidebar
          </Button>
          <Button
            className="studio-layout-button"
            variant="ghost"
            aria-expanded={!panelCollapsed}
            aria-controls="studio-panel"
            onClick={() => setPanelCollapsed((value) => !value)}
          >
            Panel
          </Button>
        </div>
      </WorkbenchTopBar>

      <WorkbenchActivityBar className="studio-activity" aria-label="Workbench navigation">
        <button className="studio-activity-item is-active" type="button" aria-current="page" title="Workspace">
          <span aria-hidden="true">W</span>
          <span className="studio-visually-hidden">Workspace</span>
        </button>
        <button className="studio-activity-item" type="button" disabled title="Additional surfaces arrive in later Builds">
          <span aria-hidden="true">+</span>
          <span className="studio-visually-hidden">Additional surfaces are not active yet</span>
        </button>
      </WorkbenchActivityBar>

      <WorkbenchSidebar id="studio-sidebar" className="studio-sidebar" aria-label="Workspace sidebar">
        <div className="studio-sidebar-heading">
          <SectionHeading eyebrow="Workspace">
            <h2>{workspaceLabel}</h2>
          </SectionHeading>
          <Badge tone={launch.kind === 'repository' ? 'accent' : 'neutral'}>
            {launch.kind === 'repository' ? 'Public launch context' : 'Local shell'}
          </Badge>
        </div>

        <div className="studio-sidebar-section">
          <span className="studio-section-label">Current surface</span>
          <div className="studio-sidebar-row is-selected">
            <span>{activeSurface}</span>
            <span>31</span>
          </div>
        </div>

        <div className="studio-sidebar-section">
          <span className="studio-section-label">Adaptive profile</span>
          <div className="studio-sidebar-row">
            <span>{profile ? 'Session profile active' : 'Not initialized'}</span>
            <span>{profile ? '✓' : '—'}</span>
          </div>
        </div>

        <div className="studio-sidebar-section">
          <span className="studio-section-label">Reserved by roadmap</span>
          {RESERVED_SURFACES.filter((surface) => surface.build >= 73).map((surface) => (
            <div className="studio-sidebar-row is-reserved" key={surface.build}>
              <span>{surface.label}</span>
              <span>Build {surface.build}</span>
            </div>
          ))}
        </div>
      </WorkbenchSidebar>

      <WorkbenchEditor className="studio-editor" aria-label="Editor workspace">
        <WorkbenchTabBar className="studio-tabs" label="Editor tabs">
          <button className="studio-tab is-active" type="button" role="tab" aria-selected="true">
            {activeSurface}
          </button>
        </WorkbenchTabBar>

        <div className="studio-editor-content">
          {!profile ? (
            <OnboardingFlow onComplete={setProfile} />
          ) : (
            <>
              <section className="studio-overview" aria-labelledby="studio-overview-title">
                <Stack gap="lg">
                  <Status tone="success" label="Adaptive User Profile active for this session" />
                  <SectionHeading eyebrow="Build 31 · experience context">
                    <h1 id="studio-overview-title">{experience?.headline}</h1>
                  </SectionHeading>
                  <p>
                    Onboarding now shapes how the Studio presents information. It does not grant capabilities,
                    permissions or execution authority, and this profile is not persisted by the browser.
                  </p>
                  <div className="studio-profile-summary" aria-label="Adaptive profile summary">
                    <div><span>Explanation style</span><strong>{experience?.explanationStyle}</strong></div>
                    <div><span>Learning preference</span><strong>{experience?.learningStyle}</strong></div>
                    <div><span>Primary objective</span><strong>{profile.objective}</strong></div>
                  </div>
                  <div>
                    <Button variant="ghost" onClick={() => setProfile(null)}>Retake onboarding</Button>
                  </div>
                </Stack>
              </section>

              {launch.kind === 'repository' ? (
                <Card className="studio-context-card" role="region" aria-labelledby="repository-title">
                  <SectionHeading eyebrow="Repository handoff">
                    <h2 id="repository-title">{launch.repository.fullName}</h2>
                  </SectionHeading>
                  <p>The public repository identity was validated locally from the Studio launch parameters.</p>
                  <a href={launch.repository.githubUrl} target="_blank" rel="noreferrer">View repository on GitHub</a>
                </Card>
              ) : null}

              {launch.kind === 'invalid' ? (
                <Card className="studio-context-card" tone="warning" role="status" aria-labelledby="launch-warning-title">
                  <SectionHeading eyebrow="Launch context rejected">
                    <h2 id="launch-warning-title">Repository handoff was not accepted</h2>
                  </SectionHeading>
                  <p>{launch.reason}</p>
                </Card>
              ) : null}

              {launch.kind === 'empty' ? (
                <Card className="studio-context-card" role="region" aria-labelledby="empty-title">
                  <SectionHeading eyebrow="Studio entry">
                    <h2 id="empty-title">No repository selected</h2>
                  </SectionHeading>
                  <p>The workbench can start independently without claiming a GitHub or Local Runtime connection.</p>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </WorkbenchEditor>

      <WorkbenchPanel id="studio-panel" className="studio-panel" aria-label="Bottom panel">
        <div className="studio-panel-heading">
          <strong>Panel</strong>
          <span>Structural surface only</span>
        </div>
        <div className="studio-reserved-grid">
          {RESERVED_SURFACES.filter((surface) => surface.build < 73 || surface.build === 75).map((surface) => (
            <div className="studio-reserved-surface" key={surface.build}>
              <span>{surface.label}</span>
              <Badge>Build {surface.build}</Badge>
            </div>
          ))}
        </div>
      </WorkbenchPanel>

      <WorkbenchStatusBar className="studio-statusbar">
        <span>Build {STUDIO_BUILD}</span>
        <span>Offline-capable shell</span>
        <span>Profile: {profile ? 'session only' : 'not initialized'}</span>
        <span className="studio-statusbar-spacer" />
        <span>Local Runtime: Not connected</span>
      </WorkbenchStatusBar>
    </Workbench>
  );
}
