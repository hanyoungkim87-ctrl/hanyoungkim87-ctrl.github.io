# Qualtrics handoff setup

The shipped configuration is **disabled**. No real Qualtrics origin or survey URL has been supplied. The task can retain a local participant session and finalize a choice, but it cannot currently send that choice to a survey or confirm a server save.

The recommended setup embeds the task inside a question in the **same Qualtrics response**. A redirect to a generic survey URL is a separate, optional handoff and does not prove that an earlier response will resume.

## 1. Load the session layer

The stimulus page must load these scripts in order, with matching cache versions:

```html
<script src="./study-config.js?v=YOUR_VERSION" defer></script>
<script src="./study-session.js?v=YOUR_VERSION" defer></script>
<script src="./app.js?v=YOUR_VERSION" defer></script>
```

`study-config.js` has these deliberate defaults:

```js
window.STUDY_CONFIG = Object.freeze({
  studyId: 'forma-source-transparency-2026-10',
  mode: 'disabled',
  parentOrigin: '',
  redirectURL: '',
  allowedRedirectOrigins: [],
  ackTimeoutMs: 10000,
  includeEventsInIframe: false
});
```

For the same-response iframe setup, set `mode: 'iframe'` and `parentOrigin` to the **exact HTTPS origin of the published survey**, for example `https://YOUR-BRAND.qualtrics.com`. An origin has no path or trailing slash. A custom survey domain must be configured as that exact domain. Do not use `*`. The site never accepts a return destination or allowed origin from participant query parameters.

Keep `studyId` stable for one study. Local sessions are keyed by this value and the participant ID. Use a new study ID for a new experiment or incompatible stimulus revision; changing the JavaScript version alone does not remove existing assignment/completion locks. An old session retains its original stimulus version, and `initialize()` reports `versionMismatch` when appropriate.

## 2. Assign conditions in Qualtrics

Before the task block in Survey Flow:

1. Add an Embedded Data element for `PROLIFIC_PID` if recruiting through Prolific. Populate it from the incoming survey URL as appropriate for your recruitment setup.
2. Add the assignment field `forma_condition_code`.
3. Use the survey's randomizer or your existing assignment procedure to set that field to exactly one of `c1`, `c2`, or `c3` before the task question.
4. Keep the task in the same survey response. Do not create a second response to continue after the task.

The survey assignment values are `c1`, `c2`, and `c3`. The bridge converts them to the app query parameters `c=1`, `c=2`, and `c=3`, which map to none, static, and interactive respectively. This module accepts the app's resolved condition and locks it to the local session. Query parameters and local storage do **not** provide secure assignment against intentional editing; enforce assignment in the survey or a trusted server if that is required.

The template passes the built-in Qualtrics `ResponseID` to the iframe. If a valid `PROLIFIC_PID` is present in the current survey page's URL, it also passes that ID. If your survey removes that query parameter during navigation, the template still joins through `ResponseID`; configure a validated data-reading path for your embedded Prolific field if you need both IDs in the stimulus export. Do not interpolate unchecked participant text into executable JavaScript.

Identity priority is `PROLIFIC_PID`, then `ResponseID`, then `pid`. All supplied valid Prolific and response IDs are retained separately as `forma_prolific_pid` and `forma_response_id`. A valid ID contains only letters, digits, underscores, and hyphens, with 1–128 characters. Without a valid ID, the app is a preview and never claims submission. The same participant should resume the same Qualtrics response: changing ResponseID for an already finalized Prolific session will not silently overwrite its frozen handoff.

## 3. Declare the output fields

The template uses `Qualtrics.SurveyEngine.setJSEmbeddedData(name, value)`. Declare these fields in an Embedded Data element **before the task block**, with the `__js_` prefix:

```text
__js_forma_participant_id
__js_forma_prolific_pid
__js_forma_response_id
__js_forma_condition_code
__js_forma_stimulus_version
__js_forma_selected_product
__js_forma_initial_recommended_product
__js_forma_final_recommended_product
__js_forma_applied_request_weight
__js_forma_applied_external_weight
__js_forma_slider_adjustment_count
__js_forma_slider_input_count
__js_forma_update_click_count
__js_forma_update_clicked
__js_forma_recommendation_changed
__js_forma_total_duration_ms
__js_forma_recommendation_duration_ms
__js_forma_completion_id
__js_forma_completed
```

Optional event export requires both `includeEventsInIframe: true` in the stimulus config and `includeEvents: true` in the bridge, plus `__js_forma_events_json` in Survey Flow. The default omits the event JSON. Pilot your account's practical embedded-field and response-size limits before enabling it.

The assignment input `forma_condition_code` is separate from the JavaScript output `__js_forma_condition_code`. Do not confuse the two. The bridge calls the setter **without** the `__js_` prefix, while the declared output field and exported column use that prefix.

## 4. Add the task question

1. Add a Text/Graphic question on its own page and put a short task introduction in its question text.
2. Open its JavaScript editor.
3. Paste the entire contents of `qualtrics-bridge.js` into that editor. Do not load this template on the external stimulus page.
4. Set `CONFIG.enabled` to `true` and `CONFIG.qualtricsOrigin` to the exact published survey origin used in `study-config.js`.
5. Verify `CONFIG.stimulusURL` and `CONFIG.studyId` match the published task and its configuration.
6. Publish the survey and test a real test response through its published link. Preview alone is not evidence of server persistence.

The script inserts the iframe and disables the survey Next button until a valid handoff is received. It verifies the stimulus origin, exact iframe window, study ID, participant ID, response ID, condition, completion ID, and product values. It sets the embedded fields, acknowledges receipt to the iframe, and enables Next. It removes its message listener when the question unloads.

