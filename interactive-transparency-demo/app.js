(() => {
  'use strict';
  const validConditions = ['none', 'static', 'interactive'];
  const params = new URLSearchParams(location.search);
  let condition = validConditions.includes(params.get('condition')) ? params.get('condition') : 'none';
  const participantMode = params.get('mode') === 'participant';
  const products = [
    { id: 'A', battery: 9, sound: 6 },
    { id: 'B', battery: 8, sound: 8 },
    { id: 'C', battery: 6, sound: 9 }
  ];
  const descriptions = {
    none: 'Condition 01 · The shared input task is followed by a recommendation. Recommendation criteria and weights are not disclosed.',
    static: 'Condition 02 · The shared input task is followed by a recommendation and its battery and sound weights. The weights cannot be changed.',
    interactive: 'Condition 03 · The same explanation is paired with weight controls. Applying a different setting updates the recommendation.'
  };
  let state;
  const screen = document.getElementById('screen');
  const announcement = document.getElementById('announcement');
  let announceTimer;

  function announce(message) {
    clearTimeout(announceTimer);
    announcement.textContent = '';
    announceTimer = setTimeout(() => { announcement.textContent = message; }, 30);
  }
  function resetState() {
    state = { step: 1, preferences: [], appliedBattery: 50, pendingBattery: 50, changedOnce: false, selected: null, appliedNotice: '' };
  }
  function recommendedProduct() {
    return [...products].sort((a, b) => score(b) - score(a))[0];
  }
  function score(product) {
    return (product.battery * state.appliedBattery + product.sound * (100 - state.appliedBattery)) / 100;
  }
  function updateChrome() {
    document.body.classList.toggle('participant-mode', participantMode);
    document.querySelectorAll('[data-condition]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.condition === condition));
    });
    document.getElementById('condition-description').textContent = descriptions[condition];
    const link = new URL(location.href);
    link.search = new URLSearchParams({ condition, mode: 'participant' }).toString();
    link.hash = '';
    document.getElementById('participant-link').href = link.href;
    const home = new URL(location.href);
    home.search = new URLSearchParams({ condition, ...(participantMode ? { mode: 'participant' } : {}) }).toString();
    home.hash = '';
    document.getElementById('brand-link').href = home.href;
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
  const icons = {
    price: '<circle cx="14" cy="14" r="10"/><path d="M9 11l2 7 3-7 3 7 2-7M8 13h12"/>',
    design: '<path d="M14 3l10 6v10l-10 6-10-6V9zM4 9l10 6 10-6M14 15v10"/>',
    battery: '<rect x="3" y="7" width="20" height="14" rx="3"/><path d="M25 11v6M8 11v6M12 11v6M16 11v6"/>',
    sound: '<path d="M5 11h5l6-5v16l-6-5H5zM20 10c2 2 2 6 0 8M23 6c5 5 5 11 0 16"/>'
  };
  function option(id, title) {
    return `<label class="preference-option"><input type="checkbox" name="preference" value="${id}" ${state.preferences.includes(id) ? 'checked' : ''}><svg class="option-icon" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${icons[id]}</svg><span class="option-title">${title}</span><span class="option-check" aria-hidden="true">✓</span></label>`;
  }
  function preferenceScreen() {
    return `<div class="preference-layout"><section><span class="eyebrow">YOUR STARTING POINT</span><h2 class="screen-title">What matters for<br>this choice?</h2><p class="screen-copy">Before exploring the products,<br>enter the criteria assigned for this task.</p><div class="task-card"><span class="task-label">YOUR TASK</span><p>For this task, choose wireless earbuds with <strong>battery life</strong> and <strong>sound quality</strong> as your main priorities.</p><p class="task-small">Select “Battery life” and “Sound quality” below.</p></div></section><form class="preference-form" id="preference-form" novalidate><fieldset style="border:0;padding:0;margin:0"><legend class="form-label">Select the two criteria for this task.</legend><div class="preference-options">${option('price', 'Price')}${option('design', 'Design')}${option('battery', 'Battery life')}${option('sound', 'Sound quality')}</div></fieldset><p class="form-error" id="preference-error" role="alert"></p><button class="primary-button full" type="submit">See recommendations <span aria-hidden="true">→</span></button><p class="form-hint">You will compare three products on the next screen.</p></form></div>`;
  }
  function earbudArt(suffix) {
    return `<svg class="earbud-svg" viewBox="0 0 160 150" role="img" aria-label="Wireless earbuds"><defs><linearGradient id="bud-${suffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#eef1e9"/><stop offset="1" stop-color="#cdd6c7"/></linearGradient><linearGradient id="stem-${suffix}" x1="0" x2="1"><stop stop-color="#f9fbf5"/><stop offset=".6" stop-color="#e2e8dc"/><stop offset="1" stop-color="#bfcbb8"/></linearGradient></defs><ellipse cx="80" cy="134" rx="45" ry="5" fill="#dfe5d8" opacity=".55"/><g transform="translate(18 18) rotate(-20 35 55)"><rect x="35" y="42" width="18" height="64" rx="9" fill="url(#stem-${suffix})" stroke="#b9c5b2" stroke-width=".7"/><path d="M47 12c17 0 25 11 21 26-3 12-13 18-26 18-17 0-27-9-27-22S29 12 47 12Z" fill="url(#bud-${suffix})" stroke="#bdc8b6" stroke-width=".7"/><ellipse cx="20" cy="33" rx="9" ry="12" fill="#b8c4b0" transform="rotate(-17 20 33)"/><ellipse cx="19" cy="33" rx="5" ry="8" fill="#597055" transform="rotate(-17 19 33)"/><ellipse cx="19" cy="33" rx="3" ry="5" fill="#354d32"/><path d="M43 20c10-2 15 4 17 9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="42" y="91" width="4" height="8" rx="2" fill="#8a9d81"/></g><g transform="translate(78 7) rotate(22 30 65)"><rect x="24" y="48" width="18" height="66" rx="9" fill="url(#stem-${suffix})" stroke="#b9c5b2" stroke-width=".7"/><path d="M32 20c-17 0-25 11-21 26 3 12 13 18 26 18 17 0 27-9 27-22S50 20 32 20Z" fill="url(#bud-${suffix})" stroke="#bdc8b6" stroke-width=".7"/><ellipse cx="61" cy="41" rx="8" ry="12" fill="#c0ccba" transform="rotate(17 61 41)"/><ellipse cx="63" cy="41" rx="4" ry="8" fill="#597055" transform="rotate(17 63 41)"/><ellipse cx="64" cy="41" rx="2" ry="5" fill="#354d32"/><path d="M31 27c-9 0-14 4-15 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="31" y="100" width="4" height="7" rx="2" fill="#8a9d81"/></g></svg>`;
  }
  function explanationPanel() {
    if (condition === 'none') return '';
    const battery = state.appliedBattery;
    const presets = [[75, 'Battery first'], [50, 'Balanced'], [25, 'Sound first']];
    return `<section class="explanation-panel" aria-label="Criteria used for this recommendation"><div class="explanation-top"><div><div class="explanation-label">HOW WE RECOMMEND</div><div class="explanation-main">Battery weight: ${battery}% · Sound weight: ${100 - battery}%.</div></div><div class="weight-chart" aria-hidden="true"><div class="weight-visual"><div style="width:${battery}%"></div><div style="width:${100 - battery}%"></div></div><div class="weight-labels"><span>Battery ${battery}%</span><span>Sound ${100 - battery}%</span></div></div></div>${condition === 'interactive' ? `<div class="control-divider"></div><div class="control-heading"><h3>Adjust the recommendation criteria.</h3><p>Try a different weighting and apply it before choosing a product.</p></div><div class="preset-row"><fieldset class="preset-options" style="border:0;padding:0;margin:0"><legend class="sr-only">Battery and sound weights</legend>${presets.map(([value, label]) => `<label class="preset"><input type="radio" name="weight" value="${value}" ${state.pendingBattery === value ? 'checked' : ''}><strong>${label}</strong><small>Battery ${value}%<br>Sound ${100 - value}%</small></label>`).join('')}</fieldset><button type="button" class="primary-button apply-button" id="apply-button" ${state.pendingBattery === state.appliedBattery ? 'disabled' : ''}>Apply and recommend <span aria-hidden="true">↗</span></button></div><p class="apply-status" id="apply-status">${state.appliedNotice || 'Battery and sound currently have equal weight. Try a different setting.'}</p>` : ''}</section>`;
  }
  function productCard(product) {
    const recommended = recommendedProduct().id === product.id;
    return `<label class="product-card ${state.selected === product.id ? 'selected' : ''}" data-product="${product.id}"><input type="radio" name="product" value="${product.id}" aria-label="Select Product ${product.id}${recommended ? ', currently recommended' : ''}" ${state.selected === product.id ? 'checked' : ''}><div class="product-topline"><span class="product-number">WIRELESS / ${product.id}</span>${recommended ? '<span class="recommend-badge">Recommended</span>' : '<span></span>'}</div><div class="product-art">${earbudArt(product.id)}</div><div class="product-heading"><h4>Product ${product.id}</h4><span class="selection-circle" aria-hidden="true">✓</span></div><p class="product-subtitle">True wireless earbuds</p><div class="product-price">$79<small>.00</small></div><div class="spec-row"><span class="spec-name">Battery</span><span class="spec-track" aria-hidden="true"><span style="width:${product.battery * 10}%"></span></span><span class="spec-number">${product.battery} / 10</span></div><div class="spec-row"><span class="spec-name">Sound</span><span class="spec-track" aria-hidden="true"><span style="width:${product.sound * 10}%"></span></span><span class="spec-number">${product.sound} / 10</span></div><div class="product-bottom"><span>5g · IPX4 rated</span><span>Charging case included</span></div></label>`;
  }
  function actionCopy() {
    if (condition === 'interactive' && !state.changedOnce) return 'Change the weights once and select “Apply and recommend.”';
    if (condition === 'interactive' && state.pendingBattery !== state.appliedBattery) return 'Apply the pending weights or return to the currently applied setting.';
    return state.selected ? 'You can choose any product, whether recommended or not.' : 'Select any one product, whether recommended or not.';
  }
  function canFinish() {
    return state.selected !== null && (condition !== 'interactive' || (state.changedOnce && state.pendingBattery === state.appliedBattery));
  }
  function recommendationScreen() {
    return `<section><div class="recommendation-heading"><div><span class="eyebrow">FIND YOUR FIT</span><h2 class="screen-title">Explore your options.</h2><p class="screen-copy">Compare battery life and sound quality, then choose the product you prefer.</p></div><span class="category-pill">Wireless earbuds · 3 products</span></div>${explanationPanel()}<div class="products-caption"><h3>Available products</h3><p>Battery and sound are scored out of 10. Price and all other specifications are identical.</p></div><fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">Choose a product</legend><div class="products-grid">${products.map(productCard).join('')}</div></fieldset><div class="recommendation-actions"><div class="selection-summary"><span id="selection-summary">${state.selected ? `Product ${state.selected} selected.` : 'Which product would you choose?'}</span><div class="action-hint" id="action-hint">${actionCopy()}</div></div><button class="primary-button" id="finish-button" type="button" ${canFinish() ? '' : 'disabled'}>Confirm selection <span aria-hidden="true">→</span></button></div></section>`;
  }
  function completionScreen() {
    const product = products.find(item => item.id === state.selected);
    return `<section class="completion-layout"><div class="completion-icon" aria-hidden="true">✓</div><span class="eyebrow">YOUR CHOICE</span><h2 class="screen-title">Your choice is complete.</h2><p class="screen-copy">You selected Product ${product.id} from the three options.</p><div class="completion-card"><div class="product-art">${earbudArt('chosen')}</div><div><span class="eyebrow">SELECTED PRODUCT</span><h3>Product ${product.id}</h3><p>True wireless earbuds · $79.00</p><p>Battery ${product.battery}/10 · Sound ${product.sound}/10</p></div></div><div class="completion-details"><span>Final recommendation <strong>Product ${recommendedProduct().id}</strong></span>${condition !== 'none' ? `<span>Applied weights <strong>Battery ${state.appliedBattery} : Sound ${100 - state.appliedBattery}</strong></span>` : ''}</div><button class="secondary-button" type="button" id="restart-button">Try again from the start <span aria-hidden="true">↻</span></button></section>`;
  }
  function updateActions() {
    document.getElementById('selection-summary').textContent = state.selected ? `Product ${state.selected} selected.` : 'Which product would you choose?';
    document.getElementById('action-hint').textContent = actionCopy();
    document.getElementById('finish-button').disabled = !canFinish();
  }
  function bindScreen() {
    const form = document.getElementById('preference-form');
    if (form) {
      form.addEventListener('change', () => {
        state.preferences = [...form.querySelectorAll('input:checked')].map(input => input.value);
        document.getElementById('preference-error').textContent = '';
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (state.preferences.length !== 2 || !state.preferences.includes('battery') || !state.preferences.includes('sound')) {
          document.getElementById('preference-error').textContent = 'For this task, select only “Battery life” and “Sound quality.”';
          return;
        }
        state.step = 2;
        render(true);
        announce('Recommendations are ready. Product B is currently recommended.');
      });
    }
    screen.querySelectorAll('input[name="product"]').forEach(input => input.addEventListener('change', () => {
      state.selected = input.value;
      screen.querySelectorAll('.product-card').forEach(card => card.classList.toggle('selected', card.dataset.product === state.selected));
      updateActions();
      announce(`Product ${state.selected} selected.`);
    }));
    screen.querySelectorAll('input[name="weight"]').forEach(input => input.addEventListener('change', () => {
      state.pendingBattery = Number(input.value);
      document.getElementById('apply-button').disabled = state.pendingBattery === state.appliedBattery;
      document.getElementById('apply-status').textContent = state.pendingBattery === state.appliedBattery ? `These weights are already applied: battery ${state.appliedBattery}%, sound ${100 - state.appliedBattery}%.` : `New weights selected. Select “Apply and recommend” to use them.`;
      updateActions();
    }));
    document.getElementById('apply-button')?.addEventListener('click', () => {
      state.appliedBattery = state.pendingBattery;
      if (state.appliedBattery !== 50) state.changedOnce = true;
      state.appliedNotice = `Your selected weights have been applied. Product ${recommendedProduct().id} is now recommended.`;
      render();
      const currentPreset = screen.querySelector(`input[name="weight"][value="${state.appliedBattery}"]`);
      currentPreset.focus({ preventScroll: true });
      announce(`Applied ${state.appliedBattery}% battery and ${100 - state.appliedBattery}% sound. Product ${recommendedProduct().id} is now recommended. Select any product you prefer.`);
    });
    document.getElementById('finish-button')?.addEventListener('click', () => {
      if (!canFinish()) return;
      state.step = 3;
      render(true);
      announce(`Your choice of Product ${state.selected} is complete.`);
    });
    document.getElementById('restart-button')?.addEventListener('click', restart);
  }
  function restart() {
    resetState();
    render(true);
    announce('Back at the start. Enter the criteria for this task.');
  }
  document.querySelectorAll('[data-condition]').forEach(button => button.addEventListener('click', () => {
    condition = button.dataset.condition;
    const url = new URL(location.href);
    url.searchParams.set('condition', condition);
    history.replaceState({}, '', url);
    updateChrome();
    resetState();
    render();
    announce(`Switched to ${button.textContent.trim()}. You can begin the task again.`);
  }));
  document.getElementById('reset-button').addEventListener('click', restart);
  document.getElementById('brand-link').addEventListener('click', event => { event.preventDefault(); restart(); });
  window.addEventListener('popstate', () => {
    const current = new URLSearchParams(location.search).get('condition');
    condition = validConditions.includes(current) ? current : 'none';
    updateChrome();
    resetState();
    render();
  });
  resetState();
  updateChrome();
  render();
})();
