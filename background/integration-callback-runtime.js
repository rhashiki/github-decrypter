const CALLBACK_MESSAGE = 'LD2_INTEGRATION_CALLBACK_COMPLETE';

function trustedCallbackSender(sender) {
  try {
    const url = new URL(String(sender?.url || ''));
    return url.protocol === 'https:' && (url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev'));
  } catch (_) { return false; }
}

export function installIntegrationCallbackRuntime() {
  if (globalThis.__LD2_INTEGRATION_CALLBACK_RUNTIME__) return;
  globalThis.__LD2_INTEGRATION_CALLBACK_RUNTIME__ = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== CALLBACK_MESSAGE) return false;
    const provider = String(message?.provider || '').toLowerCase();
    const status = String(message?.status || '').toLowerCase();
    const tabId = Number(sender?.tab?.id);
    if (!['github','supabase'].includes(provider) || !['connected','error'].includes(status) || !Number.isInteger(tabId) || !trustedCallbackSender(sender)) {
      sendResponse?.({ ok:false, code:'CALLBACK_SENDER_REJECTED' });
      return false;
    }
    chrome.tabs.remove(tabId).then(
      () => sendResponse?.({ ok:true }),
      () => sendResponse?.({ ok:false, code:'CALLBACK_TAB_CLOSE_FAILED' })
    );
    return true;
  });
}
