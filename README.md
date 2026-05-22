# GAMES

Three browser games in one repository.

## Projects

| Folder | Game | How to play |
|--------|------|-------------|
| [`flappy-ball/`](flappy-ball/) | **Flappy Ball** (Neon Flap) | Press SPACE or tap to fly through pipe gaps |
| [`bouncing-ball/`](bouncing-ball/) | **Bouncing Ball** | Side-scrolling runner — SPACE/tap to jump over obstacles |
| [`galaxy-drift/`](galaxy-drift/) | **Galaxy Drift** | Mouse-only neon space shooter — auto lasers, combos, events |

## Run locally

Open either game's `index.html` in your browser, or from the repo root:

```powershell
cd flappy-ball
python -m http.server 8080
# open http://localhost:8080
```

## Tech

- HTML, CSS, JavaScript only
- `requestAnimationFrame` for smooth animation
- No build step required
