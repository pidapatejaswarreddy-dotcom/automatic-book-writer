import 'dotenv/config';
import { createApp } from './backend/app.js';
import { getAI } from './ai/index.js';
import { log } from './backend/logger.js';

// --------------------------------------------------
// AI PROVIDER CONFIGURATION
// Google is temporarily disabled because its quota
// is exhausted. The AI system will use fallback
// providers instead.
// --------------------------------------------------

process.env.AI_PROVIDER_MODE = 'automatic';

process.env.AI_PROVIDER_1 = 'groq';
process.env.AI_PROVIDER_2 = 'cloudflare';
process.env.AI_PROVIDER_3 = 'openrouter';
process.env.AI_PROVIDER_4 = 'nvidia';
process.env.AI_PROVIDER_5 = 'cohere';
process.env.AI_PROVIDER_6 = 'huggingface';

// Completely remove Google from provider configuration
delete process.env.AI_PROVIDER_7;
delete process.env.AI_PROVIDER_8;
delete process.env.AI_PROVIDER_9;
delete process.env.AI_PROVIDER_10;

process.env.AI_CONCURRENCY =
  process.env.AI_CONCURRENCY || '3';

process.env.AI_TIMEOUT_MS =
  process.env.AI_TIMEOUT_MS || '120000';

process.env.AI_MAX_RETRIES =
  process.env.AI_MAX_RETRIES || '2';

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const port =
  Number(process.env.PORT) || 3000;

const { app } = createApp();

const ai = getAI();

app.listen(port, () => {

  log.info(
    `Automatic Book Writer running at http://localhost:${port}`
  );

  if (ai.demo) {

    log.warn(
      'DEMO MODE: no AI_API_KEY configured — using built-in sample content. See README to enable a real AI provider.'
    );

  } else {

    log.info(
      `AI provider: ${ai.provider} (${ai.model})`
    );

  }
});