/** API error with an HTTP status and a stable code. Kept dependency-free so
 *  pure modules (validation, ranks) also run in the browser demo. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "error"
  ) {
    super(message);
  }
}
