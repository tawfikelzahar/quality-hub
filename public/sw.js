// Quality Hub service worker
//
// Kept deliberately minimal: its only job is to make the site installable
// as a PWA (Chrome requires a registered service worker for the install
// prompt / TWA to work). It does NOT cache pages or API responses, so
// account/subscription state and tool updates always come straight from
// the network — never a stale cached copy.

const VERSION = "v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only passthrough. No caching of HTML/API/data — every request
// goes to the network so the app always reflects the latest deployment,
// pricing, and login state.
self.addEventListener("fetch", () => {
  // Intentionally no-op: let the request go to the network normally.
});
