# SignalForge demo video

This directory contains the reproducible source for the public SignalForge demo video.

The edit deliberately separates **product proof** from **motion treatment**:

- **Playwright** captures the real public SignalForge surfaces.
- **Remotion** is the master timeline and final render path.
- **HyperFrames** provides a deterministic HTML motion opener that can be rendered independently or used as a design reference for the Remotion opening.
- The narration is stored in [`script.md`](script.md) and can be regenerated without changing product claims.

The public product remains the proof. Motion graphics are presentation only.

## 1. Install

From `video/`:

```bash
npm install
npx playwright install chromium
```

## 2. Capture the real live product

```bash
npm run capture
```

The capture script opens the canonical Cloudflare runtime and writes fresh screenshots to `public/captures/`:

- `home.png`
- `dashboard.png`
- `token.png`
- `playground.png`
- `runtime-proof.json`

It also refuses to complete if `/health` and X-Agent verification expose different source commits.

To capture a different runtime:

```bash
SIGNALFORGE_BASE=https://example.workers.dev npm run capture
```

PowerShell:

```powershell
$env:SIGNALFORGE_BASE = "https://signalforge.faadil-casecraft.workers.dev"
npm run capture
```

## 3. Add narration

The locked English narration is in [`script.md`](script.md).

A clear AI voiceover was generated during submission preparation. Download/export the approved narration as:

```text
video/public/voiceover.mp3
```

The master Remotion composition expects that file so narration stays synchronized with the 82-second timeline.

## 4. Preview the Remotion master

```bash
npm run studio
```

Composition:

```text
SignalForgeDemo
1920 × 1080
30 fps
82 seconds
```

## 5. Render

```bash
npm run render
```

Output:

```text
renders/signalforge-demo.mp4
```

Cover still:

```bash
npm run still
```

## HyperFrames opener

The optional HTML-native opener lives at:

```text
hyperframes/index.html
```

Preview:

```bash
npm run hyperframes:preview
```

Render:

```bash
npm run hyperframes:render
```

HyperFrames is useful here because the opener is a small, deterministic, code-authored motion composition. The main product sequence stays in Remotion because the final edit needs predictable scene timing, real product captures, captions, narration and export control.

## Final review checklist

Before publishing the MP4:

- recapture the public runtime after any product change;
- confirm `/health.commit` matches X-Agent verification;
- confirm `/judge/` remains absent from the public product;
- confirm the video contains no internal research/process labels;
- confirm every product screenshot comes from the public runtime;
- confirm no frame implies trade execution authority;
- confirm the final runtime is within the hackathon video limit;
- watch the exported MP4, not only the Studio preview.

## Files intentionally not committed

Generated captures, narration binaries, render outputs and local dependency folders are excluded from Git. They are reproducible build artifacts, not source-of-truth product files.
