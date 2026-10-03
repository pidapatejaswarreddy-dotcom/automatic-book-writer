# Automatic Book Writer

An AI-powered web application that writes a complete book chapter by chapter: enter a topic, choose a book type and preferences, review the outline, and download the finished book as **PDF**, **DOCX** or **TXT**.

> This is a **standalone project**. It shares no code, database, API, authentication, configuration or deployment with any other application.

## Features

- **8-step guided workflow**: Information → Book Type → Settings → Outline → Generate → Review → Preview → Download, with a progress indicator on every screen.
- **8 book types with separate writing logic**: Educational, Mathematics, Technical, Novel, Short Stories, Self-Help, Biography, Business. Each template defines its structure, chapter rules, example rules, diagram rules, exercise rules and formatting (see `templates/`). The chapter prompt is different for every type.
- **Languages**: English, Telugu, Tamil, Hindi, Kannada, Malayalam (registry in `config/languages.js`; PDF export embeds Noto fonts for Indic scripts).
- **Topic analysis** → **outline generation** → **outline editor** (rename / add / delete / reorder chapters and sections, drag-and-drop, regenerate, save). The book is never generated before you approve the outline.
- **Content planner**: requested pages → reserved front matter → usable pages → per-chapter pages → words → sections, examples, diagrams and exercises. Large page targets are met with deeper sections, not padding. Page count is treated as a *target*.
- **Chapter-by-chapter generation** (section by section) with a persistent **book context** (summaries, terms, facts, formulas, characters, locations, events) to keep chapters consistent. Progress is saved after every section; you can stop, resume or retry.
- **Examples, solved sums and exercises** chosen by book type (worked problems with Given / Formula / Solution / Answer, code with output, case studies, action plans).
- **Diagrams only where they help**: flowchart, process, block, architecture, cycle, timeline, comparison, hierarchy and concept map. Drawn as SVG in the browser, vector graphics in the PDF, editable tables in DOCX, and ASCII art in TXT, always with numbered captions (Figure 1.1).
- **Content validation**: grammar/spacing, repetition, missing sections, outline coverage, topic relevance, broken references, formatting, code blocks and terminology (technical), character/location/plot continuity (fiction), with **Fix Automatically / Review Manually / Ignore**.
- **Book editor** with per-section editing, autosave, formatted preview and AI actions: Improve, Rewrite, Expand, Shorten, Simplify, Make Professional, Fix Grammar, Regenerate Section (with Undo).
- **Cover** (4 styles), **title page**, **table of contents with real page numbers**, running headers and page numbers.
- **Book preview** with paged view, next/previous, zoom and chapter navigation.
- **Dashboard**: search, open, continue editing, rename, delete, download. Book status: Draft → Outline Ready → Generating → Generated → Editing → Completed.
- **Demo mode** when no API key is configured (built-in sample content, clearly labelled in the UI).
- Friendly error messages everywhere; developers get structured JSON logs on the server.

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 18.17+ (developed on 22) |
| Backend | Express 4 (ES modules) |
| Frontend | Vanilla JavaScript ES modules, no build step, no framework |
| Storage | JSON file per book (`data/books/<id>.json`); swap adapter in `database/store.js` |
| AI | Provider-agnostic service layer: Anthropic (default), OpenAI-compatible APIs, or built-in demo provider |
| PDF | PDFKit (vector drawing, embedded Noto fonts for Indic scripts) |
| DOCX | `docx` library |
| Tests | Node's built-in test runner (`node --test`), plus a jsdom UI smoke test |

## Installation

```bash
unzip automatic-book-writer.zip
cd automatic-book-writer
npm install
cp .env.example .env      # optional: works without it in demo mode
npm start                 # http://localhost:3000
```

## Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Where books are stored |
| `AI_PROVIDER` | `anthropic` | `anthropic` or `openai` (any OpenAI-compatible API) |
| `AI_API_KEY` | *(empty)* | Empty = **demo mode**. Never commit this. Server-side only; never sent to the browser. |
| `AI_MODEL` | provider default | Override the model name |
| `AI_BASE_URL` | provider default | Custom endpoint (proxy, Azure, local OpenAI-compatible server) |
| `AI_REASONING_EFFORT` | *(empty)* | Optional, for Gemini/OpenAI reasoning models (e.g. `none`, `low`) |
| `AI_MAX_RETRIES`, `AI_TIMEOUT_MS` | `2`, `120000` | Retry/timeout tuning for provider calls |

