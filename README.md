# 💬 Talk? — Conversation Starter

A static web app for couples, friends and parties: spin a wheel-of-fortune to get a random conversation question by topic and depth. Works straight from GitHub Pages — no build step, no backend, just HTML/CSS/JS.

## How it works

1. **Entry screen** — pick your language by answering "Talk?" with a green **Yes/Ja** or red **No/Nein** button.
2. **Setup screen** — toggle the topics you want and set a difficulty range (1–10: small talk → deep talk, secrets, personal). Shows how many questions are in your filtered pool.
3. **Wheel** — a double-ring wheel of fortune: the outer ring holds your selected topics, the inner ring the difficulty values available in your pool. Tap the round spin button in the middle — or swipe the wheel. The result is shown as a question card with *Next question*, *Spin again* and *Setup*.

The wheel is populated only with possible outcomes — every topic/difficulty segment on it has at least one question in your filtered pool. No rigging needed.

## Data format

Questions live in [`questions.csv`](questions.csv):

```csv
topic,question,question_de,difficulty
family,What family secret did you discover as an adult?,Welches Familiengeheimnis hast du als Erwachsener entdeckt?,6
```

- `topic` — one of the topics defined in `app.js` (`family`, `friends`, `work`, `childhood`, `dreams`, `values`, `secrets`, `hypotheticals`, `travel`, `love`, `money`)
- `question` — English text (must be quoted if it contains commas)
- `question_de` — German translation (falls back to English if empty)
- `difficulty` — integer 1–10

## Run locally

The app fetches `questions.csv`, so open it via a local web server, not `file://`:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: `main` branch, `/ (root)`.
3. Your app is live at `https://<user>.github.io/<repo>/`.

All paths are relative, so it works from a repo subpath out of the box.

## Contributing questions

Add rows to `questions.csv` (both languages ideally) and open a pull request. Please keep one question per row and don't touch the header.
