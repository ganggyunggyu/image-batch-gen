# AGENT.md

## Repo Summary
- Node + TypeScript (ESM), scripts executed via tsx.
- Entry points: `src/single.ts`, `src/batch.ts`.
- Uses `input/` for source images and prompt, `output/` for results.

## Key Scripts
- `npm run single`
- `npm run batch`
- `./node_modules/.bin/tsc --noEmit`

## Conventions
- Put shared IO/prompt/env utilities in `src/shared/`.
- Keep functions small and typed.
- Avoid running batch/single without `GEMINI_API_KEY` and input images.
