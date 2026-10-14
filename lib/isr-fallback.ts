export const ISR_BUILD_FALLBACK_ENV = 'WCASH_ALLOW_BUILD_UPSTREAM_FALLBACK';

export function isIsrBuildFallbackEnabled(): boolean {
  return process.env[ISR_BUILD_FALLBACK_ENV] === '1';
}

function isNextProductionBuild(): boolean {
  // Next runs server components once during `next build`. There is no chain
  // service available in that phase in the container build, so rendering a
  // truthful empty shell is safer than making the image build depend on a
  // live API or silently pulling foreign upstream data. ISR will hydrate the
  // page from the configured W.cash API after startup.
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Return an explicit build-only shell in offline CI. Everywhere else, surface
 * the upstream failure so Next keeps the last successful ISR entry instead of
 * replacing it with an empty or unknown render.
 */
export function retainLastGoodOrBuildFallback<T>(
  fallback: T,
  error: unknown,
  context: string,
): T {
  if (isIsrBuildFallbackEnabled() || isNextProductionBuild()) return fallback;
  if (error instanceof Error) {
    if (error instanceof DOMException) {
      throw new Error(`${context}: ${error.message}`, { cause: error });
    }
    throw error;
  }
  throw new Error(`${context} is unavailable`, { cause: error });
}
