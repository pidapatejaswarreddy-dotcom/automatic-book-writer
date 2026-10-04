// AI service layer.
// Everything the app needs from "an AI" goes through these methods.
//
// Automatic providers:
// 1. Groq
// 2. Cloudflare Workers AI
// 3. OpenRouter
// 4. NVIDIA
// 5. Cohere
// 6. Hugging Face
//
// Google is intentionally excluded from the automatic provider list
// because its current free-tier quota is exhausted.
//
// Automatic mode uses:
// - Provider rotation
// - Provider cooldowns
// - Automatic fallback
// - Permanent disabling for dead/invalid models
// - Rate-limit handling
// - Parallel-request friendly scheduling
//
// Legacy compatibility:
// AI_PROVIDER=anthropic + AI_API_KEY
// AI_PROVIDER=openai + AI_API_KEY

import { getTemplate } from '../templates/index.js';
import * as P from './prompts.js';

import {
  extractJson,
  normalizeOutline,
  parseSectionOutput
} from './parse.js';

import { contextForPrompt } from './context.js';
import { mock } from './mock/index.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { uid } from './planner.js';


export class AIError extends Error {

  constructor(message, cause) {

    super(message);

    this.name = 'AIError';

    this.cause = cause;
  }
}


/*
 * ========================================================
 * Helpers
 * ========================================================
 */

const KIND_FOR = {

  chapter: 'body',

  intro: 'intro',

  outro: 'outro',

  references: 'references'

};


const outlineText = (book) =>

  (book.chapters || [])

    .filter(
      (c) =>
        c.kind === 'chapter'
    )

    .map(
      (c) =>
        `${c.number}. ${c.title} [` +
        `${(c.sections || [])

          .filter(
            (s) =>
              !s.extra
          )

          .map(
            (s) =>
              s.title
          )

          .join('; ')}` +
        `]`
    )

    .join(' | ');


function cleanEnv(value) {

  return String(
    value || ''
  ).trim();
}


function isTrue(value) {

  return [

    '1',

    'true',

    'yes',

    'on'

  ].includes(

    String(
      value || ''
    )

      .trim()

      .toLowerCase()

  );
}


/*
 * ========================================================
 * OpenAI-compatible provider factory
 * ========================================================
 */

function makeOpenAICompatibleProvider({

  apiKey,

  model,

  baseUrl,

  providerName

}) {

  if (!apiKey) {

    throw new AIError(
      `${providerName} API key is not configured`
    );

  }


  if (!baseUrl) {

    throw new AIError(
      `${providerName} base URL is not configured`
    );

  }


  return openaiProvider({

    apiKey,

    model,

    baseUrl,

    providerName

  });

}


/*
 * ========================================================
 * CREATE AI SERVICE
 * ========================================================
 */

