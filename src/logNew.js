import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'
import { v4 as uuidv4 } from 'uuid'

// 安全なセレクター関数
const $ = (s) => {
  try {
    const element = document.querySelector(s)
    if (!element) {
      console.warn(`⚠️ 要素が見つかりません: ${s}`)
    }
    return element
  } catch (error) {
    console.error(`❌ セレクターエラー: ${s}`, error)
    return null
  }
}
const marks = { B: null, U: null, C: null }

// 調理タイマー機能用変数
let processLogs = {}
let cookingTimer = null
let cookingStartTime = null
let processTimers = {} // 各工程の開始時刻を追跡
let displayTimers = {} // 各工程の表示タイマー

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

// 時間フォーマット関数
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTimeHHMM(date) {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}


// アラーム音の再生
function playAlarm() {
  // Web Audio API を使用してビープ音を生成
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
  oscillator.type = 'sine'
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)

  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.5)

  // 3回ビープ音を鳴らす
  setTimeout(() => {
    const oscillator2 = audioContext.createOscillator()
    const gainNode2 = audioContext.createGain()
    oscillator2.connect(gainNode2)
    gainNode2.connect(audioContext.destination)
    oscillator2.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator2.type = 'sine'
    gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime)
    oscillator2.start()
    oscillator2.stop(audioContext.currentTime + 0.5)
  }, 600)

  setTimeout(() => {
    const oscillator3 = audioContext.createOscillator()
    const gainNode3 = audioContext.createGain()
    oscillator3.connect(gainNode3)
    gainNode3.connect(audioContext.destination)
    oscillator3.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator3.type = 'sine'
    gainNode3.gain.setValueAtTime(0.3, audioContext.currentTime)
    oscillator3.start()
    oscillator3.stop(audioContext.currentTime + 0.5)
  }, 1200)
}

async function loadMasters() {
  console.log('loadMasters開始')
  try {
    const [recipes, pastas, cheeses] = await Promise.all([
      supa.from('recipes').select('id,name').eq('is_active', true).order('name'),
      supa.from('pasta_kinds').select('id,brand,thickness_mm,purchase_location,image_path,image_url').eq('is_active', true).order('brand').order('thickness_mm'),
      supa.from('cheeses').select('id,name,image_path,image_url').eq('is_active', true).order('name')
    ])

    console.log('データ取得結果:', { recipes: recipes.data, pastas: pastas.data, cheeses: cheeses.data })
    console.log('エラー:', { recipes: recipes.error, pastas: pastas.error, cheeses: cheeses.error })

    // レシピ（カテゴリ）は従来通り
    const recipeEl = $('#recipe'); recipeEl.innerHTML = '<option value="">カテゴリを選択</option>'
    console.log('recipes.data:', recipes.data)
    recipes.data?.forEach(r => {
      const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; recipeEl.appendChild(o)
    })
    console.log('レシピ読み込み完了')

    // パスタは画像付きカスタムドロップダウン
    await createPastaDropdown(pastas.data)
    console.log('パスタドロップダウン作成完了')

    // チーズは従来通り
    await fillWithImages('#cheese', cheeses.data, 'pasta-images')
    console.log('チーズ読み込み完了')
  } catch (error) {
    console.error('loadMasters エラー:', error)
    alert('マスタデータの読み込みに失敗しました: ' + error.message)
  }
}

