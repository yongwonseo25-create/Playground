# Security Architecture Note: HTTPS + WSS for Voxera

## Why HTTPS + WSS are mandatory

Voxera is designed for streaming voice interactions and future AudioWorklet-based processing.
For mobile browsers, stable microphone + low-latency stream behavior is tightly coupled to secure contexts.

- `AudioWorklet` and media-related APIs are significantly more reliable in secure contexts.
- `getUserMedia` and microphone permissions are secure-context sensitive.
- `wss://` protects command and transcript streams from interception or tampering.
- Aligning local development with HTTPS/WSS early prevents environment-specific regressions.

## Local-only insecure exception

A local-only exception is allowed for `ws://` and `http://` **only** when:

- `NEXT_PUBLIC_APP_ENV=local`
- target host is loopback (`localhost`, `127.0.0.1`, `[::1]`)

All non-local environments require:

- `NEXT_PUBLIC_WSS_URL` using `wss://`
- `NEXT_PUBLIC_WEBHOOK_URL` using `https://`

These rules are validated at startup and fail fast when violated.

## Backend contracts

Backend streaming and webhook contracts are still placeholders and intentionally not invented here.
Only URL transport constraints are enforced at this stage.
