# RHYTHM.DEV // ANALOG TELEMETRY

A tactile portfolio instrument built from a diegetic soundcheck boot, graph-paper console shell, eight switchable themes, a live LED dot matrix, a 128 BPM sequencer, and a photograph-sampled ASCII drummer/runner portrait with springy curls.

## Requirements

- Node.js 22 (the version is pinned in `.nvmrc`)
- npm 10+

## Setup

```bash
npm ci
```

## Run locally

```bash
npm run dev
```

Open the local URL printed by Vite. The first visit in a browser tab runs the 1.2 second audio-console soundcheck and staged baffle reveal; later internal visits in the same session skip it. Use the top LED matrix to ripple the display, press `Space`, `J`, or `K` for percussion, and toggle the 128 BPM groove. The theme switcher persists any of the eight visual modes locally.

## Checks

The repository has one offline-capable test command. It validates the JavaScript entrypoints and architecture invariants without needing a browser or network connection:

```bash
npm test
# or
make test
```

## Production build

```bash
npm run build
npm run preview
```

The static output is written to `dist/`. `vite.config.js` uses a relative base path, so the generated files can be served from a GitHub Pages project URL as well as a root domain.

## GitHub Pages deploy

1. Run `npm ci` and `npm run build`.
2. Publish the contents of `dist/` from the `gh-pages` branch, or configure the repository's Pages source to use the generated artifact from `dist/`.
3. If using a GitHub Actions Pages workflow, use `npm ci`, `npm run build`, and upload `dist/` as the Pages artifact.

No external audio files are required. Kicks, rimshots, hi-hats, sub-bass, and the takeoff sweep are synthesized in `src/audio.js` after a user gesture. Sequencer timing is scheduled against the Web Audio clock rather than a drifting visual timer. The portrait samples `image/previews/DSC06364.jpg` into a 48×48 luminance glyph matrix at build time/runtime without shipping the raw `.ARW` file to the browser.
