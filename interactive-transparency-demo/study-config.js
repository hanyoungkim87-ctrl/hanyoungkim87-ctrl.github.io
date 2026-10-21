/* Researcher configuration. Load before study-session.js. No survey is configured by default. */
window.STUDY_CONFIG = Object.freeze({
  studyId: 'forma-source-transparency-2026-10',
  mode: 'disabled', // 'disabled', 'iframe', or 'redirect'
  parentOrigin: '', // iframe mode: exact HTTPS origin, e.g. https://YOUR-BRAND.qualtrics.com
  redirectURL: '', // redirect mode: exact, approved HTTPS survey URL; never read from query parameters
  allowedRedirectOrigins: [], // redirect mode: explicit exact origin allowlist
  ackTimeoutMs: 10000,
  includeEventsInIframe: false // Optional. Review export size and consent before enabling.
});