// パスタの画像付きカスタムドロップダウンを作成
async function createPastaDropdown(pastas) {
  const container = $('#pasta').parentElement
  const originalSelect = $('#pasta')
  
  // カスタムドロップダウンのHTML
  const customDropdown = document.createElement('div')
  customDropdown.className = 'relative'
  customDropdown.innerHTML = `
    <div id="pastaDropdown" class="input cursor-pointer flex items-center justify-between">
      <span id="pastaSelected">パスタを選択</span>
      <span>▼</span>
    </div>
    <div id="pastaOptions" class="absolute top-full left-0 right-0 bg-white border rounded-xl mt-1 max-h-60 overflow-y-auto hidden z-10 shadow-lg">
    </div>
  `
  
  // 元のselectを隠してカスタムドロップダウンを追加
  originalSelect.style.display = 'none'
  container.appendChild(customDropdown)
  
  // 元のselectにもoptionを追加（バリデーション用）
  originalSelect.innerHTML = '<option value="">パスタを選択</option>'
  
  // オプションを作成
  const optionsContainer = customDropdown.querySelector('#pastaOptions')
  for (const pasta of (pastas || [])) {
    let imgUrl = null
    if (pasta.image_url) {
      imgUrl = pasta.image_url
    } else if (pasta.image_path) {
      const { data: urlData } = await supa.storage.from('pasta-images').createSignedUrl(pasta.image_path, 3600)
      if (urlData) imgUrl = urlData.signedUrl
    }
    
    const displayName = `${pasta.brand || 'ブランド未設定'} ${pasta.thickness_mm ? pasta.thickness_mm + 'mm' : ''}`
    
    // 元のselectにもoptionを追加
    const selectOption = document.createElement('option')
    selectOption.value = pasta.id
    selectOption.textContent = displayName
    originalSelect.appendChild(selectOption)
    
    const option = document.createElement('div')
    option.className = 'flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0'
    option.innerHTML = `
      ${imgUrl ? `<img src="${imgUrl}" class="w-10 h-10 object-cover rounded-lg border" />` : '<div class="w-10 h-10 bg-gray-200 rounded-lg border flex items-center justify-center text-gray-400 text-xs">画像なし</div>'}
      <div class="flex-1">
        <div class="font-medium">${displayName}</div>
        ${pasta.purchase_location ? `<div class="text-sm text-gray-500">${pasta.purchase_location}</div>` : ''}
      </div>
    `
    
    option.onclick = () => {
      originalSelect.value = pasta.id
      customDropdown.querySelector('#pastaSelected').textContent = displayName
      optionsContainer.classList.add('hidden')
    }
    
    optionsContainer.appendChild(option)
  }
  
  // ドロップダウンの開閉
  customDropdown.querySelector('#pastaDropdown').onclick = () => {
    optionsContainer.classList.toggle('hidden')
  }
  
  // 外側クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!customDropdown.contains(e.target)) {
      optionsContainer.classList.add('hidden')
    }
  })
}

async function fillWithImages(selector, items, bucket) {
  const el = $(selector)
  el.innerHTML = ''
  
  for (const item of (items || [])) {
    let imgUrl = null
    if (item.image_url) {
      imgUrl = item.image_url
    } else if (item.image_path) {
      const { data: urlData } = await supa.storage.from(bucket).createSignedUrl(item.image_path, 3600)
      if (urlData) imgUrl = urlData.signedUrl
    }
    
    const option = document.createElement('option')
    option.value = item.id
    option.textContent = item.name
    if (imgUrl) option.dataset.image = imgUrl
    el.appendChild(option)
  }
}

// デバッグ用関数をwindowに追加
window.debugDB = async function() {
  console.log('=== Database Debug ===')

  const recipesResult = await supa.from('recipes').select('*')
  console.log('Recipes result:', recipesResult)

  const pastasResult = await supa.from('pasta_kinds').select('*')
  console.log('Pasta kinds result:', pastasResult)

  const cheesesResult = await supa.from('cheeses').select('*')
  console.log('Cheeses result:', cheesesResult)

  console.log('=== End Debug ===')
}

console.log('🚀 Pasta Logger - 新規記録画面読み込み開始')
console.log('デバッグ用: ブラウザコンソールで debugDB() を実行してください')

// テスト用関数をwindowに追加
window.testProcessButton = function(processType) {
  console.log('🧪 テスト実行:', processType)
  recordProcess(processType, null)
}

// HTML要素の存在確認用デバッグ関数
window.checkHTMLElements = function() {
  console.log('🔍 HTML要素の確認開始')

  const expectedElements = [
    'timeSauceStart',
    'timePastaStart',
    'timeSauceFinish',
    'timePastaFinish',
    'timeCombineStart',
    'timeCompletion',
    'btnSauceStart',
    'btnPastaStart',
    'btnSauceFinish',
    'btnCombineStart',
    'btnCompletion'
  ]

  expectedElements.forEach(id => {
    const element = document.getElementById(id)
    if (element) {
      console.log(`✅ ${id}: 存在`)
    } else {
      console.error(`❌ ${id}: 見つからない`)
    }
  })

  // 全ての時間関連要素を表示
  const timeElements = document.querySelectorAll('[id*="time"]')
  console.log('🕐 時間関連要素:', Array.from(timeElements).map(el => el.id))

  // 全てのボタン要素を表示
  const buttonElements = document.querySelectorAll('[id*="btn"]')
  console.log('🔘 ボタン要素:', Array.from(buttonElements).map(el => el.id))
}

