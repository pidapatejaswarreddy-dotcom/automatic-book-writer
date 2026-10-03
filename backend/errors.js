export class AppError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.userMessage = message; this.details = details; }
}
export const badRequest = (msg, details) => new AppError(400, 'INVALID_INPUT', msg, details);
export const notFound = (msg = 'That book could not be found.') => new AppError(404, 'NOT_FOUND', msg);
