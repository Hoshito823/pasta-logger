import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'
import { isSupabasePauseError } from './supabaseConfig.js'
import { showInlinePauseNotification, clearPauseNotification } from './pauseNotification.js'

const $ = (s) => document.querySelector(s)

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

// 統計データの読み込み
async function loadStats() {
  try {
    // カテゴリ数を取得
    const { count: categoryCount, error: categoryError } = await supa
      .from('recipes')
      .select('*', { count: 'exact', head: true })

    if (categoryError) {
      if (isSupabasePauseError(categoryError)) {
        // Show pause notification in stats section
        const statsSection = $('#categoryCount')?.parentElement?.parentElement
        if (statsSection) {
          statsSection.innerHTML = ''
          showInlinePauseNotification(statsSection)
        }
        return
      }
      throw categoryError
    }

    // パスタ種類数を取得
    const { count: pastaCount, error: pastaError } = await supa
      .from('pasta_kinds')
      .select('*', { count: 'exact', head: true })

    if (pastaError) {
      throw pastaError
    }

    // チーズ種類数を取得
    const { count: cheeseCount, error: cheeseError } = await supa
      .from('cheeses')
      .select('*', { count: 'exact', head: true })

    if (cheeseError) {
      throw cheeseError
    }

    // 統計表示を更新
    $('#categoryCount').textContent = categoryCount || 0
    $('#pastaCount').textContent = pastaCount || 0
    $('#cheeseCount').textContent = cheeseCount || 0
  } catch (error) {
    console.error('統計読み込みエラー:', error)
  }
}

// 初期読み込み
loadStats()