# Demo video review — November 17, 2026

The reviewed local publication artifact is `seance-kit-demo-publish.mp4`: **1:44.67**, 1920×1080, H.264 video and AAC mono audio. It is below the three-minute limit. It has not been uploaded or publicly published. The video and its checksum manifest remain local submission artifacts rather than repository binaries.

Final video SHA-256: `673c26a719d93cdcfc13b84ee3768603bac4b801a53a0da780ce0b4d470b431d`.

## Content and truthful scope

- Actual browser actions: template tabs; Archive sample import/read and rejected tag; Inbox sample import, full batch inspection, Allow and Undo (18→13→18).
- Real provider: the owner's existing deepseek-flash configuration performed an actual search and read. A separate explicit prompt requested `tag_conversation`; its approval was rejected and the model confirmed no change. No key/settings entry is captured. This does not certify other providers or endpoints.
- Actual Kiro captures: specs, steering, task-hook configuration and two observed MCP read results. The hook frame explicitly says configuration, not an execution log.
- Public fictional samples only. Demo sections remain labelled. Final approval controls are enlarged and visible; subtitles occupy a separate lower area. The end card shows the demo and repository URLs.
- Actual tab images were sampled at approximately 4 fps during awaited actions and encoded at 30 fps. Selected action ranges retain wall-clock timing, with edits and final holds; this is not native 30 fps footage or a one-take screen recording.

## Review and checks

The earlier screenshot-only 2:44.63 candidate was rejected and superseded. Review of the replacement covers representative frames from all 17 scenes and all 26 caption cues, including approval controls, rejection, Undo, Kiro text and the closing links.

Complete local Whisper base.en transcription matches the narration script after the equivalent number spelling “eighteen”/“18” is normalized. Captions were aligned to those word boundaries with 80 ms leading/140 ms trailing padding, bounded by scene changes and the next cue. The final subtitle render preserves the exact AAC payload that was transcribed. Full-file decoding and black-frame checks completed without error; the audio scan found no NaN/Inf samples and the decoded peak is below full scale.

This review combines frame inspection, full automated transcription and technical audio checks. It does not claim human listening, a complete uninterrupted real-time playback, or guaranteed pronunciation quality. Local logs, capture manifests, caption timing checks, source hashes and the final checksum are kept with the publication package. The owner still reviews the exact file before authorizing upload.

Independent reviewer inspected all caption contact sheets, extra real-approval frames from 62.5–65.5s, Kiro/closing links, scripts/ASR/timing/AAC identity and four-document diff. No publication-blocking finding. Not human listening or complete real-time playback.

## Repository verification

The documentation update was checked on Node 24.18.0 / pnpm 9.15.9, based on `20aede1`: `pnpm typecheck`, `pnpm lint`, `pnpm test` (342 passed), `pnpm build` and `pnpm e2e` (57 passed, including offline and axe paths) all completed successfully. The first sandboxed e2e attempt could not bind the local test server (`listen EPERM`); the authorized run with local server/browser access passed. These are local checks, not new hosted CI or production acceptance. No runtime code changed in this update.

## Asset and tool disclosure

- Narration: locally generated synthetic English voice `af_heart`, Kokoro-82M v1.0 by hexgrad, [Apache-2.0 model](https://huggingface.co/hexgrad/Kokoro-82M). It does not clone the owner's voice.
- Inference: [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), MIT. Model weights and software are not bundled with the video.
- Visuals: this project's actual browser interactions and Kiro evidence. Font glyphs are rasterized; font files are not distributed. No music or stock footage is used.
- Editing/technical checks: FFmpeg; local faster-whisper transcription. No audio was uploaded for transcription. Codex assisted capture, editing, narration generation and review; this is not claimed as Kiro-generated media.
- Earlier private system-voice drafts are superseded and excluded from the publication package.

## Remaining publication work

Owner review and explicit public-upload authorization; successful public YouTube upload; actual link in Devpost and the landing page; final personal/eligibility fields and owner acceptance of entry terms. No placeholder video link or completed submission is claimed.
