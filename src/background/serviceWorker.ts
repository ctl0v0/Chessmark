chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" })?.catch(() => {
  // Private bookmark data should stay in extension pages and the service worker.
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" }).catch(() => {
    // Badge setup is best-effort and should never block installation.
  });
});
