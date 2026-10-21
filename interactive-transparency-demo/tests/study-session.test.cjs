'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'study-session.js'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname, '..', 'study-config.js'), 'utf8');
const REQUEST = "I'm looking for wireless earbuds with long battery life and good sound quality.";
let sequence = 0;
function createEnvironment({ query = '', storage = new Map(), config = {}, framed = false, deniedStorage = false } = {}) {
  const listeners = new Set();
  const sent = [];
  const redirected = [];
  const parent = { postMessage(message, origin) { sent.push({ message, origin }); } };
  const window = {
    location: { search: query, assign(url) { redirected.push(url); } },
    localStorage: {
      getItem(key) { if (deniedStorage) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (deniedStorage) throw new Error('Storage blocked'); storage.set(key, String(value)); },
      removeItem(key) { if (deniedStorage) throw new Error('Storage blocked'); storage.delete(key); }
    },
    crypto: { randomUUID: () => `completion-${++sequence}` },
    addEventListener(type, fn) { if (type === 'message') listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn); },
    setTimeout, clearTimeout
  };
  window.parent = framed ? parent : window;
  const context = vm.createContext({ window, URL, URLSearchParams, JSON, Date, Math, Object, Array, String, Number, Error, Promise });
  vm.runInContext(configSource, context);
  window.STUDY_CONFIG = { ...window.STUDY_CONFIG, ...config };
  vm.runInContext(source, context);
  function emit({ origin, message, sourceWindow = parent }) {
    for (const fn of [...listeners]) fn({ origin, source: sourceWindow, data: message });
  }
  function ack(origin = config.parentOrigin, sourceWindow = parent, id = sent.at(-1)?.message.completionId) {
    emit({ origin, sourceWindow, message: { protocol: 'forma-study-v1', type: 'forma:accepted', completionId: id } });
  }
  return { api: window.StudySession, storage, sent, redirected, ack, emit, parent, window };
}
function snapshot({ step = 2, selected = null, request = REQUEST, weight = 50 } = {}) {
  return { state: { step, request, selected, appliedRequestWeight: weight, draftRequestWeight: weight, appliedNotice: '' }, events: [{ type: 'request_submitted', request }], startedAtEpoch: 1000, stepStartedAtEpoch: 2000 };
}
function init(environment, condition = 'interactive') { return environment.api.initialize({ version: 'test-v1', condition }); }
function finalize(environment, selected = 'C', weight = 75) { assert.equal(environment.api.save(snapshot({ step: 3, selected, weight })).persisted, true); }
(async () => {
  const preview = createEnvironment();
  assert.equal(init(preview).isPreview, true);
  assert.equal(preview.api.save(snapshot()).persisted, false);
  assert.equal((await preview.api.complete({})).status, 'preview');
  assert.equal(preview.sent.length, 0);

  const original = createEnvironment({ query: '?PROLIFIC_PID=test_pid&ResponseID=ignored' });
  assert.equal(init(original).participantId, 'test_pid');
  assert.equal(original.api.integrationStatus().participantIdSource, 'PROLIFIC_PID');
  original.api.save(snapshot({ request: "  I’M looking for wireless earbuds with LONG battery life and good sound quality! " }));
  const resumed = createEnvironment({ query: '?PROLIFIC_PID=test_pid', storage: original.storage });
  const resumedInit = init(resumed, 'none');
  assert.equal(resumedInit.condition, 'interactive');
  assert.equal(resumedInit.restored.state.step, 2);
  assert.equal(resumedInit.restored.state.request, REQUEST);
  resumed.api.save(snapshot({ request: 'private unexpected text' }));
  const clean = createEnvironment({ query: '?pid=test_pid', storage: original.storage });
  const cleanInit = init(clean);
  assert.equal(cleanInit.restored.state.request, '');
  assert.equal(cleanInit.restored.events[0].request, '');

  finalize(resumed);
  const staleAttempt = original.api.save(snapshot({ step: 1 }));
  assert.equal(staleAttempt.locked, true);
  assert.equal(staleAttempt.restored.state.selected, 'C');
  assert.equal(resumed.api.save(snapshot({ step: 3, selected: 'A', weight: 25 })).locked, true);
  const noDestination = await resumed.api.complete({ selected_product: 'A', applied_request_weight: 25, update_click_count: 2, slider_adjustment_count: 3, total_duration_ms: 12345 });
  assert.equal(noDestination.status, 'unconfigured');
  assert.equal(noDestination.serverSaveConfirmed, false);
  const twice = await resumed.api.complete({});
  assert.equal(twice.alreadyCompleted, true);
  const persisted = JSON.parse([...resumed.storage.values()][0]);
  assert.equal(persisted.completion.payload.fields.forma_selected_product, 'C');
  assert.equal(persisted.completion.payload.fields.forma_prolific_pid, 'test_pid');
  assert.equal(persisted.completion.payload.fields.forma_response_id, 'ignored');
  assert.equal(persisted.completion.payload.fields.forma_applied_request_weight, '75');
  assert.equal(persisted.completion.payload.fields.forma_final_recommended_product, 'A');
  assert.equal(persisted.completion.payload.fields.forma_update_clicked, '1');

  const iframeConfig = { mode: 'iframe', parentOrigin: 'https://survey.example.org', ackTimeoutMs: 100 };
  const iframe = createEnvironment({ query: '?ResponseID=R_test', config: iframeConfig, framed: true });
  init(iframe); finalize(iframe);
  const awaiting = iframe.api.complete({ update_click_count: 1 });
  assert.equal(iframe.sent.length, 1);
  iframe.ack('https://attacker.example.org');
  iframe.ack(iframeConfig.parentOrigin, {});
  iframe.ack(iframeConfig.parentOrigin, iframe.parent, 'wrong-id');
  assert.equal(iframe.api.integrationStatus().completion, null);
  iframe.ack();
  const accepted = await awaiting;
  assert.equal(accepted.status, 'accepted_by_parent');
  assert.equal(accepted.handedOff, true);
  assert.equal(accepted.serverSaveConfirmed, false);
  assert.equal((await iframe.api.complete({})).alreadyCompleted, true);
  assert.equal(iframe.sent.length, 1);
  const completionId = iframe.sent[0].message.completionId;
  const reloadedFrame = createEnvironment({ query: '?ResponseID=R_test', storage: iframe.storage, config: iframeConfig, framed: true });
  assert.equal(init(reloadedFrame).restored.state.step, 3);
  const replay = reloadedFrame.api.complete({});
  assert.equal(reloadedFrame.sent[0].message.completionId, completionId);
  reloadedFrame.ack();
  assert.equal((await replay).status, 'accepted_by_parent');

  const blockedAck = createEnvironment({ query: '?pid=blocked', config: iframeConfig, framed: true });
  init(blockedAck); finalize(blockedAck);
  const timeout = blockedAck.api.complete({});
  blockedAck.ack('https://not-allowed.example.org');
  assert.equal((await timeout).status, 'error');

  const redirect = createEnvironment({ query: '?pid=redirect&returnURL=https://attacker.example.org', config: { mode: 'redirect', redirectURL: 'https://survey.example.org/jfe/form/SV_TEST', allowedRedirectOrigins: ['https://survey.example.org'] } });
  init(redirect); finalize(redirect, 'A', 25);
  assert.equal((await redirect.api.complete({})).status, 'redirecting');
  const destination = new URL(redirect.redirected[0]);
  assert.equal(destination.origin, 'https://survey.example.org');
  assert.equal(destination.searchParams.get('forma_selected_product'), 'A');
  assert.equal(destination.searchParams.get('forma_final_recommended_product'), 'C');
  assert.equal(destination.searchParams.has('forma_events_json'), false);
  await redirect.api.complete({});
  assert.equal(redirect.redirected.length, 1);

  const forbidden = createEnvironment({ query: '?pid=forbidden', config: { mode: 'redirect', redirectURL: 'https://attacker.example.org', allowedRedirectOrigins: ['https://survey.example.org'] } });
  init(forbidden); finalize(forbidden);
  assert.equal((await forbidden.api.complete({})).status, 'unconfigured');
  assert.equal(forbidden.redirected.length, 0);
  const storageDenied = createEnvironment({ query: '?pid=nostorage', deniedStorage: true });
  assert.equal(init(storageDenied).storageAvailable, false);
  assert.equal(storageDenied.api.save(snapshot()).persisted, false);
  assert.match(storageDenied.api.integrationStatus().storageError, /blocked/);
  // Execute the actual Qualtrics template with lightweight DOM/engine mocks.
  const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'qualtrics-bridge.js'), 'utf8');
  for (const assigned of ['c1', 'c2', 'c3']) {
    let ready;
    let messageHandler;
    let enabled = false;
    const nodes = [];
    const written = {};
    const replies = [];
    const bridgeWindow = { location: { origin: 'https://survey.example.org', search: '' }, addEventListener(type, fn) { if (type === 'message') messageHandler = fn; }, removeEventListener() {} };
    const engine = { addOnReady(fn) { ready = fn; }, addOnUnload() {}, setJSEmbeddedData(name, value) { written[name] = value; } };
    const document = { createElement(tag) { return { tag, style: {}, setAttribute() {}, contentWindow: { postMessage(message, origin) { replies.push({message,origin}); } } }; } };
    const code = bridgeSource.replace('enabled: false', 'enabled: true').replace("qualtricsOrigin: ''", "qualtricsOrigin: 'https://survey.example.org'").replace('${e://Field/ResponseID}', 'R_test').replace('${e://Field/forma_condition_code}', assigned);
    vm.runInNewContext(code, { Qualtrics: { SurveyEngine: engine }, window: bridgeWindow, document, URL, URLSearchParams });
    ready.call({ getQuestionContainer() { return { appendChild(node) { nodes.push(node); } }; }, disableNextButton() { enabled = false; }, enableNextButton() { enabled = true; } });
    const frame = nodes.find(node => node.tag === 'iframe');
    assert.ok(frame, 'Configured bridge creates an iframe');
    const frameURL = new URL(frame.src);
    assert.equal(frameURL.searchParams.get('c'), assigned.slice(1));
    assert.equal(frameURL.searchParams.has('condition'), false);
    assert.equal(frameURL.searchParams.get('ResponseID'), 'R_test');
    assert.equal(enabled, false);
    if (assigned === 'c3') {
      const handoff = reloadedFrame.sent[0].message;
      messageHandler({ origin: 'https://attacker.example.org', source: frame.contentWindow, data: handoff });
      assert.equal(enabled, false);
      messageHandler({ origin: frameURL.origin, source: frame.contentWindow, data: handoff });
      assert.equal(enabled, true);
      assert.equal(written.forma_selected_product, 'C');
      assert.equal(written.forma_response_id, 'R_test');
      assert.equal(replies[0].message.type, 'forma:accepted');
    }
  }
  console.log('PASS: session persistence/identity/locks, handoff origin/source/token and replay, redirect allowlisting, blocked storage, plus actual Qualtrics template c=1/2/3 URLs and validated ACK.');
})().catch(error => { console.error(error); process.exitCode = 1; });
