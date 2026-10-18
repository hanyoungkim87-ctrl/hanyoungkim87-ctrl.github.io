# FORMA — Interactive Transparency Demo

Version: `2026-10-18-source-v2`.

An English, three-condition stimulus demo comparing no explanation, static source explanation, and interactive source explanation. The existing visual design is retained. This version replaces the earlier battery-versus-sound weighting with **request-match versus overall external-evaluation weighting**.

This is a deterministic simulation for design review. Products, specifications, ratings, and source scores are fictional. It does not retrieve reviews, interpret arbitrary shopping requests, or call an AI model. It is not a complete research data-collection system.

## Open and publish

Live route: https://hanyoungkim87-ctrl.github.io/interactive-transparency-demo/

Repository: `hanyoungkim87-ctrl/hanyoungkim87-ctrl.github.io`, folder `interactive-transparency-demo/`. Update `index.html`, `styles.css`, `app.js`, and this `README.md` there. No other site files need changing. The script and stylesheet URLs include a version parameter to refresh cached assets. This source version should be verified on the live route after publication.

The files also run by opening `index.html` directly. No dependencies, build process, external fonts, or remote assets are required. Clipboard copying may be unavailable under local-file or restricted-browser access; the manual copy fallback remains available.

The default screen provides researcher condition buttons, a participant link for each condition, design notes, and event export. Each condition switch restarts the task and clears the current event log.

Participant links:

- `?condition=none&mode=participant`
- `?condition=static&mode=participant`
- `?condition=interactive&mode=participant`

Invalid condition values fall back to `none`. Participant mode hides condition names, researcher controls, design notes, and export controls. URL parameters are demonstration controls, not secure experiment assignment.

## Shared shopping task

All conditions assign the same goal and supply the same sentence:

> I'm looking for wireless earbuds with long battery life and good sound quality.

Participants copy the supplied request and paste it into a blank input field. The Copy request button copies only to the clipboard; it never fills the input. If copying is denied, the supplied text is selected and manual copy instructions appear. Submission accepts the fixed word sequence with differences in capitalization, punctuation, apostrophes, or spacing. Other wording receives a clear instruction to use the supplied sentence. No general natural-language understanding is implied.

This is an assigned task, not a claim about participants' real shopping preferences. The same input interaction appears in every condition.

## Conditions

| Condition | Recommendation screen |
| --- | --- |
| No explanation | The three product cards and current recommendation; no algorithm-source panel. |
| Static explanation | The same products, plus an explanation of both sources and a fixed 50:50 applied-weight display. |
| Interactive explanation | The exact same initial explanation and applied-weight display, plus an optional native slider and Update recommendations button. |

The shared source explanation distinguishes:

- **Your request:** match to the long battery life and good sound quality in the assigned request.
- **Product information & customer reviews:** overall evaluation across battery life, sound quality, comfort, and call quality.

The slider sets the weight of the request source from 0% to 100% in 5-point increments. The external source receives the remainder. Draft and applied weights are separate: moving the slider updates only the draft readout. The recommendation changes after Update recommendations. The applied bar always describes the currently applied weights.

No adjustment is required. Participants can select any product and finish from the default setting in every condition. If a draft change has not been applied, completion uses the existing recommendation; the interface states this. Product choice remains selected when a recommendation updates. No extra persuasive rationale or agency language appears only in the interactive condition.

## Synthetic product model

The same cards remain in A–B–C order, with all products priced at $79.00. Product A has stronger battery and sound attributes but lower comfort and call-quality ratings. Product C has stronger comfort and call quality but less battery life and lower sound quality. Product B is balanced. All attributes are synthetic scenario material.

| Product | Battery life | Sound | Comfort | Call quality | Request-fit score | Overall external-evaluation score |
| --- | --- | --- | --- | --- | --- | --- |
| A | Up to 12 hours | 9/10 | 6/10 | 6/10 | 9 | 6 |
| B | Up to 10 hours | 8/10 | 8/10 | 8/10 | 8 | 8 |
| C | Up to 8 hours | 7/10 | 9/10 | 9/10 | 6 | 9 |

The two source scores are **assigned, separate synthetic values**. They are not battery and sound scores renamed, not empirical review averages, and not scores calculated by parsing the submitted text. They model two ways of evaluating the same fictional products. The source scores are disclosed in researcher notes and omitted from participant product cards.

`score = requestFit × requestWeight + externalEvaluation × (1 − requestWeight)`

| Request : external | A | B | C | Recommended |
| --- | --- | --- | --- | --- |
| 75 : 25 | 8.25 | 8 | 6.75 | A |
| 50 : 50 | 7.5 | 8 | 7.5 | B |
| 25 : 75 | 6.75 | 8 | 8.25 | C |

The current recommendation badge changes; the cards do not move. A small neutral status reads “Recommendations updated.” Recommendations are simulated, and not every slider movement must change the top product.

## Browser-memory event log

The demo records the current condition, elapsed times, fixed-request submission, validation outcomes, source-weight drafts and applications, recommendations, product selection, and completion. Submission and recommendation-stage durations are included. The canonical assigned sentence is logged only after validation; rejected input contents are never logged. No participant identifiers, cookies, local storage, or server requests are used.

The log is held only in browser memory and clears on restart, condition switch, or page reload. In researcher view, Download preview JSON exports the current preview for inspecting the event structure and planning a future Qualtrics or other survey integration. Participant view has no export control. This feature does not provide persistent participant data collection.

## Manual QA

1. Open each participant URL. Check that no condition controls or researcher notes appear.
2. Check the same assigned request, empty input, and task instructions in all three conditions. Empty or changed wording should fail; the supplied sentence should pass. Verify copy-and-paste and the manual clipboard fallback.
3. Confirm A–B–C order, identical products and prices, and initial recommendation B in every condition.
4. Confirm no source panel in `none`; compare the initial static and interactive explanation text and 50:50 applied display for exact equality.
5. In interactive, move the request slider to 75. Before updating, B must remain recommended and the applied weights must remain 50:50. Update: A becomes recommended and the applied weights become 75:25.
6. Apply 25:75 and then 50:50. Recommendations should become C and B. Moving the slider without applying must not alter recommendations.
7. In all conditions, select any product and complete. In interactive, also complete without ever changing weights and with an unapplied draft. The chosen product must be preserved.
8. Switch conditions or restart. Request, choice, weights, progress, and log should reset.
9. Use keyboard-only navigation for copy, input, slider arrows, product radios, and completion. Check narrow mobile layouts, visible focus, and neutral status announcements.
10. In researcher view, download JSON and confirm condition, events, applied versus draft weights, recommendations, choice, and durations. Reload and confirm the old log is gone.
11. After publishing, verify the versioned script and stylesheet load from the live GitHub Pages URL.

## Research limitations

This is a three-cell design, not a full explanation × control factorial. Common request entry is shared interaction; the interactive condition adds an optional opportunity to change source weights. Actual use and task duration may vary and are logged. Responsive recommendations may change perceived fit as well as perceived control. These limitations are not resolved by the demo.

A real study still needs an approved protocol, consent, secure assignment, finalized outcome and mediator measures, a protected response endpoint, and a manipulation pilot. No survey items, effects, successful manipulation, or publishability are claimed here. No private research data or original manuscripts are included.