## AI API setup

**Google Gemini:** get a key at Google AI Studio, then set `AI_PROVIDER=openai`, `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `AI_MODEL=gemini-2.5-flash` and `AI_API_KEY=<your key>` (see `.env.example`).

1. Create an API key with your provider.
2. Put it in `.env`: `AI_API_KEY=...` (and `AI_PROVIDER=openai` plus `AI_MODEL=` if not using Anthropic).
3. Restart. The start-up log says `AI provider: ...` instead of `DEMO MODE`.

The rest of the app only talks to `ai/index.js` (`analyzeTopic`, `generateOutline`, `generateChapter` / `generateSection`, `generateExamples`, `generateQuestions`, `summarizeChapter`, `checkContent`, `improveContent`). To add a provider, create `ai/providers/<name>.js` exposing `complete({ system, prompt, maxTokens })` and register it in `ai/index.js`. All prompts live in `ai/prompts.js`; type-specific behaviour lives in `templates/`.

## Database setup

None. Books are stored as JSON files in `DATA_DIR`. Each book document contains the settings, outline, plan, context, and its `chapters[]`, each with `sections[]` (title, content, order), which maps directly onto the Books / Chapters / Sections / Settings model in the specification. To move to SQL, implement `list/get/create/update/remove` in `database/store.js`.

## Development

```bash
npm run dev          # restarts on change
npm test             # 56 unit/integration tests (demo mode, no network)
npm run test:ui      # jsdom smoke test of the whole wizard
```

## Production build

There is no build step. Run `NODE_ENV=production npm start` behind a reverse proxy (HTTPS recommended). Persist `DATA_DIR` on a volume. The app has no user accounts, so put it behind your own authentication if it is exposed to the internet.

## Export system

- **PDF** (`exporters/pdf.js`): 6 × 9 in trade layout. Rendered in **two passes** so the table of contents shows the real page number of every chapter. Vector diagrams, tinted callout boxes, tables, code blocks, running headers and page numbers. Indic scripts use embedded Noto Sans fonts with correct shaping.
- **DOCX** (`exporters/docx.js`): real Word Heading 1/2/3 styles, native tables, bullet/number lists, headers/footers with page numbers, diagrams as editable tables. The TOC page numbers mirror the PDF layout (same page size, fonts and margins); if you edit heavily in Word, use *References → Table of Contents* to refresh it from the headings.
- **TXT** (`exporters/txt.js`): wrapped at 80 columns, ASCII diagrams, boxes as labelled blocks.
- All three build from one neutral document model (`exporters/model.js`). Add a format (EPUB, Markdown, HTML) by adding an exporter and one line in `exporters/index.js`.

## Content markup

Generated and edited text uses a small markup: `### Sub-heading`, `- bullets`, `1. numbers`, `**bold**`, `*italic*`, fenced code, pipe tables, `$$formula$$`, `> quote`, `:::example Title … :::` boxes (kinds: example, keypoints, note, exercise, answer, summary, case), and `[[FIGURE: type | Caption | node; node; node]]` for diagrams.

## Project structure

```
server.js            entry point
backend/             Express app, routes, services (workflow, generation jobs), validation, logging
ai/                  AI service layer, prompts, providers, planner, book context, validator, demo provider
templates/           one file per book type (+ registry)
exporters/           model, pdf, docx, txt, fonts
shared/              code used by both server and browser (content parser, diagram engine, covers)
config/              languages and option lists
database/            storage adapter
public/              frontend (index.html, css, js/views)
tests/               automated tests
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Demo mode" banner | Set `AI_API_KEY` in `.env` and restart. |
| "Something went wrong while generating…" | Press **Try Again**; finished chapters are kept. Check the server log (JSON lines) for the cause: invalid key, rate limit, network. |
| Generation stopped after restarting the server | It resumes as *Paused*; press **Resume**. |
| Telugu/Tamil/… text shows as boxes | Run `npm install` again so the `@fontsource/noto-sans-*` packages are present. |
| DOCX TOC page numbers differ from Word | Word paginates slightly differently; refresh the TOC in Word (References → Table of Contents). |
| Port already in use | Set `PORT=3001`. |
| Cannot reach the server | Make sure `npm start` is running and you opened the same port. |

## Known limits

- Demo mode content is generic sample text. Use a real provider for real books, and verify facts, especially for biographies and references.
- The in-browser preview approximates the PDF layout; the PDF is the reference for pagination.
- No user accounts or multi-user access control.
