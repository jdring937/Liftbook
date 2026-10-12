# Liftbook

A personal strength training log that runs as an iPhone Home Screen web app. It works offline and keeps all data on the device.

- Log workouts with a rest timer, previous-set values, and live PR flags
- Saved workouts and multi-week programs
- History calendar with personal records
- Training trends, per-exercise estimated 1RM (Brzycki or Epley), and a muscle tracker (body map, radar, table)
- JSON backup and CSV export

## Install on iPhone

Open the GitHub Pages URL in Safari, tap Share, then Add to Home Screen. Open it once while online; after that it works offline.

## Develop

```
npm install
node build.mjs
```

The build writes a self-contained site to `docs/`, which GitHub Pages serves from the `main` branch. Commit `docs/` after each build to deploy.
