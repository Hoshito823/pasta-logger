import { SUPABASE_DASHBOARD_URL } from './supabaseConfig.js'

/**
 * Show pause notification in a container
 * @param {string|HTMLElement} container - Container selector or element
 * @param {string} message - Optional custom message
 */
export function showPauseNotification(container, message = 'データベースが一時停止している可能性があります') {
  const element = typeof container === 'string' ? document.querySelector(container) : container
  if (!element) return

  element.innerHTML = `
    <div class="card bg-yellow-50 border-2 border-yellow-400 p-6 text-center space-y-4">
      <div class="text-xl">⚠️</div>
      <div class="font-semibold text-gray-900">${message}</div>
      <div class="text-sm text-gray-600">
        Supabase Free プランでは、一定期間アクセスがないとデータベースが自動停止します。<br>
        以下のボタンから Dashboard にアクセスして再開してください。
      </div>
      <button id="resumeSupabaseBtn" class="btn btn-primary px-6 py-3">
        Supabase を再開する
      </button>
    </div>
  `

  // Add event listener for resume button
  const resumeBtn = element.querySelector('#resumeSupabaseBtn')
  if (resumeBtn) {
    resumeBtn.onclick = () => {
      window.open(SUPABASE_DASHBOARD_URL, '_blank')
    }
  }
}

/**
 * Show inline pause notification (for smaller spaces)
 * @param {string|HTMLElement} container - Container selector or element
 */
export function showInlinePauseNotification(container) {
  const element = typeof container === 'string' ? document.querySelector(container) : container
  if (!element) return

  element.innerHTML = `
    <div class="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-400 rounded-lg">
      <span class="text-2xl">⚠️</span>
      <div class="flex-1">
        <div class="font-semibold text-sm">データベースが停止している可能性があります</div>
        <button class="text-xs text-blue-600 underline hover:text-blue-800" onclick="window.open('${SUPABASE_DASHBOARD_URL}', '_blank')">
          Supabase Dashboard で再開
        </button>
      </div>
    </div>
  `
}

/**
 * Clear pause notification
 * @param {string|HTMLElement} container - Container selector or element
 */
export function clearPauseNotification(container) {
  const element = typeof container === 'string' ? document.querySelector(container) : container
  if (element) {
    element.innerHTML = ''
  }
}