console.log('💡 テスト用: testProcessButton("sauce_start") で動作確認可能')
console.log('🔍 要素確認用: checkHTMLElements() でHTML要素を確認可能')

loadMasters()

// タイマー関連の変数（旧シンプルモード用、互換性のため残す）
let timerInterval = null
let isPaused = false
let remainingTime = 0

function stamp(k){
  const timestamp = new Date()
  marks[k] = timestamp.toISOString()
  $('#marks').textContent = `B:${marks.B??'-'} U:${marks.U??'-'} C:${marks.C??'-'}`

  // processLogsにも同期
  syncMarksToProcess(k, timestamp)

  // B(茹で開始)が押されたときにタイマー開始
  if (k === 'B') {
    startBoilTimer()
  }
}

// マークを工程記録に同期
function syncMarksToProcess(mark, timestamp) {
  switch (mark) {
    case 'B':
      processLogs['pasta_start'] = timestamp
      if (!cookingStartTime) {
        cookingStartTime = timestamp
      }
      break
    case 'U':
      processLogs['pasta_finish'] = timestamp
      break
    case 'C':
      processLogs['combine_start'] = timestamp
      break
  }
}

function startBoilTimer() {
  // 既にタイマーが動いている場合は停止
  if (cookingTimer) {
    clearInterval(cookingTimer)
  }

  // 茹で時間を秒で取得
  const boilTimeSeconds = parseInt($('#boilTime').value) || 480
  let remainingSeconds = boilTimeSeconds

  // タイマー表示を表示
  $('#timerDisplay').classList.remove('hidden')
  $('#timerTime').textContent = formatTime(remainingSeconds)
  $('#timerStatus').textContent = '茹で中...'

  cookingTimer = setInterval(() => {
    remainingSeconds--
    $('#timerTime').textContent = formatTime(remainingSeconds)

    if (remainingSeconds <= 0) {
      clearInterval(cookingTimer)
      onPastaFinished()
    }
  }, 1000)
}

