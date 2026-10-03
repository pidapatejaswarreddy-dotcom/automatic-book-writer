import 'dotenv/config';
import { createApp } from './backend/app.js';
import { getAI } from './ai/index.js';
import { log } from './backend/logger.js';

const port = Number(process.env.PORT) || 3000;
const { app } = createApp();
const ai = getAI();
app.listen(port, () => {
  log.info(`Automatic Book Writer running at http://localhost:${port}`);
  if (ai.demo) log.warn('DEMO MODE: no AI_API_KEY configured — using built-in sample content. See README to enable a real AI provider.');
  else log.info(`AI provider: ${ai.provider} (${ai.model})`);
});