export function createAIService(
  env = process.env
) {

  const explicitProvider =
    cleanEnv(
      env.AI_PROVIDER
    ).toLowerCase();


  /*
   * ======================================================
   * Legacy API keys
   * ======================================================
   */

  const legacyKeys = [

    ...new Set(

      `${env.AI_API_KEYS || ''},${env.AI_API_KEY || ''}`

        .split(
          /[,;\s]+/
        )

        .map(
          (k) =>
            k.trim()
        )

        .filter(
          Boolean
        )

    )

  ];


  /*
   * ======================================================
   * Automatic provider configuration
   * ======================================================
   */

  const providerConfigs = {

    /*
     * ----------------------------------------------------
     * GROQ
     * ----------------------------------------------------
     */

    groq: {

      key:
        cleanEnv(
          env.GROQ_API_KEY
        ),

      model:
        cleanEnv(
          env.GROQ_MODEL
        ) ||
        'openai/gpt-oss-20b',

      baseUrl:
        cleanEnv(
          env.GROQ_BASE_URL
        ) ||
        'https://api.groq.com/openai/v1'

    },


    /*
     * ----------------------------------------------------
     * GOOGLE
     *
     * Kept here for compatibility, but NOT included
     * in automatic default order.
     * ----------------------------------------------------
     */

    google: {

      key:
        cleanEnv(
          env.GOOGLE_API_KEY
        ),

      model:
        cleanEnv(
          env.GOOGLE_MODEL
        ) ||
        'gemini-3.8-flash',

      baseUrl:
        cleanEnv(
          env.GOOGLE_BASE_URL
        ) ||
        'https://generativelanguage.googleapis.com/v1beta/openai'

    },


    /*
     * ----------------------------------------------------
     * CLOUDFLARE
     * ----------------------------------------------------
     */

    cloudflare: {

      key:
        cleanEnv(
          env.CLOUDFLARE_API_TOKEN
        ),

      model:
        cleanEnv(
          env.CLOUDFLARE_MODEL
        ) ||
        '@cf/openai/gpt-oss-20b',

      baseUrl:
        cleanEnv(
          env.CLOUDFLARE_BASE_URL
        ) ||
        (

          cleanEnv(
            env.CLOUDFLARE_ACCOUNT_ID
          )

            ? `https://api.cloudflare.com/client/v4/accounts/${cleanEnv(
                env.CLOUDFLARE_ACCOUNT_ID
              )}/ai/v1`

            : ''

        )

    },


    /*
     * ----------------------------------------------------
     * OPENROUTER
     * ----------------------------------------------------
     */

    openrouter: {

      key:
        cleanEnv(
          env.OPENROUTER_API_KEY
        ),

      model:
        cleanEnv(
          env.OPENROUTER_MODEL
        ) ||
        'nvidia/nemotron-3-ultra-550b-a55b:free',

      baseUrl:
        cleanEnv(
          env.OPENROUTER_BASE_URL
        ) ||
        'https://openrouter.ai/api/v1'

    },


    /*
     * ----------------------------------------------------
     * NVIDIA
     *
     * OLD:
     * meta/llama-3.1-8b-instruct
     *
     * NEW:
     * meta/llama-3.3-70b-instruct
     * ----------------------------------------------------
     */

    nvidia: {

      key:
        cleanEnv(
          env.NVIDIA_API_KEY
        ),

      model:
        cleanEnv(
          env.NVIDIA_MODEL
        ) ||
        'meta/llama-3.3-70b-instruct',

      baseUrl:
        cleanEnv(
          env.NVIDIA_BASE_URL
        ) ||
        'https://integrate.api.nvidia.com/v1'

    },


    /*
     * ----------------------------------------------------
     * COHERE
     * ----------------------------------------------------
     */

    cohere: {

      key:
        cleanEnv(
          env.COHERE_API_KEY
        ),

      model:
        cleanEnv(
          env.COHERE_MODEL
        ) ||
        'command-a-plus-05-2026',

      baseUrl:
        cleanEnv(
          env.COHERE_BASE_URL
        ) ||
        'https://api.cohere.ai/compatibility/v1'

    },


    /*
     * ----------------------------------------------------
     * HUGGING FACE
     * ----------------------------------------------------
     */

    huggingface: {

      key:
        cleanEnv(
          env.HUGGINGFACE_API_KEY
        ),

      model:
        cleanEnv(
          env.HUGGINGFACE_MODEL
        ) ||
        'Qwen/Qwen2.5-7B-Instruct',

      baseUrl:
        cleanEnv(
          env.HUGGINGFACE_BASE_URL
        ) ||
        'https://router.huggingface.co/v1'

    }

  };


  /*
   * ======================================================
   * PROVIDER ORDER
   * ======================================================
   *
   * User-defined AI_PROVIDER_1 ... AI_PROVIDER_20
   * is respected.
   *
   * IMPORTANT:
   * If the user explicitly configured Google, it can still
   * be included. Since your current .env does not contain
   * Google in the provider list, it will not be used.
   */

  const configuredOrder = [];


  for (
    let i = 1;
    i <= 20;
    i++
  ) {

    const name =
      cleanEnv(
        env[
          `AI_PROVIDER_${i}`
        ]
      ).toLowerCase();


    if (

      name &&

      providerConfigs[name] &&

      !configuredOrder.includes(
        name
      )

    ) {

      configuredOrder.push(
        name
      );

    }

  }


  /*
   * Google intentionally NOT in this default list.
   */

  const defaultOrder = [

    'groq',

    'cloudflare',

    'openrouter',

    'nvidia',

    'cohere',

    'huggingface'

  ];


  const providerOrder =

    configuredOrder.length > 0

      ? configuredOrder

      : defaultOrder;


  /*
   * Only providers with keys are actually available.
   */

  const availableProviders =

    providerOrder.filter(

      (name) =>

        Boolean(
          providerConfigs[name]?.key
        )

    );


  /*
   * ======================================================
   * LEGACY MODE DETECTION
   * ======================================================
   */

  const automaticKeysExist =

    availableProviders.length > 0;


  const explicitLegacyMode =

    (

      explicitProvider ===
        'anthropic' ||

      explicitProvider ===
        'openai'

    ) &&

    legacyKeys.length > 0;


  const implicitLegacyMode =

    !explicitProvider &&

    legacyKeys.length > 0 &&

    !automaticKeysExist;


  const useLegacy =

    explicitLegacyMode ||

    implicitLegacyMode;


  /*
   * ======================================================
   * LEGACY MODE
   * ======================================================
   */

  if (useLegacy) {

    const demo =

      legacyKeys.length === 0 ||

      isTrue(
        env.DEMO_MODE
      );


    const model =

      cleanEnv(
        env.AI_MODEL
      ) ||

      (

        explicitProvider ===
          'openai'

          ? 'gpt-4o-mini'

          : 'claude-sonnet-5-5'

      );


    const concurrency =

      Number(
        env.AI_CONCURRENCY
      ) ||

      Math.min(

        8,

        Math.max(

          2,

          legacyKeys.length * 2

        )

      );


    const queue = [];

    let active = 0;


    const pump = () => {

      while (

        active <
          concurrency &&

        queue.length

      ) {

        const job =
          queue.shift();


        active++;


        Promise.resolve()

          .then(
            job.fn
          )

          .then(
            job.res,
            job.rej
          )

          .finally(
            () => {

              active--;

              pump();

            }
          );

      }

    };


    const limit = (
      fn
    ) =>

      new Promise(

        (
          res,
          rej
        ) => {

          queue.push({

            fn,

            res,

            rej

          });


          pump();

        }

      );


    const call = async (

      book,

      prompt,

      maxTokens

    ) => {

      if (demo) {

        throw new AIError(
          'AI provider is not configured'
        );

      }


      let lastError =
        null;


      const retries =

        Number.isFinite(

          Number(
            env.AI_MAX_RETRIES
          )

        )

          ? Math.max(

              0,

              Number(
                env.AI_MAX_RETRIES
              )

            )

          : 3;


      for (

        let attempt = 0;

        attempt <= retries;

        attempt++

      ) {

        try {

          const provider =

            explicitProvider ===
              'openai'

              ? openaiProvider({

                  apiKey:

                    legacyKeys[

                      attempt %
                        legacyKeys.length

                    ],

                  model,

                  baseUrl:
                    env.AI_BASE_URL,

                  providerName:
                    'openai',

                  reasoningEffort:
                    env.AI_REASONING_EFFORT

                })

              : anthropicProvider({

                  apiKey:

                    legacyKeys[

                      attempt %
                        legacyKeys.length

                    ],

                  model,

                  baseUrl:
                    env.AI_BASE_URL

                });


          return await provider.complete({

            system:
              P.system(
                book
              ),

            prompt,

            maxTokens

          });


        } catch (e) {

          lastError =
            e;


          console.error(
            '[AI] legacy provider failed:',
            e?.message ||
            e
          );


          if (
            attempt < retries
          ) {

            continue;

          }


          throw new AIError(
            'AI request failed',
            e
          );

        }

      }


      throw new AIError(
        'AI request failed',
        lastError
      );

    };


    const tokensFor = (
      words
    ) =>

      Math.min(

        8000,

        Math.max(

          1200,

          Math.round(

            Number(
              words || 0
            ) *
              3 +
              800

          )

        )

      );


    const json = async (

      book,

      prompt,

      maxTokens = 3000

    ) => {

      const text =

        await call(

          book,

          prompt,

          maxTokens

        );


      try {

        return extractJson(
          text
        );

      } catch (e) {

        throw new AIError(

          'AI returned an unreadable response',

          e

        );

      }

    };


    return buildService({

      demo,

      providerName:

        demo

          ? 'demo'

          : explicitProvider ===
              'openai'

            ? 'openai'

            : 'anthropic',

      model:

        demo
          ? null
          : model,

      keys:
        legacyKeys.length,

      concurrency,

      limit,

      call,

      json,

      tokensFor

    });

  }


  /*
   * ======================================================
   * AUTOMATIC MULTI-PROVIDER MODE
   * ======================================================
   */

  const demo =

    availableProviders.length === 0 ||

    isTrue(
      env.DEMO_MODE
    );


  const concurrency =

    Math.max(

      1,

      Number(
        env.AI_CONCURRENCY
      ) || 3

    );


  const cooldownMs =

    Math.max(

      1000,

      Number(
        env.AI_PROVIDER_COOLDOWN_MS
      ) || 30000

    );


  const maxRetries =

    Math.max(

      0,

      Number.isFinite(

        Number(
          env.AI_MAX_RETRIES
        )

      )

        ? Number(
            env.AI_MAX_RETRIES
          )

        : 2

    );


  const timeoutMs =

    Math.max(

      1000,

      Number(
        env.AI_TIMEOUT_MS
      ) || 120000

    );


  /*
   * Provider state.
   */

  const state =
    new Map();


  for (
    const name of availableProviders
  ) {

    state.set(

      name,

      {

        failures: 0,

        cooldownUntil: 0,

        lastUsed: 0,

        permanentlyDisabled: false

      }

    );

  }


  let rotationIndex = 0;


  /*
   * ======================================================
   * PROVIDER SELECTION
   * ======================================================
   */

  const selectProvider = (

    excluded = new Set()

  ) => {

    const now =
      Date.now();


    if (
      availableProviders.length === 0
    ) {

      return null;

    }


    for (

      let offset = 0;

      offset <
        availableProviders.length;

      offset++

    ) {

      const index =

        (

          rotationIndex +

          offset

        ) %

        availableProviders.length;


      const name =

        availableProviders[index];


      if (
        excluded.has(name)
      ) {

        continue;

      }


      const s =
        state.get(name);


      if (!s) {

        continue;

      }


      if (
        s.permanentlyDisabled
      ) {

        continue;

      }


      if (
        s.cooldownUntil >
        now
      ) {

        continue;

      }


      rotationIndex =

        (

          index + 1

        ) %

        availableProviders.length;


      s.lastUsed =
        now;


      return name;

    }


    /*
     * If every provider is temporarily cooling down,
     * return null.
     *
     * We do NOT force a rate-limited/dead provider.
     */

    return null;

  };


  /*
   * ======================================================
   * SUCCESS
   * ======================================================
   */

  const markSuccess = (
    name
  ) => {

    const s =
      state.get(name);


    if (!s) {

      return;

    }


    s.failures = 0;

    s.cooldownUntil = 0;

  };


  /*
   * ======================================================
   * FAILURE / COOLDOWN
   * ======================================================
   */

  const markFailure = (

    name,

    error

  ) => {

    const s =
      state.get(name);


    if (!s) {

      return;

    }


    s.failures++;


    const status =

      Number(
        error?.status || 0
      );


    const message =

      String(

        error?.message ||

        error?.body ||

        ''

      );


    /*
     * ----------------------------------------------------
     * PERMANENT ERRORS
     *
     * 400
     * 401
     * 403
     * 404
     * 410
     *
     * Dead model / invalid model / bad credentials /
     * invalid endpoint should not be repeatedly retried.
     * ----------------------------------------------------
     */

    const permanent =

      status === 400 ||

      status === 401 ||

      status === 403 ||

      status === 404 ||

      status === 410 ||

      /model.*(not found|not available|end of life|deprecated)/i.test(
        message
      ) ||

      /invalid.*model/i.test(
        message
      );


    if (permanent) {

      s.permanentlyDisabled =
        true;


      /*
       * Effectively disabled for this server session.
       */

      s.cooldownUntil =

        Date.now() +

        24 * 60 * 60 * 1000;


      console.warn(

        `[AI] Permanently disabling ${name} for this server session.`

      );


      return;

    }


    /*
     * ----------------------------------------------------
     * RATE LIMIT / QUOTA
     * ----------------------------------------------------
     */

    const limited =

      status === 429 ||

      /rate.?limit|quota|too many requests|resource_exhausted/i.test(
        message
      );


    if (limited) {

      const retryAfter =

        Number(
          error?.retryAfterMs || 0
        );


      /*
       * Minimum 30 minutes.
       *
       * If provider tells us a longer retry-after,
       * respect it.
       */

      s.cooldownUntil =

        Date.now() +

        Math.max(

          retryAfter,

          30 * 60 * 1000

        );


      console.warn(

        `[AI] ${name} is rate-limited. Temporarily disabled.`

      );


      return;

    }


    /*
     * ----------------------------------------------------
     * TEMPORARY ERRORS
     * ----------------------------------------------------
     */

    s.cooldownUntil =

      Date.now() +

      Math.min(

        cooldownMs *

          Math.max(

            1,

            s.failures

          ),

        120000

      );

  };


  /*
   * ======================================================
   * SLEEP
   * ======================================================
   */

  const sleep = (
    ms
  ) =>

    new Promise(

      (resolve) =>

        setTimeout(

          resolve,

          Math.max(
            0,
            ms
          )

        )

    );


  /*
   * ======================================================
   * TIMEOUT
   * ======================================================
   */

  const withTimeout = async (

    promise,

    ms

  ) => {

    let timer;


    try {

      return await Promise.race([

        promise,


        new Promise(

          (

            _,

            reject

          ) => {

            timer =

              setTimeout(

                () => {

                  const error =
                    new Error(

                      `AI request timed out after ${ms} ms`

                    );


                  error.code =
                    'AI_TIMEOUT';


                  error.retryable =
                    true;


                  reject(
                    error
                  );

                },

                ms

              );

          }

        )

      ]);


    } finally {

      clearTimeout(
        timer
      );

    }

  };


  /*
   * ======================================================
   * CREATE PROVIDER
   * ======================================================
   */

  const createProvider = (
    name
  ) => {

    const cfg =
      providerConfigs[name];


    if (!cfg?.key) {

      throw new AIError(

        `${name} API key is not configured`

      );

    }


    if (!cfg.baseUrl) {

      throw new AIError(

        `${name} base URL is not configured`

      );

    }


    return makeOpenAICompatibleProvider({

      apiKey:
        cfg.key,

      model:
        cfg.model,

      baseUrl:
        cfg.baseUrl,

      providerName:
        name

    });

  };


  /*
   * ======================================================
   * GET CURRENT ACTIVE PROVIDERS
   * ======================================================
   */

  const activeProviderNames = () =>

    availableProviders.filter(

      (name) => {

        const s =
          state.get(name);


        if (!s) {

          return false;

        }


        if (
          s.permanentlyDisabled
        ) {

          return false;

        }


        if (
          s.cooldownUntil >
          Date.now()
        ) {

          return false;

        }


        return true;

      }

    );


  /*
   * ======================================================
   * AUTOMATIC PROVIDER CALL
   * ======================================================
   */

  const call = async (

    book,

    prompt,

    maxTokens

  ) => {

    if (demo) {

      throw new AIError(

        'AI provider is not configured'

      );

    }


    let lastError =
      null;


    const attempted =
      new Set();


    /*
     * ----------------------------------------------------
     * FIRST PASS
     *
     * Every available provider gets one chance.
     * ----------------------------------------------------
     */

    for (

      let pass = 0;

      pass <
        availableProviders.length;

      pass++

    ) {

      const providerName =

        selectProvider(
          attempted
        );


      if (!providerName) {

        break;

      }


      attempted.add(
        providerName
      );


      try {

        console.log(

          `[AI] Trying ${providerName} (${providerConfigs[providerName].model})`

        );


        const provider =

          createProvider(
            providerName
          );


        const result =

          await withTimeout(

            provider.complete({

              system:
                P.system(
                  book
                ),

              prompt,

              maxTokens

            }),

            timeoutMs

          );


        /*
         * SUCCESS
         */

        markSuccess(
          providerName
        );


        rotationIndex =

          (

            availableProviders.indexOf(
              providerName
            ) + 1

          ) %

          availableProviders.length;


        console.log(

          `[AI] ${providerName} succeeded`

        );


        return result;


      } catch (error) {

        /*
         * NEVER throw immediately.
         *
         * Always continue to the next provider.
         */

        lastError =
          error;


        const status =

          Number(
            error?.status || 0
          );


        console.error(

          `[AI] ${providerName} failed`

        );


        console.error(

          `       Status: ${status || 'unknown'}`

        );


        console.error(

          `       Error: ${error?.message || error}`

        );


        markFailure(

          providerName,

          error

        );


        /*
         * Continue automatically.
         */

        continue;

      }

    }


    /*
     * ----------------------------------------------------
     * SECOND PASS
     *
     * If every currently available provider failed,
     * wait briefly and try providers that are NOT
     * permanently disabled and NOT in long cooldown.
     *
     * We do NOT force dead/quota-exhausted providers.
     * ----------------------------------------------------
     */

    console.warn(

      '[AI] First provider pass failed. Starting final fallback pass...'

    );


    await sleep(
      500
    );


    const fallbackProviders =

      activeProviderNames();


    for (

      const providerName of
        fallbackProviders

    ) {

      if (
        attempted.has(
          providerName
        )
      ) {

        continue;

      }


      try {

        console.log(

          `[AI] Final fallback: ${providerName}`

        );


        const provider =

          createProvider(
            providerName
          );


        const result =

          await withTimeout(

            provider.complete({

              system:
                P.system(
                  book
                ),

              prompt,

              maxTokens

            }),

            timeoutMs

          );


        markSuccess(
          providerName
        );


        rotationIndex =

          (

            availableProviders.indexOf(
              providerName
            ) + 1

          ) %

          availableProviders.length;


        console.log(

          `[AI] Final fallback ${providerName} succeeded`

        );


        return result;


      } catch (error) {

        lastError =
          error;


        console.error(

          `[AI] Final fallback ${providerName} failed: ${error?.message || error}`

        );


        markFailure(

          providerName,

          error

        );


        continue;

      }

    }


    /*
     * ----------------------------------------------------
     * EVERYTHING FAILED
     * ----------------------------------------------------
     */

    throw new AIError(

      'All configured AI providers failed',

      lastError

    );

  };


  /*
   * ======================================================
   * CONCURRENCY LIMITER
   * ======================================================
   */

  const queue = [];

  let active = 0;


  const pump = () => {

    while (

      active <
        concurrency &&

      queue.length > 0

    ) {

      const job =
        queue.shift();


      active++;


      Promise.resolve()

        .then(
          job.fn
        )

        .then(
          job.resolve,
          job.reject
        )

        .finally(

          () => {

            active--;

            pump();

          }

        );

    }

  };


  const limit = (
    fn
  ) =>

    new Promise(

      (

        resolve,

        reject

      ) => {

        queue.push({

          fn,

          resolve,

          reject

        });


        pump();

      }

    );


  /*
   * ======================================================
   * TOKEN CALCULATION
   * ======================================================
   */

  const tokensFor = (
    words
  ) =>

    Math.min(

      8000,

      Math.max(

        1200,

        Math.round(

          Number(
            words || 0
          ) *

          3 +

          800

        )

      )

    );


  /*
   * ======================================================
   * JSON HELPER
   * ======================================================
   */

  const json = async (

    book,

    prompt,

    maxTokens = 3000

  ) => {

    const text =

      await call(

        book,

        prompt,

        maxTokens

      );


    try {

      return extractJson(
        text
      );


    } catch (e) {

      console.error(

        '[AI JSON] Could not parse response:',

        e?.message ||
        e

      );


      console.error(

        '[AI JSON] Raw response:',

        String(
          text || ''
        ).slice(
          0,
          1000
        )

      );


      throw new AIError(

        'AI returned an unreadable response',

        e

      );

    }

  };


  /*
   * ======================================================
   * RETURN AUTOMATIC SERVICE
   * ======================================================
   */

  return buildService({

    demo,

    providerName:
      demo
        ? 'demo'
        : 'automatic',

    model:
      demo
        ? null
        : availableProviders

            .map(

              (name) =>

                `${name}:${providerConfigs[name].model}`

            )

            .join(', '),

    keys:
      availableProviders.length,

    providers:
      availableProviders,

    concurrency,

    limit,

    call,

    json,

    tokensFor

  });

}


