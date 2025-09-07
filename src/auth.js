import { supa } from './supa.js'

export async function initAuthUI(rootSel = '#auth') {
  const root = document.querySelector(rootSel)
  const { data: { session } } = await supa.auth.getSession()

  if (session) {
    root.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600">ログイン中: ${session.user.email}</span>
        <button id="logoutBtn" class="btn">ログアウト</button>
      </div>`
    document.getElementById('logoutBtn').onclick = async () => {
      await supa.auth.signOut()
      location.reload()
    }
  } else {
    root.innerHTML = `
      <form id="loginForm" class="card space-y-2">
        <label class="label">メールアドレス</label>
        <input type="email" id="email" class="input" placeholder="you@example.com" required />
        <button class="btn btn-primary w-full">Magic Linkを送る</button>
        <small class="text-gray-500">メールのリンクを踏むとログイン状態になります</small>
      </form>`
    const form = document.getElementById('loginForm')
    form.onsubmit = async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value
      const { error } = await supa.auth.signInWithOtp({
        email, options: { emailRedirectTo: location.origin }
      })
      if (error) alert(error.message)
      else alert('メールを確認してください')
    }
  }
}
