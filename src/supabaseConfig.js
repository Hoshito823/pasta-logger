// Supabase Dashboard URL for manual resume
// Replace <PROJECT_REF> with your actual Supabase project reference
export const SUPABASE_DASHBOARD_URL = `https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1] || 'YOUR_PROJECT_REF'}`

/**
 * Check if error indicates Supabase is paused or unreachable
 * @param {Object} error - Error object from Supabase query
 * @returns {boolean} - True if error suggests pause/connection issue
 */
export function isSupabasePauseError(error) {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || ''
  const errorCode = error.code?.toLowerCase() || ''

  // Check for common pause/connection error patterns
  const pauseIndicators = [
    'fetch failed',
    'failed to fetch',
    'network error',
    'networkerror',
    '503',
    'service unavailable',
    'connect econnrefused',
    'econnrefused',
    'timeout',
    'could not connect'
  ]

  return pauseIndicators.some(indicator =>
    errorMessage.includes(indicator) || errorCode.includes(indicator)
  )
}

/**
 * Execute Supabase query with error detection
 * @param {Promise} queryPromise - Supabase query promise
 * @returns {Object} - { data, error, isPaused }
 */
export async function executeWithPauseDetection(queryPromise) {
  try {
    const result = await queryPromise
    const isPaused = isSupabasePauseError(result.error)
    return { ...result, isPaused }
  } catch (error) {
    const isPaused = isSupabasePauseError(error)
    return { data: null, error, isPaused }
  }
}
