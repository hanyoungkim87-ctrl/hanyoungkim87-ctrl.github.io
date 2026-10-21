/*
 * StudySession: local resume and explicit survey handoff; no backend or server-save claim.
 * initialize({version,condition}) -> {condition,restored,participantId,isPreview,storageAvailable}
 * save({state,events,startedAtEpoch,stepStartedAtEpoch}) -> {persisted,locked?,restored?,error?}
 * complete(payload) -> Promise<{status,handedOff,alreadyCompleted,serverSaveConfirmed:false,message}>
 * integrationStatus() -> configuration, local persistence, and completion status.
 * Load study-config.js first. See QUALTRICS_SETUP.md for the parent-message contract.
 */
(function (window) {
  'use strict';
  const REQUEST = "I'm looking for wireless earbuds with long battery life and good sound quality.";
  const CONDITION_CODES = { none: 'c1', static: 'c2', interactive: 'c3' };
  const VALID_CONDITIONS = Object.keys(CONDITION_CODES);
  const PROTOCOL = 'forma-study-v1';
  const FIELD_MAP = Object.freeze({
    participant_id: 'forma_participant_id',
    prolific_pid: 'forma_prolific_pid',
    response_id: 'forma_response_id',
    condition_code: 'forma_condition_code',
    stimulus_version: 'forma_stimulus_version',
    selected_product: 'forma_selected_product',
    initial_recommended_product: 'forma_initial_recommended_product',
    final_recommended_product: 'forma_final_recommended_product',
    applied_request_weight: 'forma_applied_request_weight',
    applied_external_weight: 'forma_applied_external_weight',
    slider_adjustment_count: 'forma_slider_adjustment_count',
    slider_input_count: 'forma_slider_input_count',
    update_click_count: 'forma_update_click_count',
    update_clicked: 'forma_update_clicked',
    recommendation_changed: 'forma_recommendation_changed',
    total_duration_ms: 'forma_total_duration_ms',
    recommendation_duration_ms: 'forma_recommendation_duration_ms',
    completion_id: 'forma_completion_id',
    completed: 'forma_completed'
  });
  let config;
  let participantId = null;
  let participantIdSource = null;
  let identifiers = { prolificPid: null, responseId: null, pid: null };
  let activeCondition = 'none';
  let version = '';
  let key = null;
  let session = null;
  let initialized = false;
  let storageAvailable = false;
  let storageError = null;
  let pending = null;
  let deliveredThisPage = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function normalize(value) { return String(value || '').toLowerCase().replace(/[’‘']/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function validOrigin(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.origin === value; }
    catch { return false; }
  }
  function configuredRoute() {
    if (config.mode === 'iframe' && validOrigin(config.parentOrigin)) return 'iframe';
    if (config.mode === 'redirect') {
      try {
        const url = new URL(config.redirectURL);
        if (url.protocol === 'https:' && !url.username && !url.password && Array.isArray(config.allowedRedirectOrigins) && config.allowedRedirectOrigins.includes(url.origin) && config.allowedRedirectOrigins.every(validOrigin)) return 'redirect';
      } catch { /* Invalid configuration stays disabled. */ }
    }
    return 'disabled';
  }
  function readStored() {
    if (!key || !storageAvailable) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.schema !== 1 || parsed.studyId !== config.studyId || parsed.participantId !== participantId || !VALID_CONDITIONS.includes(parsed.condition)) return null;
      return parsed;
    } catch (error) { storageError = error.message || 'Unable to read local storage.'; return null; }
  }
  function persist() {
    if (!key) return { persisted: false, preview: true };
    if (!storageAvailable) return { persisted: false, error: storageError || 'Local persistence is unavailable.' };
    try {
      window.localStorage.setItem(key, JSON.stringify(session));
      return { persisted: true };
    } catch (error) {
      storageAvailable = false;
      storageError = error.message || 'Local persistence is unavailable.';
      return { persisted: false, error: storageError };
    }
  }
  function sanitizeSnapshot(snapshot) {
    if (!snapshot || !snapshot.state || !Array.isArray(snapshot.events)) throw new Error('A state and events array are required.');
    const cleaned = clone(snapshot);
    if (JSON.stringify(cleaned).length > 1500000) throw new Error('Session exceeds the local persistence size limit.');
    cleaned.state.request = normalize(cleaned.state.request) === normalize(REQUEST) ? REQUEST : '';
    if (![1, 2, 3].includes(cleaned.state.step)) throw new Error('Invalid task step.');
    if (cleaned.state.step === 3 && !['A', 'B', 'C'].includes(cleaned.state.selected)) throw new Error('A completed task requires a valid product selection.');
    for (const name of ['startedAtEpoch', 'stepStartedAtEpoch']) {
      if (!Number.isFinite(cleaned[name]) || cleaned[name] < 0) throw new Error(`Invalid ${name}.`);
    }
    // Root logs only task events. Defensive sanitization prevents arbitrary request text in event exports.
    cleaned.events = cleaned.events.map(event => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
      const safe = { ...event, condition: activeCondition };
      if ('request' in safe) safe.request = normalize(safe.request) === normalize(REQUEST) ? REQUEST : '';
      return safe;
    }).filter(Boolean);
    return { state: cleaned.state, events: cleaned.events, startedAtEpoch: cleaned.startedAtEpoch, stepStartedAtEpoch: cleaned.stepStartedAtEpoch };
  }
  function initialize(options) {
    config = { studyId: 'forma-source-transparency-2026-10', mode: 'disabled', parentOrigin: '', redirectURL: '', allowedRedirectOrigins: [], ackTimeoutMs: 10000, includeEventsInIframe: false, ...(window.STUDY_CONFIG || {}) };
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(config.studyId)) throw new Error('Configure a valid studyId before starting.');
    version = String(options?.version || 'unknown').slice(0, 100);
    activeCondition = VALID_CONDITIONS.includes(options?.condition) ? options.condition : 'none';
    const params = new URLSearchParams(window.location.search);
    participantId = null;
    participantIdSource = null;
    const readId = name => /^[a-zA-Z0-9_-]{1,128}$/.test(params.get(name) || '') ? params.get(name) : null;
    identifiers = { prolificPid: readId('PROLIFIC_PID'), responseId: readId('ResponseID'), pid: readId('pid') };
    for (const name of ['PROLIFIC_PID', 'ResponseID', 'pid']) {
      const value = params.get(name);
      if (value && /^[a-zA-Z0-9_-]{1,128}$/.test(value)) { participantId = value; participantIdSource = name; break; }
    }
    key = participantId ? `forma-study:${config.studyId}:${encodeURIComponent(participantId)}` : null;
    storageAvailable = false;
    storageError = null;
    if (key) {
      try {
        const probe = `${key}:probe`;
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        storageAvailable = true;
      } catch (error) { storageError = error.message || 'Local persistence is unavailable.'; }
    }
    const stored = readStored();
    session = stored || { schema: 1, studyId: config.studyId, participantId, participantIdSource, identifiers, condition: activeCondition, version, snapshot: null, completion: null };
    activeCondition = session.condition;
    if (!session.identifiers) session.identifiers = identifiers;
    if (session.snapshot) {
      try { session.snapshot = sanitizeSnapshot(session.snapshot); }
      catch { session.snapshot = null; }
    }
    initialized = true;
    deliveredThisPage = false;
    persist();
    return { condition: activeCondition, restored: session.snapshot ? clone(session.snapshot) : null, participantId, isPreview: !participantId, storageAvailable, versionMismatch: !!stored && stored.version !== version };
  }
  function save(snapshot) {
    if (!initialized) throw new Error('Call initialize first.');
    let next;
    try { next = sanitizeSnapshot(snapshot); }
    catch (error) { return { persisted: false, error: error.message }; }
    const latest = readStored();
    if (latest) { session = latest; activeCondition = latest.condition; }
    const finalized = session.snapshot?.state?.step === 3;
    if (finalized && JSON.stringify(session.snapshot.state) !== JSON.stringify(next.state)) {
      return { persisted: storageAvailable && !!key, locked: true, restored: clone(session.snapshot) };
    }
    if (session.completion && !finalized) return { persisted: storageAvailable && !!key, locked: true, restored: session.snapshot ? clone(session.snapshot) : null };
    if (finalized) {
      next.state = clone(session.snapshot.state);
      next.startedAtEpoch = session.snapshot.startedAtEpoch;
      next.stepStartedAtEpoch = session.snapshot.stepStartedAtEpoch;
    }
    session.snapshot = next;
    return persist();
  }
  function statusResult(status, message, extras) {
    return { status, handedOff: ['accepted_by_parent', 'redirecting'].includes(status), alreadyCompleted: false, serverSaveConfirmed: false, message, ...(extras || {}) };
  }
  function completionId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `forma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  function buildPayload(input) {
    const state = session.snapshot?.state;
    if (!state || state.step !== 3 || !['A', 'B', 'C'].includes(state.selected)) throw new Error('Confirm a product selection before continuing to the survey.');
    const weight = Number(state.appliedRequestWeight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error('Invalid applied source weight.');
    const finalRecommendation = weight > 100 * 2 / 3 ? 'A' : weight < 100 / 3 ? 'C' : 'B';
    const data = {
      participant_id: participantId,
      prolific_pid: session.identifiers?.prolificPid || '',
      response_id: session.identifiers?.responseId || '',
      condition_code: CONDITION_CODES[activeCondition],
      stimulus_version: session.version || version,
      selected_product: state.selected,
      initial_recommended_product: 'B',
      final_recommended_product: finalRecommendation,
      applied_request_weight: weight,
      applied_external_weight: 100 - weight,
      slider_adjustment_count: input.slider_adjustment_count,
      slider_input_count: input.slider_input_count,
      update_click_count: input.update_click_count,
      update_clicked: input.update_clicked,
      recommendation_changed: input.recommendation_changed,
      total_duration_ms: input.total_duration_ms,
      recommendation_duration_ms: input.recommendation_duration_ms,
      completion_id: completionId(),
      completed: '1'
    };
    for (const name of ['slider_adjustment_count', 'slider_input_count', 'update_click_count', 'total_duration_ms', 'recommendation_duration_ms']) {
      data[name] = Number.isFinite(Number(data[name])) && Number(data[name]) >= 0 ? Math.round(Number(data[name])) : 0;
    }
    data.update_clicked = data.update_click_count > 0 ? '1' : '0';
    data.recommendation_changed = input.recommendation_changed === true || input.recommendation_changed === '1' ? '1' : '0';
    const fields = {};
    for (const [name, field] of Object.entries(FIELD_MAP)) fields[field] = String(data[name] ?? '');
    if (config.includeEventsInIframe === true && Array.isArray(session.snapshot.events)) fields.forma_events_json = JSON.stringify(session.snapshot.events);
    return { data, fields };
  }
  function rememberResult(result) {
    session.completion.result = result;
    persist();
    return clone(result);
  }
  async function complete(input = {}) {
    if (!initialized) throw new Error('Call initialize first.');
    if (pending) return pending;
    const latest = readStored();
    if (latest) { session = latest; activeCondition = latest.condition; }
    if (!participantId) return statusResult('preview', 'Preview only. No participant ID is present, and nothing has been submitted or confirmed saved by a survey server.');
    const route = configuredRoute();
    const previousStatus = session.completion?.result?.status;
    if (previousStatus === 'redirecting' || (previousStatus === 'unconfigured' && route === 'disabled') || (previousStatus === 'accepted_by_parent' && (route !== 'iframe' || deliveredThisPage))) {
      return { ...clone(session.completion.result), alreadyCompleted: true };
    }
    try {
      if (!session.completion) {
        const built = buildPayload(input);
        session.completion = { id: built.data.completion_id, payload: built, result: null };
        persist();
      }
    } catch (error) { return statusResult('error', `${error.message} Nothing has been confirmed saved by a survey server.`); }
    if (route === 'disabled') return rememberResult(statusResult('unconfigured', 'Your choice is retained in this browser when local storage is available. No survey destination is configured. Nothing has been submitted or confirmed saved by a survey server.'));
    if (route === 'redirect') {
      const url = new URL(config.redirectURL);
      for (const [name, value] of Object.entries(session.completion.payload.fields)) {
        if (name !== 'forma_events_json') url.searchParams.set(name, value);
      }
      const result = rememberResult(statusResult('redirecting', 'Opening the configured survey. URL fields are a handoff only; nothing has been confirmed saved by its server.'));
      try { window.location.assign(url.href); return result; }
      catch (error) { return rememberResult(statusResult('error', `The survey could not be opened. Nothing has been confirmed saved by its server. ${error.message || ''}`)); }
    }
    if (window.parent === window) return rememberResult(statusResult('error', 'This configuration requires opening the task inside the configured survey. Nothing has been submitted or confirmed saved by a survey server.'));
    pending = new Promise(resolve => {
      const token = session.completion.id;
      const timeoutMs = Math.min(30000, Math.max(100, Number(config.ackTimeoutMs) || 10000));
      let timer;
      const finish = result => {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        pending = null;
        resolve(rememberResult(result));
      };
      const onMessage = event => {
        const data = event.data;
        if (event.origin !== config.parentOrigin || event.source !== window.parent || !data || data.protocol !== PROTOCOL || data.type !== 'forma:accepted' || data.completionId !== token) return;
        deliveredThisPage = true;
        finish(statusResult('accepted_by_parent', 'The survey page received your choice. Continue in the survey to save your response. Server-side saving has not been independently confirmed.'));
      };
      window.addEventListener('message', onMessage);
      timer = window.setTimeout(() => finish(statusResult('error', 'The survey page did not confirm receiving your choice. Nothing has been confirmed saved by its server. Keep this page open and retry.')), timeoutMs);
      try {
        window.parent.postMessage({ protocol: PROTOCOL, type: 'forma:complete', studyId: config.studyId, completionId: token, participantId, fields: clone(session.completion.payload.fields) }, config.parentOrigin);
      } catch (error) {
        finish(statusResult('error', `The survey handoff failed. Nothing has been confirmed saved by its server. ${error.message || ''}`));
      }
    });
    return pending;
  }
  function integrationStatus() {
    return { initialized, mode: initialized ? configuredRoute() : 'disabled', configured: initialized && configuredRoute() !== 'disabled', participantId, participantIdSource, identifiers: { ...identifiers }, isPreview: !participantId, condition: activeCondition, storageAvailable, storageError, completion: session?.completion?.result ? clone(session.completion.result) : null, serverSaveConfirmed: false };
  }
  window.StudySession = Object.freeze({ initialize, save, complete, integrationStatus });
})(window);
