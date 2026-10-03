// Developer-facing logging. Users only ever see friendly messages; details go here.
const line = (level, msg, meta) => console[level === 'error' ? 'error' : 'log'](JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta instanceof Error ? { error: meta.message, stack: meta.stack, cause: meta.cause?.message } : meta) }));
export const log = { info: (m, x) => line('info', m, x), warn: (m, x) => line('warn', m, x), error: (m, x) => line('error', m, x) };
