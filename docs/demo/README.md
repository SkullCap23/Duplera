# Narrated walkthrough

Open [the narrated video](walkthrough.webm). It uses screenshots captured from the actual local application, Windows speech narration and visible subtitles. The workflow creates a synthetic invoice, analyses it, reserves/confirms financing, demonstrates a second lender's active conflict, verifies selected evidence, rejects tampering and restores history after reload. The synthetic financed claim is released after capture.

This is a guided screenshot walkthrough, not a recording of a human lender or a bank transaction. The browser uses a test-only wallet bridge to Hardhat. The real app still requires its user's injected wallet and signatures. The video is labelled as a local synthetic-data demonstration; no public-testnet deployment is implied.

An [accessible transcript](TRANSCRIPT.md) and [WebVTT captions](captions.vtt) accompany the video. The manifest records duration, resolution, capture provenance and scene narration. Narration is rendered locally to files and is not played during generation.

## Recreate on this Windows development setup

Start the local services and run `npm run doctor`. Chrome and an installed Windows speech voice are required. Install the small media remuxing tool once with `npx playwright install ffmpeg`, then run:

```powershell
npm run demo:capture
npm run demo:narrate
npm run demo:render
```

Capture/narration intermediates remain under ignored `.local/demo`; only the finished video, captions, transcript and provenance are placed here. `FFMPEG_PATH` can override the encoder/remuxer executable path. Browser media recording uses its built-in VP9/Opus implementation; the remuxer copies streams to add a seekable duration without re-encoding them.