function updateTimer() {
  if (isPaused) return
  
  remainingTime--
  updateTimerDisplay()
  
  if (remainingTime <= 0) {
    // タイマー終了
    clearInterval(timerInterval)
    timerInterval = null
    
    // アラート音を鳴らす（可能な場合）
    try {
      // Web Audio APIでビープ音を生成
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800 // 800Hz
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 1)
    } catch (e) {
      console.log('音声再生に失敗:', e)
    }
    
    // 視覚的な通知
    $('#timerTime').textContent = '茹で上がり！'
    $('#timerTime').classList.add('text-red-600', 'animate-pulse')
    $('#timerDisplay').classList.add('bg-red-50', 'border-red-200')
    $('#timerDisplay').classList.remove('bg-blue-50', 'border-blue-200')
    
    // ブラウザ通知（許可されている場合）
    if (Notification.permission === 'granted') {
      new Notification('パスタ茹で上がり！', {
        body: 'パスタの茹で時間が終了しました',
        icon: '/vite.svg'
      })
    }
    
    alert('🍝 パスタの茹で時間が終了しました！')
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(remainingTime / 60)
  const seconds = remainingTime % 60
  $('#timerTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function pauseTimer() {
  isPaused = true
  $('#pauseTimer').classList.add('hidden')
  $('#resumeTimer').classList.remove('hidden')
}

function resumeTimer() {
  isPaused = false
  $('#pauseTimer').classList.remove('hidden')
  $('#resumeTimer').classList.add('hidden')
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  $('#timerDisplay').classList.add('hidden')
  $('#timerTime').classList.remove('text-red-600', 'animate-pulse')
  $('#timerDisplay').classList.remove('bg-red-50', 'border-red-200')
  $('#timerDisplay').classList.add('bg-blue-50', 'border-blue-200')
  isPaused = false
  remainingTime = 0
}

// イベントリスナーの設定

// 通知の許可を要求
if (Notification.permission === 'default') {
  Notification.requestPermission()
}

// 星評価の設定
function setupStarRating(containerId, inputId) {
  const container = $(containerId)
  const input = $(inputId)
  const stars = container.querySelectorAll('.star-btn')
  
  stars.forEach((star) => {
    star.onclick = (e) => {
      e.preventDefault()
      const rating = parseInt(star.dataset.rating)
      input.value = rating
      
      // 星の表示を更新
      stars.forEach((s, i) => {
        s.classList.toggle('active', i < rating)
      })
    }
  })
}

// 堅さ評価の設定
function setupFirmnessRating(containerId, inputId) {
  const container = $(containerId)
  const input = $(inputId)
  const buttons = container.querySelectorAll('.firmness-btn')
  
  buttons.forEach((button) => {
    button.onclick = (e) => {
      e.preventDefault()
      const rating = parseInt(button.dataset.rating)
      input.value = rating
      
      // ボタンの表示を更新
      buttons.forEach((b) => {
        b.classList.remove('active')
      })
      button.classList.add('active')
    }
  })
}

setupStarRating('#overallStars', '#overall')
setupFirmnessRating('#firmnessButtons', '#firmness')

// 茹で時間ステッパーの機能
// 茹で時間管理（分・秒個別設定）
const boilTimeInput = $('#boilTime')
const boilMinutesInput = $('#boilMinutes')
const boilSecondsInput = $('#boilSeconds')

// 分・秒から総秒数を計算して隠しフィールドを更新
function updateBoilTimeTotal() {
  const minutes = parseInt(boilMinutesInput.value) || 0
  const seconds = parseInt(boilSecondsInput.value) || 0
  const totalSeconds = minutes * 60 + seconds
  boilTimeInput.value = totalSeconds
}

// 分の増減ボタン
$('#boilMinuteMinus').onclick = () => {
  const current = parseInt(boilMinutesInput.value) || 0
  boilMinutesInput.value = Math.max(0, current - 1)
  updateBoilTimeTotal()
}

// 分のプラスボタン
$('#boilMinutePlus').onclick = () => {
  const current = parseInt(boilMinutesInput.value) || 0
  boilMinutesInput.value = Math.min(9, current + 1)
  updateBoilTimeTotal()
}

// 秒の増減ボタン
$('#boilSecondMinus').onclick = () => {
  const current = parseInt(boilSecondsInput.value) || 0
  boilSecondsInput.value = Math.max(0, current - 10)
  updateBoilTimeTotal()
}

// 秒のプラスボタン
$('#boilSecondPlus').onclick = () => {
  const current = parseInt(boilSecondsInput.value) || 0
  const newValue = current + 10
  if (newValue >= 60) {
    boilSecondsInput.value = 0
    const minutes = parseInt(boilMinutesInput.value) || 0
    boilMinutesInput.value = Math.min(9, minutes + 1)
  } else {
    boilSecondsInput.value = newValue
  }
  updateBoilTimeTotal()
}

// プリセットボタンの設定
document.querySelectorAll('.boil-preset-btn').forEach(btn => {
  btn.onclick = () => {
    boilMinutesInput.value = btn.dataset.minutes
    boilSecondsInput.value = btn.dataset.seconds
    updateBoilTimeTotal()

    // アクティブ状態の表示
    document.querySelectorAll('.boil-preset-btn').forEach(b => b.classList.remove('btn-primary'))
    btn.classList.add('btn-primary')
  }
})

// 入力フィールドの変更監視
boilMinutesInput.oninput = updateBoilTimeTotal
boilSecondsInput.oninput = updateBoilTimeTotal

// 初期値設定
updateBoilTimeTotal()

// 塩分濃度の計算と表示
function updateSaltPercentage() {
  const water = parseFloat($('#waterAmount').value) || 0
  const salt = parseFloat($('#saltAmount').value) || 0
  const percentage = water > 0 ? (salt / (water * 1000) * 100).toFixed(1) : 0
  $('#saltPercentage').textContent = water > 0 && salt > 0 ? `塩分濃度: ${percentage}%` : ''
}

$('#waterAmount').oninput = updateSaltPercentage
$('#saltAmount').oninput = updateSaltPercentage

// 新しい麺を登録ボタンの機能
$('#addNewPasta').onclick = () => {
  if (confirm('管理画面で新しい麺を登録しますか？')) {
    location.href = '/manage.html'
  }
}

// 写真選択機能
function setupPhotoSelection() {
  const photoInput = $('#photo')
  const cameraBtn = $('#cameraBtn')
  const galleryBtn = $('#galleryBtn')
  const photoPreview = $('#photoPreview')
  const previewImage = $('#previewImage')
  const removePhotoBtn = $('#removePhoto')

  // カメラで撮影ボタン
  cameraBtn.onclick = () => {
    photoInput.setAttribute('capture', 'environment')
    photoInput.setAttribute('accept', 'image/*')
    photoInput.click()
  }

  // ギャラリーから選択ボタン
  galleryBtn.onclick = () => {
    photoInput.removeAttribute('capture')
    photoInput.setAttribute('accept', 'image/*')
    photoInput.click()
  }

  // ファイル選択時の処理
  photoInput.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        previewImage.src = event.target.result
        photoPreview.classList.remove('hidden')
      }
      reader.readAsDataURL(file)
    }
  }

  // 写真削除ボタン
  removePhotoBtn.onclick = () => {
    photoInput.value = ''
    photoPreview.classList.add('hidden')
    previewImage.src = ''
  }
}