The template is intentionally fail-closed: disabled configuration, wrong origin, missing assignment/response ID, or a missing `setJSEmbeddedData` method produce a visible configuration message and do not enable normal continuation. Your Qualtrics license must support question JavaScript. Account layouts and security settings can affect embedding and JavaScript; verify them in the actual account.

## 5. What “received” means

The stimulus sends `forma:complete` to the configured parent origin. The bridge returns `forma:accepted` only after the embedded-data setter calls succeed. This acknowledges **receipt by the current survey page**, not an independently verified server write.

The participant must then use the survey's Next button and complete the intended survey flow. Inspect the recorded response in Qualtrics Data & Analysis or an export to verify persistence. No result from `StudySession` sets `serverSaveConfirmed` to `true`.

One frozen completion ID and payload are retained per participant. Repeated clicks in the same page do not generate new completions. A timeout or refresh may replay the **same** completion ID so a refreshed Qualtrics page can recover fields that had not yet been saved. The bridge handles repeated receipt of the same ID idempotently; it rejects a different completion ID after one has been accepted on that page. This is not an exactly-once server-storage guarantee.

## 6. Local resume behavior

For a valid participant ID, state, task events, and timestamps are stored in localStorage on the stimulus origin. Refreshing restores the task and its original condition. Confirming the product freezes the finalized task state; subsequent changes from stale tabs cannot overwrite it. The handoff occurs only when the app calls `complete()` after finalization.

Only the canonical assigned request or an empty string is persisted as request text. Rejected request wording is not retained in the persisted request field or request event. No contact details are requested. IDs, choice, task events, and durations are study data and should be covered by your protocol.

Local storage may be blocked or partitioned inside third-party iframes or private-browsing modes. The module reports `storageAvailable: false` and an error rather than claiming refresh protection. An open page can still attempt the configured handoff, but refresh recovery is then unavailable. Local storage can also be cleared or edited and does not enforce identity across devices. Shared-browser and duplicate-participation controls belong in the study protocol or server layer.

There is no backend, database, authentication, recruitment API, or persistent response endpoint in this package. Stored data remain in that browser until cleared. Specify and implement an appropriate retention/deletion policy before a real study.

## 7. Optional configured redirect

For an explicitly approved external survey handoff, set:

```js
mode: 'redirect',
redirectURL: 'https://YOUR-BRAND.qualtrics.com/jfe/form/YOUR_SURVEY_ID',
allowedRedirectOrigins: ['https://YOUR-BRAND.qualtrics.com']
```

Only this configured HTTPS URL is used. Participant-supplied `returnURL` or similar query parameters are ignored. The same `forma_*` summary fields listed above are appended as query parameters, without `__js_` and without event JSON. Define matching unprefixed Embedded Data fields in the destination survey to read those URL values.

A redirected URL carries IDs and task summary values in the URL and browser history. It is not an API submission, it may create a new response, and it does not confirm saving or resume an existing response automatically. Use the iframe route when the study must stay in one Qualtrics response. No Prolific completion URL or completion code is configured here.

## Integration API for the app

```js
const session = StudySession.initialize({ version: VERSION, condition });
// Use session.condition (it may be locked to an earlier assignment).
// Restore session.restored if present; never overwrite a restored completed state.
const saved = StudySession.save({ state, events, startedAtEpoch, stepStartedAtEpoch });
// If saved.locked, honor saved.restored instead of changing the finalized choice.
const result = await StudySession.complete(payload);
// result.handedOff reports transfer/redirect; result.serverSaveConfirmed is always false.
```

`initialize()` returns `condition`, `restored`, `participantId`, `isPreview`, `storageAvailable`, and `versionMismatch`. The persisted snapshot uses epoch millisecond timestamps so elapsed durations can survive page reloads. The module preserves the original start times once the choice is finalized.

The completion payload accepts slider adjustment/input counts, update count, recommendation-change flag, and durations. The frozen selected product, applied weights, recommendation, condition code, version, and identifiers take precedence over conflicting caller values. A preview without an ID returns `preview`; a real ID with no destination returns `unconfigured`. Both clearly state that nothing is confirmed saved by a survey server.

## Verification checklist

Run `node tests/study-session.test.cjs` for the isolated session-layer tests. They cover identity priority and both ID fields, refresh/condition lock, request sanitization, finalized-choice/stale-tab lock, frozen completion, duplicate suppression, ACK origin/window/token checks, timeout, refresh replay, redirect allowlisting, and blocked storage. These tests use mocks; they do not test a live Qualtrics account.

Before recruitment, verify each condition using a published survey test response:

1. Correct assigned condition and response ID; no researcher controls in the iframe.
2. Refresh before and after product confirmation, with no changed assignment or final choice.
3. The Next button stays disabled before a valid handoff.
4. Continue to survey acknowledges receipt, then Next advances within the same response.
5. Qualtrics Data & Analysis/export contains the expected `__js_forma_*` values and the matching ResponseID.
6. Test one repeated click, one iframe refresh, one full survey-page refresh, and one blocked-storage browser.
7. Confirm an unconfigured destination and wrong message origin never display a server-save success.
8. Verify redirect mode separately if you plan to use it; do not treat it as interchangeable with same-response embedding.

## Documentation checked

Qualtrics' official [Add JavaScript support page](https://www.qualtrics.com/support/survey-platform/survey-module/question-options/add-javascript/) describes the question editor and `addOnReady` / `addOnUnload` lifecycle, license restrictions, and layout differences. Its linked [JavaScript API reference](https://api.qualtrics.com/82bd4d5c331f1-qualtrics-java-script-question-api-class) returned HTTP 404 during this implementation. The precise setter behavior therefore still requires verification in the target account; this template checks for the method and does not silently fall back to a different setter. No live Qualtrics save has been tested or claimed.
