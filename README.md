# DnD-Toolkit

Small client-side toolkit for running Dungeons & Dragons 5e games.
It combines a damage‑per‑round calculator, attack roller, initiative tracker,
notes pad and quick reference for conditions in a single page.

## Features

- **DPR Calculator** – build attacks or spells and estimate expected damage.
- **Round Composer** – combine multiple attacks/spells and apply once-per-round options.
- **Weapon Masteries** – toggle Cleave, Graze and Vex effects in attack simulations.
- **Attack Roller** – roll attacks or save‑based spells with crit ranges, advantage modes and GWM tagging.
- **Initiative Tracker** – manage combat order with conditions, round tracking and auto‑sorting.
- **Notes** – keep drag‑and‑drop notes that persist between sessions.
- **Quick Reference** – browse common conditions for rules reminders.
- **Dice Utilities** – roll expressions, compute averages and simulate advantage modes.
- **Local Persistence** – DPR calculator, initiative tracker and notes survive page refreshes via local storage.

Open `index.html` in a modern browser to use the app. All logic runs locally in
vanilla JavaScript with styling from `styles.css`.

## Structure

The app is composed of standalone modules loaded by `index.html`:

- `app.js` – shared utilities, dice parsing/rolling helpers and tab routing.
- `dpr_calculator.js` – DPR calculator and round composer logic.
- `attack_roller.js` – interactive attack and spell roller.
- `initiative_tracker.js` – initiative list with condition tracking and round advancement.
- `notes.js` – simple notes pad with drag‑and‑drop reordering.
- `conditions.js` – definitions for the quick reference and initiative conditions.
- `styles.css` – base styling for all pages.

No build step or external dependencies are required; load the HTML file directly
to run the app offline.

## Development

The project uses only static files; no build step is required. Feel free to
fork and modify for your own campaigns.