setupPhotoSelection()


async function uploadPhoto(file, userId){
  if(!file) return { path: null, url: null }
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${uuidv4()}.${ext}`
  const { error } = await supa.storage.from('pasta-photos').upload(path, file, { upsert:false, contentType:file.type })
  if(error){ alert('写真アップロード失敗: '+error.message); return { path:null, url:null } }
  const { data } = supa.storage.from('pasta-photos').getPublicUrl(path) // Public想定
  return { path, url: data.publicUrl }
}

$('#logForm').onsubmit = async (e) => {
  e.preventDefault()
  console.log('フォーム送信開始')
  
  // 麺選択の必須チェック
  const pastaValue = $('#pasta').value
  console.log('パスタselect要素の値:', pastaValue)
  console.log('パスタselect要素:', $('#pasta'))
  
  if (!pastaValue) {
    alert('麺を選択してください')
    return
  }
  
  console.log('バリデーション通過')
  
  const userId = (await supa.auth.getUser()).data.user.id
  const photoFile = $('#photo').files[0]
  const photo = await uploadPhoto(photoFile, userId)
  const cheeseSel = Array.from($('#cheese').selectedOptions).map(o=>o.value)

  // パスタ名とメモを別々に取得
  const pastaName = $('#pastaName').value || null
  const feedbackText = $('#feedback').value || null

  // 塩分濃度を計算
  const water = parseFloat($('#waterAmount').value) || null
  const salt = parseFloat($('#saltAmount').value) || null
  const saltPct = (water && salt) ? (salt / (water * 1000) * 100) : null

  console.log('データベース挿入開始')
  const insertData = {
    recipe_id: $('#recipe').value,
    pasta_kind_id: $('#pasta').value,
    cheese_kind_ids: cheeseSel,
    boil_start_ts: marks.B, up_ts: marks.U, combine_end_ts: marks.C,
    boil_salt_pct: saltPct,
    ladle_half_units: $('#ladle').value ? Number($('#ladle').value) : null,
    photo_path: photo.path, photo_url: photo.url,
    rating_core: {
      overall: $('#overall').value ? Number($('#overall').value) : null,
      firmness: $('#firmness').value ? Number($('#firmness').value) : null
    },
    title: pastaName,
    feedback_text: feedbackText,
    recipe_reference: $('#recipeReference').value || null,
  }
  
  console.log('挿入データ:', insertData)
  
  // 調理工程時間がある場合は保存
  if (Object.keys(processLogs).length > 0) {
    insertData.cooking_process_times = processLogs
    insertData.cooking_start_time = cookingStartTime?.toISOString()
    if (cookingStartTime && processLogs['completion']) {
      insertData.cooking_total_seconds = Math.floor((processLogs['completion'] - cookingStartTime) / 1000)
    }
  }

  const { error } = await supa.from('pasta_logs').insert(insertData)
  if(error) {
    console.error('保存エラー:', error)
    alert('保存に失敗: '+error.message)
  } else {
    console.log('保存成功')
    alert('保存しました')
    location.href = '/log-list.html'
  }
}

// ===============================
// 調理タイマー機能
// ===============================

// 工程記録ボタンの設定を確実に実行
function setupProcessButtons() {
  console.log('=== 工程ボタン設定開始 ===')

  // 個別にボタンを設定（確実に動作させるため）
  const buttons = [
    { id: 'btnSauceStart', process: 'sauce_start', name: 'ソース開始' },
    { id: 'btnPastaStart', process: 'pasta_start', name: '麺投入' },
    { id: 'btnPastaFinish', process: 'pasta_finish', name: '茹で上がり' },
    { id: 'btnSauceFinish', process: 'sauce_finish', name: 'ソース完成' },
    { id: 'btnCombineStart', process: 'combine_start', name: '合わせ開始' },
    { id: 'btnCompletion', process: 'completion', name: '完成' }
  ]

  buttons.forEach(({ id, process, name }) => {
    const btn = document.getElementById(id)
    if (btn) {
      console.log(`✓ ${name}ボタン (${id}) 設定中...`)

      // 既存のイベントリスナーを削除
      btn.onclick = null

      // 新しいイベントリスナーを設定
      btn.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        console.log(`🔥 ${name}ボタンクリック!`, process)
        recordProcess(process, btn)
        return false
      }

      // さらにaddEventListenerでも設定
      btn.addEventListener('click', function(e) {
        e.preventDefault()
        e.stopPropagation()
        console.log(`🎯 ${name}ボタンクリック (addEventListener)!`, process)
        recordProcess(process, btn)
      })

      console.log(`✅ ${name}ボタン設定完了`)
    } else {
      console.error(`❌ ${name}ボタン (${id}) が見つかりません`)
    }
  })

  console.log('=== 工程ボタン設定完了 ===')
}

// DOMが読み込まれた後に設定
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupProcessButtons)
} else {
  setupProcessButtons()
}

// 念のため少し遅延してもう一度設定
setTimeout(setupProcessButtons, 1000)

// 工程記録
function recordProcess(processType, buttonElement) {
  console.log('🎯 recordProcess開始:', processType)
  const timestamp = new Date()

  try {
    // 最初の工程の場合、調理開始時刻を記録
    if (!cookingStartTime && processType === 'sauce_start') {
      cookingStartTime = timestamp
      console.log('📅 調理開始時刻設定:', cookingStartTime)
    }

    // ローカル記録
    processLogs[processType] = timestamp
    console.log('💾 processLogs更新:', processType, timestamp)

    // 既存マークシステムとの統合（安全実行）
    try {
      syncProcessToMarks(processType, timestamp)
      console.log('✅ マーク同期完了')
    } catch (syncError) {
      console.warn('⚠️ マーク同期エラー:', syncError)
    }

    // 時間表示の更新（安全実行）
    try {
      updateTimeDisplay(processType, timestamp)
      console.log('✅ 時間表示更新完了')
    } catch (timeError) {
      console.warn('⚠️ 時間表示エラー:', timeError)
    }

    // ボタンのUI更新（安全実行）
    try {
      updateProcessButton(processType, timestamp, false)
      console.log('✅ ボタンUI更新完了')
    } catch (buttonError) {
      console.warn('⚠️ ボタンUI更新エラー:', buttonError)
    }

    // 並行タイマーの開始（安全実行）
    try {
      startProcessTimer(processType, timestamp)
      console.log('✅ タイマー開始完了')
    } catch (timerError) {
      console.warn('⚠️ タイマー開始エラー:', timerError)
    }

    // 終了工程の場合、対応する開始工程のタイマーを停止
    try {
      stopRelatedTimers(processType)
      console.log('✅ 関連タイマー停止完了')
    } catch (stopError) {
      console.warn('⚠️ タイマー停止エラー:', stopError)
    }

    // 特別な処理
    try {
      handleSpecialProcesses(processType)
      console.log('✅ 特別処理完了')
    } catch (specialError) {
      console.warn('⚠️ 特別処理エラー:', specialError)
    }

    console.log('✅ recordProcess完了:', processType)

  } catch (error) {
    console.error('❌ recordProcessエラー:', error)
    console.error('エラー詳細:', error.stack)
    alert('工程記録でエラーが発生しました: ' + error.message)
  }
}

// 時間表示を更新
function updateTimeDisplay(processType, timestamp) {
  const timeMapping = {
    'sauce_start': 'timeSauceStart',
    'pasta_start': 'timePastaStart',
    'sauce_finish': 'timeSauceFinish',
    'pasta_finish': 'timePastaFinish',
    'combine_start': 'timeCombineStart',
    'completion': 'timeCompletion'
  }

  const timeElementId = timeMapping[processType]
  if (!timeElementId) {
    console.warn(`⚠️ processType不明: ${processType}`)
    return
  }

  const timeElement = document.getElementById(timeElementId)
  if (!timeElement) {
    console.error(`❌ 時間表示要素が見つかりません: ${timeElementId}`)
    console.log('利用可能な要素を確認中...')

    // デバッグ用: 似た名前の要素を探す
    const allElements = document.querySelectorAll('[id*="time"]')
    console.log('時間関連要素:', Array.from(allElements).map(el => el.id))
    return
  }

  try {
    const timeStr = timestamp.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    timeElement.textContent = `記録: ${timeStr}`
    timeElement.classList.remove('text-gray-500')
    timeElement.classList.add('text-green-600', 'font-medium')
    console.log(`✅ 時間表示更新成功: ${timeElementId} = ${timeStr}`)
  } catch (error) {
    console.error(`❌ 時間表示更新エラー: ${timeElementId}`, error)
  }
}

// 関連タイマーを停止
function stopRelatedTimers(processType) {
  const endToStartMap = {
    'sauce_finish': 'sauce_start',
    'pasta_finish': 'pasta_start',
    'completion': 'combine_start'
  }

  const startProcess = endToStartMap[processType]
  if (startProcess && displayTimers[startProcess]) {
    clearInterval(displayTimers[startProcess])
    console.log(`⏹️ ${startProcess}のタイマーを停止`)
  }
}

// 特別な処理を実行
function handleSpecialProcesses(processType) {
  if (processType === 'pasta_start') {
    console.log('🍝 麺投入 - 茹でタイマー開始')
    startBoilTimer()
  } else if (processType === 'completion') {
    console.log('🎉 完成 - 分析表示')
    calculateAndDisplayAnalysis()
  }
}

// 並行タイマーシステム
function startProcessTimer(processType, startTime) {
  console.log('⏱️ 並行タイマー開始:', processType)

  // 既存のタイマーがあれば停止
  if (displayTimers[processType]) {
    clearInterval(displayTimers[processType])
    console.log('既存タイマー停止:', processType)
  }

  processTimers[processType] = startTime

  // 並行タイマーの設定
  const timerConfigs = {
    'sauce_start': {
      endProcess: 'sauce_finish',
      elementId: 'timeSauceStart',
      label: 'ソース調理時間'
    },
    'pasta_start': {
      endProcess: 'pasta_finish',
      elementId: 'timePastaStart',
      label: '茹で時間'
    },
    'combine_start': {
      endProcess: 'completion',
      elementId: 'timeCombineStart',
      label: '合わせ時間'
    }
  }

  const config = timerConfigs[processType]
  if (!config) {
    console.log('タイマー設定なし:', processType)
    return
  }

  console.log(`🚀 ${config.label}タイマー開始`)

  displayTimers[processType] = setInterval(() => {
    try {
      // 終了工程が記録されていればタイマー停止
      if (processLogs[config.endProcess]) {
        clearInterval(displayTimers[processType])
        console.log(`⏹️ ${config.label}タイマー完了`)

        // 最終時間を表示
        const finalElapsed = Math.floor((processLogs[config.endProcess] - startTime) / 1000)
        const finalMinutes = Math.floor(finalElapsed / 60)
        const finalSeconds = finalElapsed % 60
        const finalTimeText = `${finalMinutes}:${finalSeconds.toString().padStart(2, '0')}`

        const timeElement = document.getElementById(config.elementId)
        if (timeElement) {
          timeElement.textContent = `${config.label}: ${finalTimeText} (完了)`
          timeElement.classList.remove('text-blue-600')
          timeElement.classList.add('text-green-600', 'font-bold')
        }
        return
      }

      // 経過時間を計算
      const elapsed = Math.floor((new Date() - startTime) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`

      // UI更新
      const timeElement = document.getElementById(config.elementId)
      if (timeElement) {
        timeElement.textContent = `${config.label}: ${timeText}`
        timeElement.classList.remove('text-gray-500')
        timeElement.classList.add('text-blue-600', 'font-medium')
        console.log(`⏰ ${config.label}: ${timeText}`)
      } else {
        console.warn(`⚠️ 時間表示要素が見つからない: ${config.elementId}`)
      }

    } catch (error) {
      console.error('❌ タイマーエラー:', error)
      clearInterval(displayTimers[processType])
    }
  }, 1000)

  console.log(`✅ ${config.label}タイマー設定完了`)
}

