/** Business-rule violation with a user-safe message. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/** Map any thrown value to a user-safe message for an ActionResult. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return "Something went wrong. Please try again.";
}
