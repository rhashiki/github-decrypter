import { Badge, Button, Card, SectionHeading, Stack, Status } from '@github-decrypter/ui';
import { useMemo, useState } from 'react';
import type { EnvironmentDoctorReport } from '@github-decrypter/protocol';
import { requestEnvironmentDoctorReport } from './environment-doctor-client.js';

export type EnvironmentDoctorOutcome = 'unchecked' | 'ready' | 'attention' | 'unavailable';

export interface EnvironmentDoctorProps {
  readonly onContinue: () => void;
  readonly onOutcome: (outcome: EnvironmentDoctorOutcome) => void;
}

export function EnvironmentDoctor({ onContinue, onOutcome }: EnvironmentDoctorProps) {
  const [report, setReport] = useState<EnvironmentDoctorReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const browser = useMemo(() => ({
    secureContext: window.isSecureContext,
    serviceWorker: 'serviceWorker' in navigator,
  }), []);

  async function runCheck(): Promise<void> {
    setChecking(true);
    setError(null);
    try {
      const next = await requestEnvironmentDoctorReport();
      setReport(next);
      onOutcome(next.summary.fail === 0 && next.summary.unknown === 0 ? 'ready' : 'attention');
    } catch (cause) {
      setReport(null);
      const message = cause instanceof Error ? cause.message : 'The Local Runtime could not be reached.';
      setError(message);
      onOutcome('unavailable');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="studio-doctor" aria-labelledby="environment-doctor-title">
      <Stack gap="lg">
        <Status tone="neutral" label="Build 32 · Environment Doctor" />
        <SectionHeading eyebrow="Local readiness check">
          <h1 id="environment-doctor-title">Check the environment before privileged work begins.</h1>
        </SectionHeading>
        <p className="studio-doctor-intro">
          This check is read-only. It contacts only the GitHub Decrypter Local Runtime on this device after you
          press the button. It does not install, repair, change files, grant permissions or contact external services.
        </p>

        <Card className="studio-doctor-browser" role="region" aria-labelledby="browser-preflight-title">
          <SectionHeading eyebrow="Browser preflight">
            <h2 id="browser-preflight-title">Studio shell</h2>
          </SectionHeading>
          <div className="studio-doctor-grid">
            <div><span>Secure context</span><Badge tone={browser.secureContext ? 'success' : 'warning'}>{browser.secureContext ? 'Ready' : 'Check browser'}</Badge></div>
            <div><span>Service worker support</span><Badge tone={browser.serviceWorker ? 'success' : 'warning'}>{browser.serviceWorker ? 'Ready' : 'Unavailable'}</Badge></div>
            <div><span>Local network access</span><Badge>Asked only when you run the check</Badge></div>
          </div>
        </Card>

        <div className="studio-doctor-actions">
          <Button onClick={() => void runCheck()} disabled={checking}>
            {checking ? 'Checking Local Runtime…' : 'Check Local Runtime'}
          </Button>
          <Button variant="ghost" onClick={onContinue}>Continue without checking</Button>
        </div>

        {error ? (
          <Card className="studio-doctor-result" tone="warning" role="status">
            <SectionHeading eyebrow="Local Runtime unavailable">
              <h2>The diagnostic endpoint could not be reached.</h2>
            </SectionHeading>
            <p>{error}</p>
            <p>Start the Local Runtime on this device, allow local-network access if your browser asks, then run the check again.</p>
          </Card>
        ) : null}

        {report ? (
          <Card className="studio-doctor-result" role="region" aria-labelledby="doctor-result-title">
            <div className="studio-doctor-result-heading">
              <SectionHeading eyebrow="Diagnostic result">
                <h2 id="doctor-result-title">{report.summary.ready ? 'Environment ready' : 'Environment needs attention'}</h2>
              </SectionHeading>
              <Badge tone={report.summary.fail === 0 ? 'success' : 'warning'}>
                {report.summary.pass} passed · {report.summary.warning} warnings · {report.summary.fail} failed
              </Badge>
            </div>
            <div className="studio-doctor-checks">
              {report.checks.map((item) => (
                <div className="studio-doctor-check" data-status={item.status} key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    {item.remediation ? <p className="studio-doctor-remediation">{item.remediation}</p> : null}
                  </div>
                  <Badge tone={item.status === 'pass' ? 'success' : item.status === 'fail' ? 'warning' : 'neutral'}>{item.status}</Badge>
                </div>
              ))}
            </div>
            <div className="studio-doctor-actions">
              <Button onClick={onContinue}>Continue to Studio</Button>
              <Button variant="ghost" onClick={() => void runCheck()} disabled={checking}>Run again</Button>
            </div>
          </Card>
        ) : null}
      </Stack>
    </section>
  );
}
