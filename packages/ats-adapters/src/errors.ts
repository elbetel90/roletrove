export const USER_AGENT =
  'Roletrove/1.0 (respectful crawler; contact: bot@roletrove.com)'

export class AtsHttpError extends Error {
  constructor(
    public readonly ats: string,
    public readonly status: number,
    public readonly token: string,
  ) {
    super(`[${ats}] HTTP ${status} fetching jobs for token "${token}"`)
    this.name = 'AtsHttpError'
  }
}

export class AtsParseError extends Error {
  constructor(
    public readonly ats: string,
    public readonly token: string,
    cause?: unknown,
  ) {
    super(`[${ats}] Failed to parse response for token "${token}"`)
    this.name = 'AtsParseError'
    if (cause) this.cause = cause
  }
}