/*
 * ========================================================
 * SERVICE METHODS
 * ========================================================
 */

function buildService({

  demo,

  providerName,

  model,

  keys,

  providers = [],

  concurrency,

  limit,

  call,

  json,

  tokensFor

}) {

  const svc = {


    demo,


    providerName,


    model,


    keys,


    providers,


    concurrency,


    /*
     * ====================================================
     * TOPIC ANALYSIS
     * ====================================================
     */

    async analyzeTopic({

      book

    }) {

      const t =

        getTemplate(
          book.bookType
        );


      if (demo) {

        return mock.analysis({

          book,

          t

        });

      }


      const raw =

        await call(

          book,

          P.analysisPrompt(

            book,

            t

          ),

          3000

        );


      try {

        return extractJson(
          raw
        );

      } catch (e) {

        throw new AIError(

          'Topic analysis could not be parsed',

          e

        );

      }

    },


    /*
     * ====================================================
     * OUTLINE
     * ====================================================
     */

    async generateOutline({

      book,

      analysis

    }) {

      const t =

        getTemplate(
          book.bookType
        );


      if (demo) {

        return mock.outline({

          book,

          t

        });

      }


      const raw =

        await call(

          book,

          P.outlinePrompt(

            book,

            t,

            analysis

          ),

          3500

        );


      try {

        return normalizeOutline(

          raw,

          {

            template:
              t,

            topic:
              book.topic,

            targetChapters:
              book.targetChapters

          }

        );

      } catch (e) {

        throw new AIError(

          'Outline could not be built',

          e

        );

      }

    },


    /*
     * ====================================================
     * SECTION
     * ====================================================
     */

    async generateSection({

      book,

      chapter,

      section,

      kind,

      context

    }) {

      const t =

        getTemplate(
          book.bookType
        );


      if (demo) {

        return mock.section({

          book,

          t,

          chapter,

          section,

          kind,

          ctx:
            context

        });

      }


      const words =

        kind === 'body' ||

        kind === 'intro' ||

        kind === 'outro'

          ? section.targetWords

          : 400;


      const text =

        await call(

          book,

          P.sectionPrompt(

            book,

            t,

            chapter,

            section,

            kind,

            contextForPrompt(

              context,

              outlineText(
                book
              )

            )

          ),

          tokensFor(
            words
          )

        );


      console.log(

        '[AI SECTION] Raw response:',

        String(
          text || ''
        ).slice(
          0,
          1000
        )

      );


      const {

        content,

        meta

      } =

        parseSectionOutput(
          text
        );


      if (!content) {

        throw new AIError(

          'Empty section returned'

        );

      }


      return {

        content,

        meta:
          meta || {}

      };

    },


    /*
     * ====================================================
     * EXAMPLES
     * ====================================================
     */

    generateExamples(
      args
    ) {

      return svc.generateSection({

        ...args,

        kind:
          'examples'

      });

    },


    /*
     * ====================================================
     * QUESTIONS
     * ====================================================
     */

    generateQuestions(
      args
    ) {

      return svc.generateSection({

        ...args,

        kind:
          'exercises'

      });

    },


    /*
     * ====================================================
     * CHAPTER GENERATION
     * ====================================================
 */

    async generateChapter({

      book,

      chapter,

      context,

      onSection,

      shouldStop

    }) {

      const t =

        getTemplate(
          book.bookType
        );


      const bodyKind =

        KIND_FOR[
          chapter.kind
        ];


      const collected = {

        terms: [],

        facts: [],

        formulas: [],

        characters: [],

        locations: [],

        events: []

      };


      const merge = (

        m = {}

      ) => {

        Object.keys(
          collected
        ).forEach(

          (k) => {

            if (

              Array.isArray(
                m[k]
              )

            ) {

              collected[k].push(
                ...m[k]
              );

            }

          }

        );

      };


      const chapterCtx = {

        ...chapter,

        sections:

          (

            chapter.sections ||

            []

          )

            .filter(

              (s) =>
                !s.extra

            )

      };


      const tasks =

        chapterCtx.sections

          .filter(

            (s) =>
              !s.done

          )

          .map(

            (s) => ({

              section:
                s,

              kind:
                bodyKind

            })

          );


      const ex =
        t.extras || {};


      /*
       * ==================================================
       * CHAPTER EXTRAS
       * ==================================================
       */

      if (

        chapter.kind ===
        'chapter'

      ) {

        const has = (
          k
        ) =>

          (

            chapter.sections ||

            []

          ).some(

            (s) =>
              s.extra === k

          );


        /*
         * Examples
         */

        if (

          ex.examples &&

          chapter.examples &&

          !has(
            'examples'
          )

        ) {

          tasks.push({

            extra:
              'examples',

            kind:
              'examples',

            section: {

              id:
                uid(
                  's'
                ),

              title:
                ex.examples.heading,

              targetWords:
                200

            }

          });

        }


        /*
         * Exercises
         */

        if (

          ex.exercises &&

          chapter.exercises &&

          !has(
            'exercises'
          )

        ) {

          tasks.push({

            extra:
              'exercises',

            kind:
              'exercises',

            section: {

              id:
                uid(
                  's'
                ),

              title:
                ex.exercises.heading,

              targetWords:
                200

            }

          });

        }


        /*
         * Summary
         */

        if (

          ex.summary &&

          chapter.summary &&

          !has(
            'summary'
          )

        ) {

          tasks.push({

            extra:
              'summary',

            kind:
              'summary',

            section: {

              id:
                uid(
                  's'
                ),

              title:
                ex.summary.heading,

              targetWords:
                200

            }

          });

        }

      }


      let stopped =
        false;


      /*
       * ==================================================
       * GENERATE ALL CHAPTER SECTIONS
       * ==================================================
       *
       * Promise.allSettled means one failed section
       * does NOT destroy all successful sections.
       */

      const results =

        await Promise.allSettled(

          tasks.map(

            (j) =>

              limit(

                async () => {

                  if (
                    shouldStop?.()
                  ) {

                    stopped =
                      true;

                    return;

                  }


                  const r =

                    await svc.generateSection({

                      book,

                      chapter:
                        chapterCtx,

                      section:
                        j.section,

                      kind:
                        j.kind,

                      context

                    });


                  merge(
                    r.meta
                  );


                  await onSection(

                    j.extra

                      ? {

                          id:
                            j.section.id,

                          title:
                            j.section.title,

                          content:
                            r.content,

                          extra:
                            j.extra,

                          isNew:
                            true

                        }

                      : {

                          id:
                            j.section.id,

                          content:
                            r.content

                        }

                  );

                }

              )

          )

        );


      /*
       * ==================================================
       * FAILED SECTION REPORTING
       * ==================================================
       *
       * IMPORTANT:
       * Do NOT throw here.
       *
       * The successful sections remain in the book.
       */

      const failures =

        results.filter(

          (r) =>
            r.status ===
            'rejected'

        );


      if (
        failures.length > 0
      ) {

        console.warn(

          `[AI] ${failures.length} section(s) could not be generated.`

        );


        failures.forEach(

          (failure) => {

            console.error(

              '[AI] Section generation failed:',

              failure.reason?.message ||

              failure.reason

            );

          }

        );

      }


      return {

        stopped,

        meta:
          collected,

        failedSections:
          failures.length

      };

    },


    /*
     * ====================================================
     * CHAPTER SUMMARY
     * ====================================================
     */

    async summarizeChapter({

      book,

      chapter

    }) {

      const text =

        (

          chapter.sections ||

          []

        )

          .map(

            (s) =>
              s.content

          )

          .join(
            '\n\n'
          );


      if (demo) {

        return mock.summarize({

          chapter,

          text

        });

      }


      try {

        return await json(

          book,

          P.summaryPrompt(

            book,

            chapter,

            text

          ),

          800

        );


      } catch {

        return await mock.summarize({

          chapter,

          text

        });

      }

    },


    /*
     * ====================================================
     * CONTENT CHECK
     * ====================================================
     */

    async checkContent({

      book,

      text

    }) {

      if (demo) {

        console.log(

          '[AI CHECK] Demo mode - no AI check performed'

        );

        return [];

      }


      try {

        const r =

          await json(

            book,

            P.checkPrompt(

              book,

              text

            ),

            1500

          );


        if (!r) {

          console.error(

            '[AI CHECK] Empty response received'

          );

          return [];

        }


        if (

          !Array.isArray(
            r.issues
          )

        ) {

          console.error(

            '[AI CHECK] Invalid response:',

            r

          );

          return [];

        }


        const issues =

          r.issues

            .filter(

              (issue) =>

                issue &&

                typeof issue ===
                  'object'

            )

            .map(

              (issue) => ({

                category:

                  String(

                    issue.category ||

                    'needs_verification'

                  ),

                severity:

                  String(

                    issue.severity ||

                    'medium'

                  ),

                message:

                  String(

                    issue.message ||

                    'Possible issue detected.'

                  ),

                find:

                  String(

                    issue.find ||

                    ''

                  ),

                replace:

                  String(

                    issue.replace ||

                    ''

                  )

              })

            );


        console.log(

          `[AI CHECK] ${issues.length} issue(s) found`

        );


        return issues;


      } catch (error) {

        console.error(

          '[AI CHECK] Failed:',

          error?.message ||
          error

        );


        return [];

      }

    },


    /*
     * ====================================================
     * IMPROVE CONTENT
     * ====================================================
     */

    async improveContent({

      book,

      action,

      text

    }) {

      if (demo) {

        return mock.improve(

          action,

          text

        );

      }


      const wordCount =

        String(
          text || ''
        )

          .split(
            /\s+/
          )

          .filter(
            Boolean
          )

          .length;


      const out =

        await call(

          book,

          P.improvePrompt(

            book,

            action,

            text

          ),

          tokensFor(

            wordCount * 1.6

          )

        );


      if (

        !out?.trim()

      ) {

        throw new AIError(

          'Empty revision'

        );

      }


      return out.trim();

    }

  };


  return svc;

}


/*
 * ========================================================
 * SINGLETON
 * ========================================================
 */

let singleton;


export const getAI = () =>

  (

    singleton ||=

      createAIService()

  );


export const resetAI = () => {

  singleton =
    undefined;

};