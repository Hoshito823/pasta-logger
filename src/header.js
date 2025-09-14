// 共通ヘッダーコンポーネント
export function createHeader(currentPage = '') {
  return `
    <header class="sticky top-0 bg-white/70 backdrop-blur border-b">
      <nav class="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
        <a href="/" class="font-semibold">Pasta Logger</a>
        
        <!-- スマホ用メニューボタン -->
        <div class="flex items-center gap-2">
          <button id="themeToggle" class="btn p-2">🌓</button>
          <button id="menuToggle" class="btn p-2 md:hidden">☰</button>
        </div>
        
        <!-- デスクトップ用メニュー -->
        <div class="hidden md:flex items-center gap-3">
          <a href="/log-new.html" class="btn ${currentPage === 'new' ? 'btn-primary' : ''}">新規記録</a>
          <a href="/log-list.html" class="btn ${currentPage === 'list' ? 'btn-primary' : ''}">履歴</a>
          <a href="/manage.html" class="btn ${currentPage === 'manage' ? 'btn-primary' : ''}">管理</a>
        </div>
      </nav>
      
      <!-- スマホ用ドロップダウンメニュー -->
      <div id="mobileMenu" class="hidden bg-white border-t md:hidden">
        <div class="mx-auto max-w-3xl px-4 py-3 space-y-2">
          <a href="/log-new.html" class="block py-2 px-4 hover:bg-gray-50 rounded-lg ${currentPage === 'new' ? 'bg-blue-50' : ''}">📝 新規記録</a>
          <a href="/log-list.html" class="block py-2 px-4 hover:bg-gray-50 rounded-lg ${currentPage === 'list' ? 'bg-blue-50' : ''}">📋 履歴</a>
          <a href="/manage.html" class="block py-2 px-4 hover:bg-gray-50 rounded-lg ${currentPage === 'manage' ? 'bg-blue-50' : ''}">⚙️ 管理</a>
        </div>
      </div>
    </header>
  `
}

export function setupHeader() {
  const html = document.documentElement
  
  // テーマ切り替え
  const themeToggle = document.getElementById('themeToggle')
  if (themeToggle) {
    themeToggle.onclick = () => {
      html.classList.toggle('dark')
      localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light')
    }
  }
  if (localStorage.getItem('theme') === 'dark') html.classList.add('dark')
  
  // モバイルメニューの切り替え
  const menuToggle = document.getElementById('menuToggle')
  const mobileMenu = document.getElementById('mobileMenu')
  
  if (menuToggle && mobileMenu) {
    menuToggle.onclick = () => {
      mobileMenu.classList.toggle('hidden')
    }
    
    // メニュー外をクリックした時に閉じる
    document.addEventListener('click', (e) => {
      if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.add('hidden')
      }
    })
  }
}