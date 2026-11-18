# Parlons Voice Beta

## Local preview
Open `index.html` in Chrome or Edge. Microphone recognition may require an HTTPS origin or localhost, depending on browser.

## Private preview deployment
Upload `index.html` to a static host such as Netlify Drop or Vercel. Use the HTTPS URL and allow microphone access. Test microphone, auto-turn detection, and TTS in your target browser.

## IMPORTANT: API security
This is a **personal prototype**. It calls the model API directly from the browser, so the user's API key is visible to the browser and could be exposed. Do not distribute API keys, hardcode a key in the HTML, or release this as a public multi-user service. Some APIs block cross-origin browser calls.

For public deployment, add a server-side API proxy with environment-secret storage, authentication, quotas/rate limiting, and cost controls. This package does NOT include that backend. The app has not been end-to-end tested with a live API or a microphone.

## Known limitations
- Browser speech recognition may stop on pauses or fail on some platforms.
- Voice output uses the device's speech synthesis, not streaming audio from the model.
- Reports are model-generated and may contain errors; pronunciation cannot be scored from transcripts.
- The included demo mode is scripted, not a real model.
