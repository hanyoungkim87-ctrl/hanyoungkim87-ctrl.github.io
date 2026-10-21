/*
 * QUALTRICS QUESTION-JAVASCRIPT TEMPLATE — do not load this file on the stimulus page.
 * Paste this entire file into a Qualtrics Text/Graphic question's JavaScript editor.
 * Defaults are deliberately disabled. Follow QUALTRICS_SETUP.md before enabling.
 */
(function () {
  'use strict';
  const CONFIG = {
    enabled: false,
    studyId: 'forma-source-transparency-2026-10',
    qualtricsOrigin: '', // Exact published survey origin, e.g. https://YOUR-BRAND.qualtrics.com
    stimulusURL: 'https://hanyoungkim87-ctrl.github.io/interactive-transparency-demo/',
    includeEvents: false
  };
  const FIELDS = [
    'forma_participant_id', 'forma_prolific_pid', 'forma_response_id', 'forma_condition_code', 'forma_stimulus_version',
    'forma_selected_product', 'forma_initial_recommended_product', 'forma_final_recommended_product',
    'forma_applied_request_weight', 'forma_applied_external_weight',
    'forma_slider_adjustment_count', 'forma_slider_input_count',
    'forma_update_click_count', 'forma_update_clicked', 'forma_recommendation_changed',
    'forma_total_duration_ms', 'forma_recommendation_duration_ms',
    'forma_completion_id', 'forma_completed'
  ];
  let removeListener = null;
  Qualtrics.SurveyEngine.addOnReady(function () {
    const question = this;
    const container = question.getQuestionContainer();
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'font-size:16px;line-height:1.6;margin:14px 0;';
    container.appendChild(status);
    question.disableNextButton();
    const stop = message => { status.textContent = message + ' Nothing has been confirmed saved by the survey server.'; };
    const responseId = '${e://Field/ResponseID}';
    const conditionCode = '${e://Field/forma_condition_code}';
    // Optional Prolific ID is read as data, never inserted into executable code.
    const rawProlificId = new URLSearchParams(window.location.search).get('PROLIFIC_PID') || '';
    const prolificId = /^[a-zA-Z0-9_-]{1,128}$/.test(rawProlificId) ? rawProlificId : '';
    const primaryParticipantId = prolificId || responseId;
    let stimulus;
    try { stimulus = new URL(CONFIG.stimulusURL); } catch { stop('The task URL is not configured correctly.'); return; }
    if (!CONFIG.enabled || !CONFIG.qualtricsOrigin || window.location.origin !== CONFIG.qualtricsOrigin || !CONFIG.qualtricsOrigin.startsWith('https://')) { stop('This task bridge has not been configured for this survey. Please contact the researcher.'); return; }
    if (stimulus.protocol !== 'https:' || stimulus.username || stimulus.password || !/^https:\/\/[^/]+$/.test(stimulus.origin)) { stop('The task requires an approved HTTPS stimulus URL.'); return; }
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(responseId) || !['c1', 'c2', 'c3'].includes(conditionCode)) { stop('The survey did not provide a valid response ID and assigned condition.'); return; }
    if (typeof Qualtrics.SurveyEngine.setJSEmbeddedData !== 'function') { stop('This survey layout does not provide the required embedded-data API. The researcher must verify the integration.'); return; }
    stimulus.search = new URLSearchParams({ c: conditionCode.slice(1), mode: 'participant', ResponseID: responseId, ...(prolificId ? { PROLIFIC_PID: prolificId } : {}) }).toString();
    const frame = document.createElement('iframe');
    frame.title = 'Earbud selection task';
    frame.src = stimulus.href;
    frame.style.cssText = 'display:block;width:100%;height:1000px;max-height:85vh;min-height:600px;border:1px solid #dfe6dc;border-radius:12px;';
    frame.setAttribute('allow', 'clipboard-write');
    container.appendChild(frame);
    status.textContent = 'Complete the task below, then continue with this survey.';
    let acceptedId = null;
    function receive(event) {
      const message = event.data;
      if (event.origin !== stimulus.origin || event.source !== frame.contentWindow || !message || message.protocol !== 'forma-study-v1' || message.type !== 'forma:complete' || message.studyId !== CONFIG.studyId || message.participantId !== primaryParticipantId) return;
      const fields = message.fields;
      if (!fields || fields.forma_participant_id !== primaryParticipantId || fields.forma_response_id !== responseId || fields.forma_condition_code !== conditionCode || fields.forma_completed !== '1' || fields.forma_completion_id !== message.completionId || !/^[a-zA-Z0-9_-]{1,100}$/.test(message.completionId)) return;
      if (acceptedId && acceptedId !== message.completionId) return;
      if (!['A', 'B', 'C'].includes(fields.forma_selected_product) || !['A', 'B', 'C'].includes(fields.forma_final_recommended_product)) return;
      if (JSON.stringify(fields).length > 1500000) { stop('The task data exceeded the supported handoff size.'); return; }
      try {
        if (!acceptedId) {
          for (const name of FIELDS) {
            if (typeof fields[name] !== 'string' || fields[name].length > 1000) throw new Error('Invalid task field.');
            Qualtrics.SurveyEngine.setJSEmbeddedData(name, fields[name]);
          }
          if (CONFIG.includeEvents && typeof fields.forma_events_json === 'string') Qualtrics.SurveyEngine.setJSEmbeddedData('forma_events_json', fields.forma_events_json);
          acceptedId = message.completionId;
        }
        event.source.postMessage({ protocol: 'forma-study-v1', type: 'forma:accepted', completionId: message.completionId }, stimulus.origin);
        question.enableNextButton();
        status.textContent = 'Your task response has reached this survey page. Select Next to continue and save the survey response. Receipt here does not independently confirm server-side saving.';
      } catch { stop('The survey page could not accept the task fields. Please keep this page open and contact the researcher.'); }
    }
    window.addEventListener('message', receive);
    removeListener = () => window.removeEventListener('message', receive);
  });
  Qualtrics.SurveyEngine.addOnUnload(function () {
    if (removeListener) removeListener();
    removeListener = null;
  });
})();
