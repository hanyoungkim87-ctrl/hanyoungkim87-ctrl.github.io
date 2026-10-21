(() => {
  'use strict';
  const VERSION = '2026-10-21-study-v4';
  const REQUEST = "I'm looking for wireless earbuds with long battery life and good sound quality.";
  const validConditions = ['none', 'static', 'interactive'];
  const params = new URLSearchParams(location.search);
  const conditionCodes = { '1': 'none', '2': 'static', '3': 'interactive' };
  let condition = conditionCodes[params.get('c')] || (validConditions.includes(params.get('condition')) ? params.get('condition') : 'none');
  const participantMode = params.get('mode') === 'participant';
  const session = participantMode ? window.StudySession.initialize({ version: VERSION, condition }) : null;
  if (session) condition = session.condition;
  // Fictional, fixed task. Battery is scored at 1 point/hour, capped at 10.
  // Both source scores derive from the visible product attributes.
  const products = [
    { id: 'A', batteryHours: 10, sound: 8, comfort: 5, calls: 7 },
    { id: 'B', batteryHours: 8, sound: 9, comfort: 10, calls: 7 },
    { id: 'C', batteryHours: 6, sound: 10, comfort: 9, calls: 10 }
  ].map(product => {
    const batteryScore = Math.min(10, product.batteryHours);
    return { ...product, requestFit: (batteryScore + product.sound) / 2,
      externalEvaluation: (batteryScore + product.sound + product.comfort + product.calls) / 4 };
  });
  const descriptions = {
    none: 'Condition 01 · The shared request is followed by product recommendations. No explanation of the recommendation sources is shown.',
    static: 'Condition 02 · The recommendation explains request match and overall product evaluation. Their weights stay at 50:50.',
    interactive: 'Condition 03 · The same explanation appears with an optional source-weight slider. Recommendations change only when the new weights are applied.'
  };
  let state;
  let events = [];
  let startedAt = 0;
  let stepStartedAt = 0;
  const screen = document.getElementById('screen');
  const announcement = document.getElementById('announcement');
  let announceTimer;

  function persist() {
    if (!participantMode || !state) return;
    const saved = window.StudySession.save({ state: { ...state, request: normalizedRequest(state.request) === normalizedRequest(REQUEST) ? REQUEST : '' }, events, startedAtEpoch: startedAt, stepStartedAtEpoch: stepStartedAt });
    if (saved.locked && saved.restored) {
      state = saved.restored.state;
      events = saved.restored.events;
      startedAt = saved.restored.startedAtEpoch;
      stepStartedAt = saved.restored.stepStartedAtEpoch;
      render();
      return false;
    }
    if (saved.error) {
      const notice = document.getElementById('session-notice');
      notice.hidden = false;
      notice.textContent = 'Progress cannot be retained on this device. Keep this page open until you continue to the survey.';
    }
  }

  function announce(message) {
    clearTimeout(announceTimer);
    announcement.textContent = '';
    announceTimer = setTimeout(() => { announcement.textContent = message; }, 30);
  }
  function record(type, details = {}) {
    events.push({ type, condition, step: state.step, elapsed_ms: Math.max(0, Date.now() - startedAt), ...details });
    const count = document.getElementById('event-count');
    if (count) count.textContent = `${events.length} events in this preview`;
    return persist();
  }
  function resetState(reason = 'initial_load') {
    state = { step: 1, request: '', appliedRequestWeight: 50, draftRequestWeight: 50, selected: null, appliedNotice: '' };
    events = [];
    startedAt = Date.now();
    stepStartedAt = startedAt;
    record('session_started', { reason, source_weights: { request: 50, overall_product_evaluation: 50 } });
  }
  function normalizedRequest(value) {
    return value.toLowerCase().replace(/[’‘']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function score(product) {
    return (product.requestFit * state.appliedRequestWeight + product.externalEvaluation * (100 - state.appliedRequestWeight)) / 100;
  }
  function recommendedProduct() {
    return [...products].sort((a, b) => score(b) - score(a))[0];
  }
  function participantURL(targetCondition) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ c: String(validConditions.indexOf(targetCondition) + 1), mode: 'participant' }).toString();
    url.hash = '';
    return url.href;
  }
  function updateChrome() {
    document.body.classList.toggle('participant-mode', participantMode);
    document.getElementById('research-shell').hidden = participantMode;
    document.getElementById('design-notes').hidden = participantMode;
    document.getElementById('reset-button').hidden = participantMode;
    const sessionNotice = document.getElementById('session-notice');
    sessionNotice.hidden = !participantMode || (!session.isPreview && window.StudySession.integrationStatus().configured);
    sessionNotice.textContent = session?.isPreview ? 'Participant preview · responses are not submitted.' : 'Survey connection is not configured. This page is for testing only.';
    document.querySelectorAll('[data-condition]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.condition === condition));
    });
    document.getElementById('condition-description').textContent = descriptions[condition];
    document.getElementById('participant-link').href = participantURL(condition);
    document.querySelectorAll('[data-participant-condition]').forEach(link => {
      link.href = participantURL(link.dataset.participantCondition);
    });
    const home = new URL(location.href);
    home.search = new URLSearchParams({ condition, ...(participantMode ? { mode: 'participant' } : {}) }).toString();
    home.hash = '';
    document.getElementById('brand-link').href = home.href;
    if (participantMode) {
      const brand = document.getElementById('brand-link');
      brand.removeAttribute('href');
      brand.removeAttribute('aria-label');
      const codedURL = new URL(location.href);
      codedURL.searchParams.delete('condition');
      codedURL.searchParams.set('c', String(validConditions.indexOf(condition) + 1));
      history.replaceState({}, '', codedURL);
    }
  }
  function render(focus = false) {
    document.querySelectorAll('[data-step]').forEach(item => {
      const step = Number(item.dataset.step);
      item.classList.toggle('active', step === state.step);
      item.classList.toggle('done', step < state.step);
      if (step === state.step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    screen.innerHTML = state.step === 1 ? preferenceScreen() : state.step === 2 ? recommendationScreen() : completionScreen();
    bindScreen();
    if (focus) {
      const title = screen.querySelector('h2');
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
      document.getElementById('main').scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }
  function preferenceScreen() {
    return `<div class="preference-layout"><section><span class="eyebrow">YOUR STARTING POINT</span><h2 class="screen-title">Start with<br>a shopping request.</h2><p class="screen-copy">Imagine choosing wireless earbuds from this fictional store.</p><div class="task-card"><span class="task-label">YOUR ASSIGNED GOAL</span><p>For this task, look for wireless earbuds with <strong>long battery life</strong> and <strong>good sound quality</strong>.</p><p class="task-small">Copy the supplied request and paste it into the request field. Use this assigned goal rather than your own shopping preferences.</p></div></section><form class="preference-form" id="preference-form" novalidate><div class="request-source"><div class="request-source-heading"><label class="form-label" for="assigned-request">Request to use</label><button type="button" class="copy-request-button" id="copy-request">Copy request <span aria-hidden="true">⧉</span></button></div><textarea id="assigned-request" class="assigned-request" rows="3" readonly aria-describedby="copy-status"></textarea><p class="copy-status" id="copy-status" role="status">Copy this sentence, then paste it into the field below.</p></div><label class="form-label request-label" for="request-input">What are you looking for?</label><textarea id="request-input" class="request-input" rows="4" maxlength="400" placeholder="Paste the supplied request here." autocomplete="off" spellcheck="false" aria-describedby="request-hint preference-error"></textarea><p id="request-hint" class="request-hint">Please use the supplied sentence for this task.</p><p class="form-error" id="preference-error" role="alert"></p><button class="primary-button full" type="submit">Get recommendations <span aria-hidden="true">→</span></button><p class="form-hint">All products and product information in this task are fictional.</p></form></div>`;
  }
  function earbudArt(suffix) {
    return `<svg class="earbud-svg" viewBox="0 0 160 150" role="img" aria-label="Wireless earbuds"><defs><linearGradient id="bud-${suffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#eef1e9"/><stop offset="1" stop-color="#cdd6c7"/></linearGradient><linearGradient id="stem-${suffix}" x1="0" x2="1"><stop stop-color="#f9fbf5"/><stop offset=".6" stop-color="#e2e8dc"/><stop offset="1" stop-color="#bfcbb8"/></linearGradient></defs><ellipse cx="80" cy="134" rx="45" ry="5" fill="#dfe5d8" opacity=".55"/><g transform="translate(18 18) rotate(-20 35 55)"><rect x="35" y="42" width="18" height="64" rx="9" fill="url(#stem-${suffix})" stroke="#b9c5b2" stroke-width=".7"/><path d="M47 12c17 0 25 11 21 26-3 12-13 18-26 18-17 0-27-9-27-22S29 12 47 12Z" fill="url(#bud-${suffix})" stroke="#bdc8b6" stroke-width=".7"/><ellipse cx="20" cy="33" rx="9" ry="12" fill="#b8c4b0" transform="rotate(-17 20 33)"/><ellipse cx="19" cy="33" rx="5" ry="8" fill="#597055" transform="rotate(-17 19 33)"/><ellipse cx="19" cy="33" rx="3" ry="5" fill="#354d32"/><path d="M43 20c10-2 15 4 17 9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="42" y="91" width="4" height="8" rx="2" fill="#8a9d81"/></g><g transform="translate(78 7) rotate(22 30 65)"><rect x="24" y="48" width="18" height="66" rx="9" fill="url(#stem-${suffix})" stroke="#b9c5b2" stroke-width=".7"/><path d="M32 20c-17 0-25 11-21 26 3 12 13 18 26 18 17 0 27-9 27-22S50 20 32 20Z" fill="url(#bud-${suffix})" stroke="#bdc8b6" stroke-width=".7"/><ellipse cx="61" cy="41" rx="8" ry="12" fill="#c0ccba" transform="rotate(17 61 41)"/><ellipse cx="63" cy="41" rx="4" ry="8" fill="#597055" transform="rotate(17 63 41)"/><ellipse cx="64" cy="41" rx="2" ry="5" fill="#354d32"/><path d="M31 27c-9 0-14 4-15 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="31" y="100" width="4" height="7" rx="2" fill="#8a9d81"/></g></svg>`;
  }
  function explanationPanel() {
    if (condition === 'none') return '';
    const weight = state.appliedRequestWeight;
    const pending = state.draftRequestWeight !== weight;
    // Identical shared explanation, applied display, and result in both explanation conditions.
    return `<section class="explanation-panel" aria-labelledby="explanation-heading">
      <div class="source-description">
        <div class="explanation-label">HOW WE RECOMMEND</div>
        <h3 class="source-heading" id="explanation-heading">Two inputs. One recommendation.</h3>
        <p class="source-intro">We combine a match score for your request with an overall product score.</p>
        <div class="source-definitions">
          <div><h4><span class="source-marker" aria-hidden="true">1</span> Your request</h4><p>The average of <strong>battery-life and sound-quality scores</strong>—the two features in your request.</p></div>
          <div><h4><span class="source-marker" aria-hidden="true">2</span> Overall product evaluation</h4><p>The average of all four scores: <strong>battery life, sound quality, comfort, and call quality</strong>.</p></div>
        </div>
        <p class="source-rule">A source with a higher weight has more influence on which product is recommended.</p>
      </div>
      <div class="source-settings">
        <h4 class="weights-title">Weights currently applied</h4>
        <div class="source-weight-labels"><span>Your request <strong id="applied-request-weight">${weight}%</strong></span><span>Overall product evaluation <strong id="applied-external-weight">${100 - weight}%</strong></span></div>
        <div class="source-weight-bar" role="img" aria-label="Applied weights: your request ${weight} percent; overall product evaluation ${100 - weight} percent"><span style="width:${weight}%"></span><span style="width:${100 - weight}%"></span></div>
        ${condition === 'interactive' ? `<div class="source-controls">
          <h4 class="controls-title">Adjust the balance</h4>
          <p class="control-instruction">Move the slider, then select <strong>Update recommendations</strong>. You may also keep the current weights.</p>
          <div class="range-heading"><label for="source-weight">Weight given to your request</label><output id="draft-weight" for="source-weight">${state.draftRequestWeight}%</output></div>
          <input type="range" id="source-weight" min="0" max="100" step="5" value="${state.draftRequestWeight}" style="--range-fill:${state.draftRequestWeight}%" aria-valuetext="Your request ${state.draftRequestWeight} percent; overall product evaluation ${100 - state.draftRequestWeight} percent" aria-describedby="range-help draft-status">
          <div class="range-endpoints" aria-hidden="true"><span>More overall<br>product evaluation</span><span>More match<br>to your request</span></div>
          <div class="source-apply-row"><p id="range-help">Overall product evaluation: <strong id="draft-external-weight">${100 - state.draftRequestWeight}%</strong></p>
          <p class="draft-status ${pending ? 'is-pending' : ''}" id="draft-status" role="status">${pending ? 'Not applied yet. Update to use these weights.' : 'The displayed weights are currently applied.'}</p>
          <button type="button" class="primary-button apply-button" id="apply-button" ${pending ? '' : 'disabled'}>Update recommendations <span aria-hidden="true">↗</span></button></div>
        </div>` : `<p class="fixed-weight-note">These weights are fixed for this recommendation.</p>`}
        <div class="panel-result" id="panel-result" role="status" aria-live="polite" aria-atomic="true"><span>Current recommendation</span><strong>Product ${recommendedProduct().id}</strong><p>${state.appliedNotice || 'Based on the currently applied weights.'}</p></div>
      </div>
    </section>`;
  }
  function productCard(product) {
    const recommended = recommendedProduct().id === product.id;
    return `<label class="product-card ${recommended ? 'recommended' : ''} ${state.selected === product.id ? 'selected' : ''}" data-product="${product.id}"><input type="radio" name="product" value="${product.id}" aria-label="Select Product ${product.id}${recommended ? ', currently recommended' : ''}" ${state.selected === product.id ? 'checked' : ''}><div class="product-topline"><span class="product-number">WIRELESS / ${product.id}</span>${recommended ? '<span class="recommend-badge">Recommended</span>' : '<span></span>'}</div><div class="product-art">${earbudArt(product.id)}</div><div class="product-heading"><h4>Product ${product.id}</h4><span class="selection-circle" aria-hidden="true">✓</span></div><p class="product-subtitle">True wireless earbuds</p><div class="product-price">$79<small>.00</small></div><dl class="product-facts"><div><dt>Battery life</dt><dd>Up to ${product.batteryHours} hours</dd></div><div><dt>Sound quality</dt><dd>${product.sound} / 10</dd></div><div><dt>Comfort</dt><dd>${product.comfort} / 10</dd></div><div><dt>Call quality</dt><dd>${product.calls} / 10</dd></div></dl><div class="product-bottom"><span>IPX4 rated</span><span>Charging case included</span></div></label>`;
  }
  function actionCopy() {
    if (condition === 'interactive' && state.draftRequestWeight !== state.appliedRequestWeight) return 'Unapplied changes will not affect the current recommendation. You can update it or continue with your choice.';
    return 'You can choose any product, whether recommended or not.';
  }
  function canFinish() {
    return state.selected !== null;
  }
  function recommendationScreen() {
    return `<section><div class="recommendation-heading"><div><span class="eyebrow">FIND YOUR FIT</span><h2 class="screen-title">Explore your options.</h2><p class="screen-copy">Compare the products and choose the one you would buy for this task.</p></div><span class="category-pill">Wireless earbuds · 3 products</span></div><div class="recommendation-status" id="recommendation-status" role="status"><span class="recommendation-status-label">Current recommendation</span><strong>Product ${recommendedProduct().id}</strong><span class="recommendation-update">${state.appliedNotice}</span></div>${explanationPanel()}<div class="products-caption"><h3>Available products</h3><p>All products cost $79. Scores are fictional and out of 10. Battery score: 1 point per hour, up to 10.</p></div><fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">Choose a product</legend><div class="products-grid">${products.map(productCard).join('')}</div></fieldset><div class="recommendation-actions"><div class="selection-summary"><span id="selection-summary">${state.selected ? `Product ${state.selected} selected.` : 'Which product would you choose?'}</span><div class="action-hint" id="action-hint">${actionCopy()}</div></div><button class="primary-button" id="finish-button" type="button" ${canFinish() ? '' : 'disabled'}>Confirm selection <span aria-hidden="true">→</span></button></div></section>`;
  }
  function completionScreen() {
    const product = products.find(item => item.id === state.selected);
    const integration = participantMode ? window.StudySession.integrationStatus() : null;
    const canContinue = participantMode && !session.isPreview && integration.configured;
    const help = !participantMode ? '' : session.isPreview ? 'This is a preview. No response has been submitted to a survey.' : !integration.configured ? 'Your choice is complete on this device. The survey connection has not been configured; no response has been submitted.' : 'Select Continue to survey to pass your task results to the survey.';
    return `<section class="completion-layout"><div class="completion-icon" aria-hidden="true">✓</div><span class="eyebrow">YOUR CHOICE</span><h2 class="screen-title">Your choice is complete.</h2><p class="screen-copy">You selected Product ${product.id} from the three options.</p><div class="completion-card"><div class="product-art">${earbudArt('chosen')}</div><div><span class="eyebrow">SELECTED PRODUCT</span><h3>Product ${product.id}</h3><p>True wireless earbuds · $79.00</p><p>Battery life: up to ${product.batteryHours} hours</p></div></div><div class="completion-details"><span>Final recommendation <strong>Product ${recommendedProduct().id}</strong></span></div>${participantMode ? `<button class="primary-button survey-button" type="button" id="continue-survey" ${canContinue ? '' : 'disabled'}>Continue to survey <span aria-hidden="true">→</span></button><p class="handoff-status" id="handoff-status" role="status">${help}</p>` : '<button class="secondary-button" type="button" id="restart-button">Try again from the start <span aria-hidden="true">↻</span></button>'}</section>`;
  }
  function completionPayload() {
    const completion = events.find(item => item.type === 'selection_completed') || {};
    const updates = events.filter(item => item.type === 'source_weights_applied');
    return {
      stimulus_version: VERSION,
      selected_product: state.selected,
      initial_recommended_product: 'B',
      final_recommended_product: recommendedProduct().id,
      applied_request_weight: state.appliedRequestWeight,
      applied_external_weight: 100 - state.appliedRequestWeight,
      draft_request_weight: state.draftRequestWeight,
      slider_adjustment_count: events.filter(item => item.type === 'slider_adjustment').length,
      slider_input_count: events.filter(item => item.type === 'source_weights_drafted').length,
      update_click_count: updates.length,
      update_clicked: updates.length > 0,
      recommendation_changed: updates.some(item => item.previous_recommendation !== item.recommended_product),
      total_duration_ms: completion.total_duration_ms || 0,
      recommendation_duration_ms: completion.recommendation_duration_ms || 0,
      events
    };
  }
  function updateActions() {
    document.getElementById('selection-summary').textContent = state.selected ? `Product ${state.selected} selected.` : 'Which product would you choose?';
    document.getElementById('action-hint').textContent = actionCopy();
    document.getElementById('finish-button').disabled = !canFinish();
  }
  function bindScreen() {
    const form = document.getElementById('preference-form');
    if (form) {
      const supplied = document.getElementById('assigned-request');
      const input = document.getElementById('request-input');
      const error = document.getElementById('preference-error');
      supplied.value = REQUEST;
      input.value = state.request;
      document.getElementById('copy-request').addEventListener('click', async () => {
        const status = document.getElementById('copy-status');
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(REQUEST);
          if (!status.isConnected) return;
          status.textContent = 'Request copied. Paste it into the field below.';
          input.focus();
          record('request_copied');
        } catch {
          if (!status.isConnected) return;
          supplied.focus();
          supplied.select();
          status.textContent = 'Copy the selected sentence with Ctrl+C or Command+C, then paste it below. On a phone, use the selection menu.';
          record('manual_copy_prompt');
        }
      });
      input.addEventListener('input', () => {
        state.request = input.value;
        error.textContent = '';
        input.removeAttribute('aria-invalid');
        persist();
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        state.request = input.value;
        if (normalizedRequest(state.request) !== normalizedRequest(REQUEST)) {
          error.textContent = state.request.trim() ? 'Please paste the supplied request without changing its wording. Capitalization and punctuation do not need to match.' : 'Please copy the supplied request and paste it into the field.';
          input.setAttribute('aria-invalid', 'true');
          input.focus();
          record('request_validation_failed');
          return;
        }
        state.request = REQUEST;
        record('request_submitted', { request: REQUEST, duration_ms: Math.round(Date.now() - stepStartedAt) });
        state.step = 2;
        stepStartedAt = Date.now();
        record('recommendation_displayed', { recommended_product: recommendedProduct().id, request_weight: state.appliedRequestWeight });
        render(true);
        announce('Recommendations are ready. Product B is currently recommended.');
      });
    }
    screen.querySelectorAll('input[name="product"]').forEach(input => input.addEventListener('change', () => {
      state.selected = input.value;
      screen.querySelectorAll('.product-card').forEach(card => card.classList.toggle('selected', card.dataset.product === state.selected));
      updateActions();
      record('product_selected', { product: state.selected, recommended_product: recommendedProduct().id });
      announce(`Product ${state.selected} selected.`);
    }));
    const range = document.getElementById('source-weight');
    range?.addEventListener('input', () => {
      state.draftRequestWeight = Number(range.value);
      const external = 100 - state.draftRequestWeight;
      document.getElementById('draft-weight').textContent = `${state.draftRequestWeight}%`;
      document.getElementById('draft-external-weight').textContent = `${external}%`;
      range.style.setProperty('--range-fill', `${state.draftRequestWeight}%`);
      document.getElementById('draft-status').textContent = state.draftRequestWeight === state.appliedRequestWeight ? 'The displayed weights are currently applied.' : 'Not applied yet. Update to use these weights.';
      document.getElementById('draft-status').classList.toggle('is-pending', state.draftRequestWeight !== state.appliedRequestWeight);
      range.setAttribute('aria-valuetext', `Your request ${state.draftRequestWeight} percent; overall product evaluation ${external} percent`);
      document.getElementById('apply-button').disabled = state.draftRequestWeight === state.appliedRequestWeight;
      updateActions();
      record('source_weights_drafted', { request_weight: state.draftRequestWeight, external_weight: external });
    });
    range?.addEventListener('change', () => record('slider_adjustment', { request_weight: state.draftRequestWeight }));
    document.getElementById('apply-button')?.addEventListener('click', () => {
      const previousRecommendation = recommendedProduct().id;
      state.appliedRequestWeight = state.draftRequestWeight;
      state.appliedNotice = previousRecommendation === recommendedProduct().id ? `Weights applied. Product ${recommendedProduct().id} remains recommended.` : `Recommendation changed: Product ${previousRecommendation} → Product ${recommendedProduct().id}.`;
      if (record('source_weights_applied', { request_weight: state.appliedRequestWeight, external_weight: 100 - state.appliedRequestWeight, previous_recommendation: previousRecommendation, recommended_product: recommendedProduct().id }) === false) return;
      render();
      document.getElementById('source-weight').focus({ preventScroll: true });
      document.getElementById('panel-result').classList.add('just-updated');
      announce(`Recommendations updated. Product ${recommendedProduct().id} is currently recommended.`);
    });
    document.getElementById('finish-button')?.addEventListener('click', () => {
      if (!canFinish()) return;
      if (record('selection_completed', { selected_product: state.selected, recommended_product: recommendedProduct().id, applied_request_weight: state.appliedRequestWeight, draft_request_weight: state.draftRequestWeight, recommendation_duration_ms: Math.round(Date.now() - stepStartedAt), total_duration_ms: Math.round(Date.now() - startedAt) }) === false) return;
      state.step = 3;
      persist();
      render(true);
      announce(`Your choice of Product ${state.selected} is complete.`);
    });
    document.getElementById('restart-button')?.addEventListener('click', restart);
    document.getElementById('continue-survey')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      document.getElementById('handoff-status').textContent = 'Passing your results to the survey…';
      try {
        const result = await window.StudySession.complete(completionPayload());
        document.getElementById('handoff-status').textContent = result.message;
        button.disabled = result.handedOff || !window.StudySession.integrationStatus().configured;
      } catch {
        document.getElementById('handoff-status').textContent = 'The survey did not receive your results. Your choice is retained on this device. Please try Continue to survey again.';
        button.disabled = false;
      }
    });
  }
  function restart() {
    if (participantMode) return;
    resetState('restart');
    render(true);
    announce('Back at the start. Copy and paste the assigned request to begin.');
  }
  function exportEvents() {
    if (participantMode) return;
    const payload = { ...completionPayload(), demo_version: VERSION, condition, mode: 'researcher_preview', elapsed_ms: Math.round(Date.now() - startedAt), complete: state.step === 3, selected_product: state.selected, events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `forma-${condition}-${VERSION}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Preview events downloaded as JSON.');
  }
  document.querySelectorAll('[data-condition]').forEach(button => button.addEventListener('click', () => {
    condition = button.dataset.condition;
    const url = new URL(location.href);
    url.searchParams.delete('condition');
    url.searchParams.set('c', String(validConditions.indexOf(condition) + 1));
    history.replaceState({}, '', url);
    updateChrome();
    resetState('condition_switch');
    render();
    announce(`Switched to ${button.textContent.trim()}. The task has restarted.`);
  }));
  document.getElementById('reset-button').addEventListener('click', restart);
  document.getElementById('brand-link').addEventListener('click', event => { event.preventDefault(); restart(); });
  document.getElementById('export-events').addEventListener('click', exportEvents);
  window.addEventListener('popstate', () => {
    if (participantMode) { updateChrome(); render(); return; }
    const navigationParams = new URLSearchParams(location.search);
    const current = navigationParams.get('condition');
    condition = conditionCodes[navigationParams.get('c')] || (validConditions.includes(current) ? current : 'none');
    updateChrome();
    resetState('history_navigation');
    render();
  });
  if (session?.restored) {
    state = session.restored.state;
    events = session.restored.events;
    startedAt = session.restored.startedAtEpoch;
    stepStartedAt = session.restored.stepStartedAtEpoch;
    if (state.step < 3) record('session_resumed');
  } else resetState();
  window.addEventListener('pagehide', persist);
  updateChrome();
  render();
})();
