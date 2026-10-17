# FORMA — Interactive Transparency Demo

Three-condition English earbud recommender prototype for design review. It uses a deterministic weighted score, not a live AI model. No participant data are collected or transmitted. This is a stimulus demo, not a complete data-collection experiment.

## Open

Open `index.html` in a browser. No installation or build is required. All assets are local.

The default view contains researcher controls. Choose a condition and use **Open participant view** to open its participant view. Participant URLs:

- `?condition=none&mode=participant`
- `?condition=static&mode=participant`
- `?condition=interactive&mode=participant`

The participant view hides researcher controls and design notes. URL parameters are preview controls, not secure experiment assignment. Refreshing resets the session.

## Interaction

1. Everyone is instructed to select battery and sound quality. Other combinations cannot continue.
2. Everyone sees identical fictional products, prices, and specifications. Every product remains selectable in all conditions.
3. No explanation: recommendation only. Static: the 50:50 weights are disclosed. Interactive: the same disclosure plus working weight controls.
4. Interactive participants must apply at least one nonbaseline preset before completing. They may return to 50:50 afterward. Pending changes must be applied or reverted before completion.
5. Completion displays the chosen product. No validated questionnaire is implied or included.

| Product | Battery | Sound | Price |
| --- | --- | --- | --- |
| A | 9 | 6 | $79.00 |
| B | 8 | 8 | $79.00 |
| C | 6 | 9 | $79.00 |

Score = battery × battery weight + sound × sound weight.

| Battery : sound | A | B | C | Recommended |
| --- | --- | --- | --- | --- |
| 75 : 25 | 8.25 | 8 | 6.75 | A |
| 50 : 50 | 7.5 | 8 | 7.5 | B |
| 25 : 75 | 6.75 | 8 | 8.25 | C |

Product display order stays A–B–C to avoid moving the selection targets; the recommendation badge updates. Scores are not shown to participants.

## GitHub Pages

The demo is published in the existing public repository `hanyoungkim87-ctrl/hanyoungkim87-ctrl.github.io`, inside the `interactive-transparency-demo/` folder.

Demo URL: https://hanyoungkim87-ctrl.github.io/interactive-transparency-demo/

Update `index.html`, `styles.css`, `app.js`, and this `README.md` in that folder on the repository's Pages source branch. The existing GitHub Pages deployment serves this path; no changes to other site files are needed.

No private research data or original manuscripts are included.

## Before a real study

Add approved consent, random assignment, the finalized measurement instruments, and an appropriately protected response endpoint. Preregister the analysis and pilot the manipulation. Standardized preference input is shared interaction; interactive participants also have additional task effort. This prototype tests disclosed attribute-weight revision, a conceptual extension from source-weight revision.
