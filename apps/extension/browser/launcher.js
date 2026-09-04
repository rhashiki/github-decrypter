(() => {
  'use strict';

  const BRIDGE_SCHEMA = 'gd-extension-bridge/1';
  const LAUNCHER_STATUS_TYPE = 'gd.extension.launcher-status';
  const ALLOWED_ORIGIN = 'https://github.com';
  const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
  const RESERVED_TOP_LEVEL = new Set([
    'about', 'apps', 'collections', 'contact', 'copilot', 'codespaces', 'enterprise',
    'events', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace',
    'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search',
    'security', 'settings', 'site', 'sponsors', 'signup', 'topics', 'trending', 'users',
  ]);

  const params = new URLSearchParams(location.search);
  const owner = (params.get('owner') ?? '').trim();
  const repo = (params.get('repo') ?? '').trim();
  const valid = REPOSITORY_PART.test(owner)
    && REPOSITORY_PART.test(repo)
    && !RESERVED_TOP_LEVEL.has(owner.toLowerCase());

  const invalid = document.getElementById('invalid');
  const content = document.getElementById('content');
  if (!valid) {
    invalid.hidden = false;
    return;
  }

  const fullName = `${owner}/${repo}`;
  const repositoryUrl = `${ALLOWED_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  document.getElementById('repository').textContent = fullName;
  const githubLink = document.getElementById('github-link');
  githubLink.href = repositoryUrl;
  content.hidden = false;

  const bridgeStatus = document.getElementById('bridge-status');
  try {
    chrome.runtime.sendMessage({ schema: BRIDGE_SCHEMA, type: LAUNCHER_STATUS_TYPE }, (response) => {
      if (chrome.runtime.lastError || !response || response.schema !== BRIDGE_SCHEMA || response.ok !== true) {
        bridgeStatus.textContent = 'Unavailable';
        bridgeStatus.className = 'pending';
        return;
      }
      bridgeStatus.textContent = `Connected · Build ${response.build}`;
      bridgeStatus.className = 'ok';
    });
  } catch {
    bridgeStatus.textContent = 'Unavailable';
    bridgeStatus.className = 'pending';
  }
})();
