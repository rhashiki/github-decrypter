export const ACCOUNT_INTEGRATION_SCHEMA = 'ld-account-integration-readiness/1';

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];

function activeGithub(settings = {}, projectId = '') {
  const mapped = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapped || {}) };
}

function activeSupabase(settings = {}, projectId = '') {
  const mapped = projectId && settings?.supabaseMappings?.[projectId] ? settings.supabaseMappings[projectId] : {};
  return { ...(settings?.supabase || {}), ...(mapped || {}) };
}

function reason(code, provider, message) {
  return { code, provider, message };
}

export function evaluateAccountIntegrationReadiness({ projectId = '', settings = {}, githubStatus = null, supabaseStatus = null } = {}) {
  const github = activeGithub(settings, text(projectId));
  const supabase = activeSupabase(settings, text(projectId));
  const reasons = [];

  const accountReady = Boolean(text(settings?.auth?.licenseKey) && text(settings?.auth?.deviceId));
  if (!accountReady) reasons.push(reason('DECRYPTER_LOGIN_REQUIRED', 'decrypter', 'Faça login no Lovable Decrypter antes de conectar suas contas.'));

  const githubFullName = github.owner && github.repo ? `${text(github.owner)}/${text(github.repo)}` : '';
  const githubRepos = list(githubStatus?.repositories);
  const githubRepo = githubFullName ? githubRepos.find(item => text(item?.full_name).toLowerCase() === githubFullName.toLowerCase()) : null;
  const remoteInstallationId = Number(githubStatus?.installation?.id || 0) || null;
  const mappedInstallationId = Number(github?.installationId || 0) || null;
  const githubReady = Boolean(
    githubStatus?.app_configured === true &&
    githubStatus?.connected === true &&
    githubFullName &&
    githubRepo &&
    remoteInstallationId &&
    (!mappedInstallationId || mappedInstallationId === remoteInstallationId)
  );
  if (githubStatus?.app_configured !== true) reasons.push(reason('GITHUB_APP_REQUIRED', 'github', 'O GitHub App do Lovable Decrypter precisa ser configurado.'));
  else if (githubStatus?.connected !== true) reasons.push(reason('GITHUB_ACCOUNT_REQUIRED', 'github', 'Conecte sua conta GitHub ao Lovable Decrypter.'));
  else if (!githubFullName) reasons.push(reason('GITHUB_REPOSITORY_MAPPING_REQUIRED', 'github', 'Selecione o repositório GitHub deste projeto.'));
  else if (!githubRepo) reasons.push(reason('GITHUB_REPOSITORY_NOT_AUTHORIZED', 'github', 'O repositório selecionado não está autorizado para esta instalação do GitHub App.'));
  else if (mappedInstallationId && remoteInstallationId && mappedInstallationId !== remoteInstallationId) reasons.push(reason('GITHUB_INSTALLATION_CHANGED', 'github', 'A instalação GitHub mudou. Selecione novamente o repositório.'));

  const projectRef = text(supabase?.projectRef);
  const supabaseProjects = list(supabaseStatus?.projects);
  const supabaseProject = projectRef ? supabaseProjects.find(item => text(item?.ref || item?.id) === projectRef) : null;
  const missingScopes = list(supabaseStatus?.missing_scopes).filter(Boolean);
  const supabaseReady = Boolean(
    supabaseStatus?.app_configured === true &&
    supabaseStatus?.connected === true &&
    supabaseStatus?.reauthorize_required !== true &&
    missingScopes.length === 0 &&
    projectRef &&
    supabaseProject
  );
  if (supabaseStatus?.app_configured !== true) reasons.push(reason('SUPABASE_OAUTH_APP_REQUIRED', 'supabase', 'O OAuth App do Lovable Decrypter precisa ser configurado no Supabase.'));
  else if (supabaseStatus?.connected !== true) reasons.push(reason('SUPABASE_ACCOUNT_REQUIRED', 'supabase', 'Conecte sua conta Supabase ao Lovable Decrypter.'));
  else if (supabaseStatus?.reauthorize_required === true || missingScopes.length) reasons.push(reason('SUPABASE_REAUTHORIZE_REQUIRED', 'supabase', 'Reautorize o Supabase para conceder os escopos necessários.'));
  else if (!projectRef) reasons.push(reason('SUPABASE_PROJECT_MAPPING_REQUIRED', 'supabase', 'Selecione o projeto Supabase deste projeto Lovable.'));
  else if (!supabaseProject) reasons.push(reason('SUPABASE_PROJECT_NOT_AUTHORIZED', 'supabase', 'O projeto Supabase selecionado não está autorizado nesta conta.'));

  return {
    schema: ACCOUNT_INTEGRATION_SCHEMA,
    projectId: text(projectId),
    ready: accountReady && githubReady && supabaseReady,
    account: { ready: accountReady },
    github: {
      ready: githubReady,
      appConfigured: githubStatus?.app_configured === true,
      connected: githubStatus?.connected === true,
      accountLogin: text(githubStatus?.installation?.account_login),
      installationId: remoteInstallationId,
      repository: githubFullName,
      repositoryAuthorized: Boolean(githubRepo)
    },
    supabase: {
      ready: supabaseReady,
      appConfigured: supabaseStatus?.app_configured === true,
      connected: supabaseStatus?.connected === true,
      projectRef,
      projectName: text(supabaseProject?.name || supabase?.projectName),
      projectAuthorized: Boolean(supabaseProject),
      reauthorizeRequired: supabaseStatus?.reauthorize_required === true,
      missingScopes
    },
    reasons
  };
}

export function assertAccountIntegrationReadiness(input = {}) {
  const result = evaluateAccountIntegrationReadiness(input);
  if (!result.ready) {
    const error = new Error('ACCOUNT_INTEGRATIONS_REQUIRED');
    error.code = 'ACCOUNT_INTEGRATIONS_REQUIRED';
    error.readiness = result;
    throw error;
  }
  return result;
}
