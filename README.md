# Liftbook

A personal strength training log that runs as an iPhone Home Screen web app. It works offline and keeps all data on the device.

- Log workouts with a rest timer, previous-set values, and live PR flags
- Saved workouts and multi-week programs
- History calendar with personal records
- Training trends, per-exercise estimated 1RM (Brzycki or Epley), and a muscle tracker (body map, radar, table)
- JSON backup and CSV export

## Install on iPhone

Open https://jdring937.github.io/Liftbook/ in Safari, tap Share, then Add to Home Screen. Open it once while online; after that it works offline.

## Develop

```
npm install
node build.mjs
```

The build writes a self-contained site to `docs/`. GitHub Pages serves the `gh-pages` branch, which holds a copy of `docs/`. To deploy, commit the build on `main`, then publish it:

```
git subtree push --prefix docs origin gh-pages
```
