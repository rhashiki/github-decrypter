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
import { EnvironmentDoctor, type EnvironmentDoctorOutcome } from './EnvironmentDoctor.js';
import { JobsCenter } from './JobsCenter.js';
import { OnboardingFlow } from './OnboardingFlow.js';
import { ViktorToggle } from './ViktorToggle.js';
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

const FUTURE_MODES = Object.freeze([
  { label: 'Code', detail: 'Build 73' },
  { label: 'Preview', detail: 'Build 68' },
  { label: 'Workflow', detail: 'Planned' },
]);

type WorkspaceSurface = 'overview' | 'jobs';

function runtimeStatusLabel(outcome: EnvironmentDoctorOutcome): string {
  if (outcome === 'ready') return 'Diagnostic ready';
  if (outcome === 'attention') return 'Needs attention';
  if (outcome === 'unavailable') return 'Unavailable';
  return 'Not checked';
}

export function StudioApp() {
  const launch = useMemo(() => parseStudioLaunchContext(window.location.search), []);
  const [profile, setProfile] = useState<AdaptiveUserProfile | null>(null);
  const [environmentDoctorComplete, setEnvironmentDoctorComplete] = useState(false);
  const [environmentDoctorOutcome, setEnvironmentDoctorOutcome] = useState<EnvironmentDoctorOutcome>('unchecked');
  const [workspaceSurface, setWorkspaceSurface] = useState<WorkspaceSurface>('overview');
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
  const workspaceReady = profile !== null && environmentDoctorComplete;
  const activeSurface = !profile
    ? 'Onboarding'
    : !environmentDoctorComplete
      ? 'Environment Doctor'
      : workspaceSurface === 'jobs'
        ? 'Jobs Center'
        : 'Overview';

  function retakeOnboarding(): void {
    setProfile(null);
    setEnvironmentDoctorComplete(false);
    setEnvironmentDoctorOutcome('unchecked');
    setWorkspaceSurface('overview');
  }

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
          <span className="studio-brand-mark" aria-hidden="true">V</span>
          <div>
            <strong>Vortex Ars</strong>
            <span>{workspaceLabel}</span>
          </div>
        </div>

        <nav className="studio-mode-switcher" aria-label="Studio modes">
          <button className="studio-mode is-active" type="button" aria-current="page">Agent</button>
          {FUTURE_MODES.map((mode) => (
            <button
              className="studio-mode"
              type="button"
              disabled
              title={mode.detail}
              key={mode.label}
            >
              {mode.label}
            </button>
          ))}
        </nav>

        <div className="studio-layout-actions" aria-label="Layout controls">
          <Badge className="studio-build-badge">Build {STUDIO_BUILD} · {STUDIO_VERSION}</Badge>
          <Button
            className="studio-layout-button"
            variant="ghost"
            aria-expanded={!sidebarCollapsed}
            aria-controls="studio-sidebar"
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            Viktor
          </Button>
          <Button
            className="studio-layout-button"
            variant="ghost"
            aria-expanded={!panelCollapsed}
            aria-controls="studio-panel"
            onClick={() => setPanelCollapsed((value) => !value)}
          >
            Preview
          </Button>
          <Button variant="secondary" disabled title="Sharing is not active in the current Build">Share</Button>
          <Button variant="primary" disabled title="Deployment Hub arrives later in the V1 roadmap">Publish</Button>
        </div>
      </WorkbenchTopBar>

      <WorkbenchActivityBar className="studio-activity" aria-label="Workbench navigation">
        <button
          className={`studio-activity-item${workspaceReady && workspaceSurface === 'overview' ? ' is-active' : ''}`}
          type="button"
          aria-current={workspaceReady && workspaceSurface === 'overview' ? 'page' : undefined}
          title="Workspace"
          onClick={() => workspaceReady && setWorkspaceSurface('overview')}
        >
          <span aria-hidden="true">⌂</span>
          <span className="studio-visually-hidden">Workspace</span>
        </button>
        <button
          className={`studio-activity-item${workspaceReady && workspaceSurface === 'jobs' ? ' is-active' : ''}`}
          type="button"
          disabled={!workspaceReady}
          aria-current={workspaceReady && workspaceSurface === 'jobs' ? 'page' : undefined}
          title={workspaceReady ? 'Jobs Center' : 'Jobs Center becomes available after setup'}
          onClick={() => setWorkspaceSurface('jobs')}
        >
          <span aria-hidden="true">J</span>
          <span className="studio-visually-hidden">Jobs Center</span>
        </button>
        <span className="studio-activity-divider" />
        <button className="studio-activity-item" type="button" disabled title="Code Explorer · Build 73">
          <span aria-hidden="true">&lt;/&gt;</span>
          <span className="studio-visually-hidden">Code Explorer</span>
        </button>
        <button className="studio-activity-item" type="button" disabled title="Live Preview · Build 68">
          <span aria-hidden="true">◫</span>
          <span className="studio-visually-hidden">Live Preview</span>
        </button>
        <button className="studio-activity-item" type="button" disabled title="Backend providers · Builds 80–86">
          <span aria-hidden="true">▦</span>
          <span className="studio-visually-hidden">Data</span>
        </button>
        <button className="studio-activity-item studio-activity-bottom" type="button" disabled title="Deployment Hub · Build 98">
          <span aria-hidden="true">↗</span>
          <span className="studio-visually-hidden">Deploy</span>
        </button>
      </WorkbenchActivityBar>

      <WorkbenchSidebar id="studio-sidebar" className="studio-sidebar" aria-label="Viktor interaction panel">
        <div className="studio-viktor-heading">
          <div className="studio-viktor-identity">
            <span className="studio-viktor-orb" aria-hidden="true" />
            <div>
              <strong>Viktor</strong>
              <span>Vortex Ars Interaction Layer</span>
            </div>
          </div>
          <ViktorToggle />
        </div>

        <div className="studio-viktor-thread">
          <div className="studio-message studio-message-assistant">
            <span className="studio-message-label">Viktor</span>
            <p>
              This Studio shell now follows the Vortex Ars visual direction. Existing Build capabilities stay
              authoritative; future surfaces remain visibly locked until their owning Builds arrive.
            </p>
          </div>

          <div className="studio-activity-card">
            <div className="studio-activity-card-heading">
              <strong>Current activity</strong>
              <Badge tone={workspaceReady ? 'success' : 'neutral'}>{activeSurface}</Badge>
            </div>
            <div className="studio-activity-progress">
              <span className={profile ? 'is-complete' : 'is-current'} />
              <div>
                <strong>Adaptive profile</strong>
                <small>{profile ? 'Ready for this session' : 'Waiting for onboarding'}</small>
              </div>
            </div>
            <div className="studio-activity-progress">
              <span className={environmentDoctorComplete ? 'is-complete' : profile ? 'is-current' : ''} />
              <div>
                <strong>Environment Doctor</strong>
                <small>{runtimeStatusLabel(environmentDoctorOutcome)}</small>
              </div>
            </div>
            <div className="studio-activity-progress">
              <span className={workspaceReady ? 'is-complete' : ''} />
              <div>
                <strong>Workspace</strong>
                <small>{workspaceReady ? 'Available' : 'Setup required'}</small>
              </div>
            </div>
          </div>

          <div className="studio-sidebar-section">
            <span className="studio-section-label">Context</span>
            <div className="studio-sidebar-row">
              <span>Project</span>
              <span>{workspaceLabel}</span>
            </div>
            <div className="studio-sidebar-row">
              <span>Local Runtime</span>
              <span>{runtimeStatusLabel(environmentDoctorOutcome)}</span>
            </div>
            <div className="studio-sidebar-row">
              <span>Profile</span>
              <span>{profile ? 'Session active' : 'Not initialized'}</span>
            </div>
          </div>

          <div className="studio-sidebar-section studio-upcoming">
            <span className="studio-section-label">Upcoming surfaces</span>
            {RESERVED_SURFACES.map((surface) => (
              <div className="studio-sidebar-row is-reserved" key={surface.build}>
                <span>{surface.label}</span>
                <span>Build {surface.build}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="studio-viktor-composer">
          <textarea
            disabled
            aria-label="Viktor conversation input"
            placeholder="Conversation UI will bind here without bypassing current authority boundaries."
          />
          <div>
            <span>Conversation Engine exists; this visual composer is not connected yet.</span>
            <button type="button" disabled aria-label="Send message">↑</button>
          </div>
        </div>
      </WorkbenchSidebar>

      <WorkbenchEditor className="studio-editor" aria-label="Editor workspace">
        <WorkbenchTabBar className="studio-tabs" label="Editor tabs">
          <button className="studio-tab is-active" type="button" role="tab" aria-selected="true">
            {activeSurface}
          </button>
          <span className="studio-tab-context">{workspaceLabel}</span>
        </WorkbenchTabBar>

        <div className="studio-editor-content">
          {!profile ? (
            <OnboardingFlow onComplete={setProfile} />
          ) : !environmentDoctorComplete ? (
            <EnvironmentDoctor
              onOutcome={setEnvironmentDoctorOutcome}
              onContinue={() => setEnvironmentDoctorComplete(true)}
            />
          ) : workspaceSurface === 'jobs' ? (
            <JobsCenter />
          ) : (
            <>
              <section className="studio-overview" aria-labelledby="studio-overview-title">
                <Stack gap="lg">
                  <Status tone="success" label="Adaptive User Profile active for this session" />
                  <SectionHeading eyebrow="Vortex Ars · adaptive experience">
                    <h1 id="studio-overview-title">{experience?.headline}</h1>
                  </SectionHeading>
                  <p>
                    Viktor presents the project at your preferred level while Vortex keeps engineering authority,
                    validation and security boundaries independent from presentation.
                  </p>
                  <div className="studio-profile-summary" aria-label="Adaptive profile summary">
                    <div><span>Explanation style</span><strong>{experience?.explanationStyle}</strong></div>
                    <div><span>Learning preference</span><strong>{experience?.learningStyle}</strong></div>
                    <div><span>Primary objective</span><strong>{profile.objective}</strong></div>
                  </div>
                  <div>
                    <Button variant="ghost" onClick={retakeOnboarding}>Retake onboarding</Button>
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
                  <p>The Studio can start independently without claiming a GitHub or Local Runtime connection.</p>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </WorkbenchEditor>

      <WorkbenchPanel id="studio-panel" className="studio-panel" aria-label="Preview panel">
        <div className="studio-preview-toolbar">
          <div>
            <strong>Preview</strong>
            <span>Vortex Browser Runtime</span>
          </div>
          <Badge>Build 68</Badge>
        </div>

        <div className="studio-preview-devicebar" aria-label="Future preview viewport controls">
          <button type="button" className="is-active" disabled>Desktop</button>
          <button type="button" disabled>Tablet</button>
          <button type="button" disabled>Mobile</button>
        </div>

        <div className="studio-preview-stage">
          <div className="studio-browser-frame">
            <div className="studio-browser-chrome">
              <span aria-hidden="true">● ● ●</span>
              <div>{launch.kind === 'repository' ? launch.repository.fullName : 'vortex.local'}</div>
            </div>
            <div className="studio-preview-empty">
              <span className="studio-preview-mark" aria-hidden="true">V</span>
              <span className="studio-preview-kicker">Preview shell ready</span>
              <h2>Live application preview joins here.</h2>
              <p>
                The visual surface is in place now. Browser execution, runtime evidence and real application
                rendering remain owned by Build 68 and later validation Builds.
              </p>
              <div className="studio-preview-proof">
                <span>Current UI</span><strong>Real</strong>
                <span>Live app rendering</span><strong>Not active yet</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="studio-panel-heading">
          <strong>Reserved engineering surfaces</strong>
          <span>Structural only</span>
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
        <span className="studio-status-brand">Vortex Ars</span>
        <span>Build {STUDIO_BUILD}</span>
        <span>Offline-capable shell</span>
        <span>Profile: {profile ? 'session only' : 'not initialized'}</span>
        <span className="studio-statusbar-spacer" />
        <span>Local Runtime: {runtimeStatusLabel(environmentDoctorOutcome)}</span>
      </WorkbenchStatusBar>
    </Workbench>
  );
}