// 工程記録を既存のマークシステムに同期
function syncProcessToMarks(processType, timestamp) {
  console.log('🔄 マーク同期開始:', processType)

  try {
    const isoString = timestamp.toISOString()

    switch (processType) {
      case 'pasta_start':
        marks.B = isoString
        console.log('✅ marks.B更新:', marks.B)
        break
      case 'pasta_finish':
        marks.U = isoString
        console.log('✅ marks.U更新:', marks.U)
        break
      case 'combine_start':
        marks.C = isoString
        console.log('✅ marks.C更新:', marks.C)
        break
      default:
        console.log('ℹ️ マーク更新対象外:', processType)
        return
    }

    // マーク表示を更新
    const marksElement = document.getElementById('marks')
    if (marksElement) {
      marksElement.textContent = `B:${marks.B??'-'} U:${marks.U??'-'} C:${marks.C??'-'}`
      console.log('✅ マーク表示更新完了')
    } else {
      console.warn('⚠️ marksエレメントが見つかりません')
    }

  } catch (error) {
    console.error('❌ マーク同期エラー:', error)
    throw error
  }
}


// 工程ボタンのUI更新（安全版）
function updateProcessButton(processType, timestamp, isAuto = false) {
  console.log(`🔄 ボタンUI更新: ${processType}`)

  try {
    // 時間要素の更新は updateTimeDisplay に任せる（重複を避ける）
    console.log(`⏩ 時間表示は updateTimeDisplay で処理済み`)

    // ボタンを記録済み状態に変更
    const btnId = `btn${processType.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

    const button = document.getElementById(btnId)
    if (button) {
      button.classList.remove('btn-outline')
      button.classList.add('bg-green-100', 'border-green-300', 'text-green-700')
      button.disabled = true
      console.log(`✅ ボタン状態更新完了: ${btnId}`)
    } else {
      console.warn(`⚠️ ボタンが見つかりません: ${btnId}`)
    }
  } catch (error) {
    console.error(`❌ ボタンUI更新エラー: ${processType}`, error)
  }
}


// 茹で上がりアラーム（記録は手動ボタンで行う）
function onPastaFinished() {
  console.log('🍝 茹で時間終了 - アラーム通知のみ')

  $('#timerTime').textContent = '00:00'
  $('#timerStatus').textContent = '茹で上がり！'

  // アラーム音を鳴らす
  playAlarm()

  // 通知（可能であれば）
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('パスタが茹で上がりました！', {
      body: '茹で上がりボタンを押してください',
      icon: '/favicon.ico'
    })
  }
}


// 時間分析の計算と表示
function calculateAndDisplayAnalysis() {
  const sauce_start = processLogs['sauce_start']
  const pasta_start = processLogs['pasta_start']
  const pasta_finish = processLogs['pasta_finish']
  const sauce_finish = processLogs['sauce_finish']
  const combine_start = processLogs['combine_start']
  const completion = processLogs['completion']

  // ソース待機時間（ソース完成から茹で上がりまで）
  if (sauce_finish && pasta_finish) {
    const sauceWait = Math.max(0, (pasta_finish - sauce_finish) / 1000)
    $('#analysisSauceWait').textContent = `${Math.floor(sauceWait / 60)}分${Math.floor(sauceWait % 60)}秒`
  }

  // 麺待機時間（茹で上がりから合わせ開始まで）
  if (pasta_finish && combine_start) {
    const pastaWait = (combine_start - pasta_finish) / 1000
    $('#analysisPastaWait').textContent = `${Math.floor(pastaWait / 60)}分${Math.floor(pastaWait % 60)}秒`
  }

  // 合わせ時間（合わせ開始から完成まで）
  if (combine_start && completion) {
    const combineDuration = (completion - combine_start) / 1000
    $('#analysisCombineDuration').textContent = `${Math.floor(combineDuration / 60)}分${Math.floor(combineDuration % 60)}秒`
  }

  // 調理総時間（ソース開始から完成まで）
  if (sauce_start && completion) {
    const totalTime = (completion - sauce_start) / 1000
    $('#analysisTotalTime').textContent = `${Math.floor(totalTime / 60)}分${Math.floor(totalTime % 60)}秒`
  }

  $('#timeAnalysis').classList.remove('hidden')
}


// 通知許可を要求
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission()
}
