# FORMA — Interactive Transparency Demo

Version: `2026-10-21-study-v4`.

English three-condition recommender stimulus. Existing branding and the assigned copy/paste task are retained. This revision improves typography, shows update feedback next to the controls, corrects product tradeoffs, and prepares participant resume and Qualtrics handoff. It does not establish successful manipulation or server-side survey saving.

## Live demo

https://hanyoungkim87-ctrl.github.io/interactive-transparency-demo/

Participant previews (no participant ID, no survey submission):

- `?c=1&mode=participant` — no explanation
- `?c=2&mode=participant` — static explanation
- `?c=3&mode=participant` — interactive explanation

Legacy descriptive condition parameters still work; participant URLs are normalized to codes. Codes obscure names, not assignment or security. Randomize and retain condition in Qualtrics. Participant identity can be supplied through `PROLIFIC_PID`, `ResponseID`, or `pid`. See [QUALTRICS_SETUP.md](QUALTRICS_SETUP.md).

The repository is `hanyoungkim87-ctrl/hanyoungkim87-ctrl.github.io`; only the `interactive-transparency-demo/` folder belongs to this project. No build dependencies or remote fonts/assets are used. The system font stack adapts to the device. Update the version query on assets when releasing.

## Common task and conditions

Everyone copies and pastes:

> I'm looking for wireless earbuds with long battery life and good sound quality.

The goal is assigned, not a statement of actual personal preference. Copy request writes only the supplied text to the clipboard and never autofills or reads the user's clipboard. A manual-copy fallback is available. Case, punctuation, apostrophes, and spacing may differ; unrelated input is rejected. Arbitrary invalid input is not persisted.

All three conditions share the task, product order A–B–C, $79 prices, default recommendation B, product information, current-recommendation banner, and free choice of any product.

| Condition | Source explanation | Weight adjustment |
| --- | --- | --- |
| No explanation | None | None |
| Static | Both input definitions, combination rule, applied 50:50 weights | Fixed |
| Interactive | Exactly the same explanation and initial applied weights | Optional 0–100 slider in steps of 5, followed by Update recommendations |

The two inputs are request match and overall product evaluation. They are two evaluations of the same products, not independent review datasets. No customer reviews are claimed or retrieved. The shared explanation says the request score averages battery and sound, while the overall score averages all four displayed attributes. The slider adjusts the relative weights of these two evaluations, not battery versus sound directly.

The controls state what to do without asserting that participants feel empowered. Adjustment is optional and no product choice is blocked based on agreement with the recommendation. A slider movement changes only draft weights. The pending notice is explicit. Apply updates the weights and recommendation while preserving the selected product. A result box immediately below the Update button gives the new product and previous-to-current transition; it also reports when the top product stays the same. A matching initial result box is shown in static. A sticky common banner remains visible while browsing the products.

## Coherent fictional product model

Battery receives one point per hour, capped at 10; this conversion is disclosed identically in all conditions. Other displayed attributes are out of 10.

| Product | Battery hours | Sound | Comfort | Calls | Request match | Overall evaluation |
| --- | --- | --- | --- | --- | --- | --- |
| A | 10 | 8 | 5 | 7 | 9.00 | 7.50 |
| B | 8 | 9 | 10 | 7 | 8.50 | 8.50 |
| C | 6 | 10 | 9 | 10 | 8.00 | 8.75 |

`requestMatch = (batteryScore + sound) / 2`

`overallEvaluation = (batteryScore + sound + comfort + calls) / 4`

`finalScore = requestMatch * requestWeight + overallEvaluation * (1 - requestWeight)`

| Request weight | A score | B score | C score | Recommended |
| --- | --- | --- | --- | --- |
| 75% | 8.625 | 8.500 | 8.1875 | A |
| 50% | 8.250 | 8.500 | 8.3750 | B |
| 25% | 7.875 | 8.500 | 8.5625 | C |

Battery and sound trade off across all products. B has the highest comfort rating and is not the middle alternative on every attribute. This removes the earlier task-relative dominance, but responsive recommendations can still affect perceived fit. This three-cell study estimates the interface's total effect; it does not isolate an agency mechanism from output fit. Post-treatment recommendation–choice agreement should not be treated as a routine adjustment covariate.

## Readability

Core instructions and explanation text are 20px on desktop and mobile, headings 27–36px, applied percentages 36px, controls 18–19px, and button targets at least 60px high. The native slider has a 56px target and 34px thumb in Chromium. Product facts are 18px. Secondary labels are 14–17px. Focus indicators, contrast, screen-reader announcements, and reduced-motion preferences are retained. Common text and product styling are identical across conditions.

## Participant operations

Participants have no restart button, completion retry link, or clickable brand reset. Sessions with an ID retain progress and the completed choice in localStorage under a stable study-and-participant key. Refresh restores the same condition and choice. This is local resume, not durable server storage or tamper-proof identity verification. Clearing storage or changing devices bypasses local retention; the survey must manage assignment and duplicate responses.

Researcher mode retains resets, condition switches, and JSON export. No-ID participant previews intentionally do not submit data. Completed participant screens provide Continue to survey, enabled only for an identified session with a configured route.

The survey payload includes participant and condition identifiers, stimulus version, chosen product, initial/final recommendation, applied weights, slider-adjustment and raw-input counts, update count/flag, whether recommendation changed, and total/recommendation-stage elapsed time. Slider adjustment counts committed native `change` events; raw `input` events are separate and must not be interpreted as separate drag gestures. Time is wall-clock elapsed, including pauses and reloads. It is not active-attention time.

`study-config.js` is deliberately disabled until the researcher supplies the actual Qualtrics domain or redirect URL. `qualtrics-bridge.js` is a question-JavaScript template. The setup guide specifies Embedded Data fields, origin checks, matching IDs/condition, and end-to-end response verification. An iframe acknowledgement confirms receipt by the survey page; a redirect only passes fields. Neither alone proves that Qualtrics saved the response.

## Verification

Run JavaScript syntax checks and the session tests supplied with the integration. Browser checks should cover:

1. Same request, initially empty field, valid/invalid wording, and initial B in all conditions.
2. No explanation/slider in condition 1; identical shared explanation in 2 and 3.
3. Draft 75 keeps applied50/B until Apply; Apply gives75/A;25 givesC;50 givesB. Selection survives all updates.
4. Choose any product and finish with no adjustment, or with an unapplied draft.
5. Participant has no reset paths; same-ID refresh retains weights, logs, condition, and completed selection. A changed condition query cannot reassign that ID locally.
6. Desktop and 390px/320px mobile readability, no horizontal overflow, and adjacent update result.
7. Survey receipt, retry, and saved response checks in the actual configured Qualtrics survey before recruitment.

Products and scores are synthetic. No AI model or unrestricted natural-language processing is used. Manipulation strength must be established with a participant pilot; no effects or publishability are guaranteed.
