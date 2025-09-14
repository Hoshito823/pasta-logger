import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'
import { v4 as uuidv4 } from 'uuid'

const $ = (s) => document.querySelector(s)
const marks = { B: null, U: null, C: null }

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

async function loadMasters() {
  const [recipes, pastas, cheeses] = await Promise.all([
    supa.from('recipes').select('id,name').eq('is_active', true).order('name'),
    supa.from('pasta_kinds').select('id,brand,thickness_mm,purchase_location,image_path,image_url').eq('is_active', true).order('brand').order('thickness_mm'),
    supa.from('cheeses').select('id,name,image_path,image_url').eq('is_active', true).order('name')
  ])
  
  // レシピ（カテゴリ）は従来通り
  const recipeEl = $('#recipe'); recipeEl.innerHTML = ''
  recipes.data?.forEach(r => { 
    const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; recipeEl.appendChild(o) 
  })
  
  // パスタは画像付きカスタムドロップダウン
  await createPastaDropdown(pastas.data)
  
  // チーズは従来通り
  await fillWithImages('#cheese', cheeses.data, 'pasta-images')
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
loadMasters()

// タイマー関連の変数
let timerInterval = null
let isPaused = false
let remainingTime = 0

function stamp(k){ 
  marks[k] = new Date().toISOString(); 
  $('#marks').textContent = `B:${marks.B??'-'} U:${marks.U??'-'} C:${marks.C??'-'}`
  
  // B(茹で開始)が押されたときにタイマー開始
  if (k === 'B') {
    startBoilTimer()
  }
}

function startBoilTimer() {
  // 既にタイマーが動いている場合は停止
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  
  // 茹で時間を秒で取得
  remainingTime = parseInt($('#boilTime').value)
  isPaused = false
  
  // タイマー表示を表示
  $('#timerDisplay').classList.remove('hidden')
  $('#pauseTimer').classList.remove('hidden')
  $('#resumeTimer').classList.add('hidden')
  
  // タイマー開始
  timerInterval = setInterval(updateTimer, 1000)
  updateTimerDisplay()
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
$('#markB').onclick = ()=> stamp('B')
$('#markU').onclick = ()=> stamp('U') 
$('#markC').onclick = ()=> stamp('C')
$('#pauseTimer').onclick = pauseTimer
$('#resumeTimer').onclick = resumeTimer
$('#stopTimer').onclick = stopTimer

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
const boilTimeInput = $('#boilTime')
const boilTimeDisplay = $('#boilTimeDisplay')

function updateBoilTimeDisplay() {
  const seconds = parseInt(boilTimeInput.value)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  boilTimeDisplay.textContent = `${minutes}分${remainingSeconds.toString().padStart(2, '0')}秒`
}

$('#boilTimeMinus').onclick = () => {
  const current = parseInt(boilTimeInput.value)
  const newValue = Math.max(60, current - 10)
  boilTimeInput.value = newValue
  updateBoilTimeDisplay()
}

$('#boilTimePlus').onclick = () => {
  const current = parseInt(boilTimeInput.value)
  const newValue = Math.min(1200, current + 10)
  boilTimeInput.value = newValue
  updateBoilTimeDisplay()
}

boilTimeInput.oninput = updateBoilTimeDisplay
updateBoilTimeDisplay()

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

  // パスタ名をメモ欄に含める一時的な対応
  let feedbackText = $('#feedback').value || ''
  const pastaName = $('#pastaName').value
  if (pastaName) {
    feedbackText = `【${pastaName}】\n${feedbackText}`.trim()
  }

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
    feedback_text: feedbackText || null,
    recipe_reference: $('#recipeReference').value || null,
  }
  
  console.log('挿入データ:', insertData)
  
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
