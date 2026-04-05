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

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

async function loadMasters() {
  console.log('loadMasters開始')
  try {
    const { data: pastas, error: pastasError } = await supa.from('pasta_kinds')
      .select('id,brand,thickness_mm,purchase_location,image_path,image_url')
      .eq('is_active', true)
      .order('brand')
      .order('thickness_mm')

    if (pastasError) throw pastasError

    console.log('データ取得結果:', { pastas })

    // パスタは画像付きカスタムドロップダウン
    await createPastaDropdown(pastas)
    console.log('パスタドロップダウン作成完了')
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

console.log('🚀 Pasta Logger - 新規記録画面読み込み開始')

loadMasters()

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

// 評価スコアの設定（4つ）
setupStarRating('#pastaQualityStars', '#pastaQuality')
setupStarRating('#saltBalanceStars', '#saltBalance')
setupStarRating('#sauceBalanceStars', '#sauceBalance')
setupStarRating('#overallStars', '#overall')

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

// パスタグラム数の増減ボタン
$('#pastaAmountMinus').onclick = () => {
  const current = parseInt($('#pastaAmount').value) || 80
  $('#pastaAmount').value = Math.max(50, current - 10)
}

$('#pastaAmountPlus').onclick = () => {
  const current = parseInt($('#pastaAmount').value) || 80
  $('#pastaAmount').value = Math.min(150, current + 10)
}

// パスタグラム数プリセットボタン
document.querySelectorAll('.amount-preset-btn').forEach(btn => {
  btn.onclick = () => {
    $('#pastaAmount').value = btn.dataset.amount
    // アクティブ状態の表示
    document.querySelectorAll('.amount-preset-btn').forEach(b => b.classList.remove('btn-primary'))
    btn.classList.add('btn-primary')
  }
})

// 水量プリセットボタン
document.querySelectorAll('.water-preset-btn').forEach(btn => {
  btn.onclick = () => {
    $('#waterAmount').value = btn.dataset.water
    updateSaltPercentage()
    // アクティブ状態の表示
    document.querySelectorAll('.water-preset-btn').forEach(b => b.classList.remove('btn-primary'))
    btn.classList.add('btn-primary')
  }
})

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

// 5大要素のチェックボックス連動
const coreIngredients = [
  { checkbox: 'usedPomodoro', detail: 'pomodoroDetail' },
  { checkbox: 'usedAglio', detail: 'aglioDetail' },
  { checkbox: 'usedOlio', detail: 'olioDetail' },
  { checkbox: 'usedBurro', detail: 'burroDetail' },
  { checkbox: 'usedParmigiano', detail: 'parmigianoDetail' }
]

coreIngredients.forEach(({ checkbox, detail }) => {
  const cb = $(`#${checkbox}`)
  const detailEl = $(`#${detail}`)

  cb.onchange = () => {
    if (cb.checked) {
      detailEl.classList.remove('hidden')
      detailEl.removeAttribute('disabled')
    } else {
      detailEl.classList.add('hidden')
      detailEl.setAttribute('disabled', 'disabled')
      detailEl.value = ''
    }
  }
})

// サブ要素のチェックボックス連動
const subIngredients = [
  { checkbox: 'usedChiliOil', detail: 'chiliOilNote' },
  { checkbox: 'usedAnchovy', detail: 'anchovyNote' },
  { checkbox: 'usedCheeses', detail: 'cheesesItems' },
  { checkbox: 'usedCream', detail: 'creamNote' }
]

subIngredients.forEach(({ checkbox, detail }) => {
  const cb = $(`#${checkbox}`)
  const detailEl = $(`#${detail}`)

  cb.onchange = () => {
    if (cb.checked) {
      detailEl.classList.remove('hidden')
      detailEl.removeAttribute('disabled')
    } else {
      detailEl.classList.add('hidden')
      detailEl.setAttribute('disabled', 'disabled')
      detailEl.value = ''
    }
  }
})

async function uploadPhoto(file, userId){
  if(!file) return { path: null, url: null }
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${uuidv4()}.${ext}`
  const { error } = await supa.storage.from('pasta-photos').upload(path, file, { upsert:false, contentType:file.type })
  if(error){ alert('写真アップロード失敗: '+error.message); return { path:null, url:null } }
  const { data } = supa.storage.from('pasta-photos').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

$('#logForm').onsubmit = async (e) => {
  e.preventDefault()
  console.log('フォーム送信開始')

  // 麺選択の必須チェック
  const pastaValue = $('#pasta').value
  if (!pastaValue) {
    alert('麺を選択してください')
    return
  }

  // グラム数の必須チェック
  const pastaAmount = parseInt($('#pastaAmount').value)
  if (!pastaAmount || pastaAmount < 50 || pastaAmount > 150) {
    alert('グラム数を入力してください (50-150g)')
    return
  }

  console.log('バリデーション通過')

  const userId = (await supa.auth.getUser()).data.user.id
  const photoFile = $('#photo').files[0]
  const photo = await uploadPhoto(photoFile, userId)

  // パスタ名とメモを別々に取得
  const pastaName = $('#pastaName').value || null
  const feedbackText = $('#feedback').value || null

  // 塩分濃度を計算
  const water = parseFloat($('#waterAmount').value) || null
  const salt = parseFloat($('#saltAmount').value) || null
  const saltPct = (water && salt) ? (salt / (water * 1000) * 100) : null

  // 5大要素の収集
  const coreIngredientsData = {
    pomodoro: $('#usedPomodoro').checked ? { used: true, detail: $('#pomodoroDetail').value || null } : { used: false, detail: null },
    aglio: $('#usedAglio').checked ? { used: true, detail: $('#aglioDetail').value || null } : { used: false, detail: null },
    olio: $('#usedOlio').checked ? { used: true, detail: $('#olioDetail').value || null } : { used: false, detail: null },
    burro: $('#usedBurro').checked ? { used: true, detail: $('#burroDetail').value || null } : { used: false, detail: null },
    parmigiano: $('#usedParmigiano').checked ? { used: true, detail: $('#parmigianoDetail').value || null } : { used: false, detail: null }
  }

  // サブ要素の収集
  const subIngredientsData = {
    chili_oil: $('#usedChiliOil').checked ? { used: true, note: $('#chiliOilNote').value || '' } : { used: false, note: null },
    anchovy: $('#usedAnchovy').checked ? { used: true, note: $('#anchovyNote').value || '' } : { used: false, note: null },
    cheeses: $('#usedCheeses').checked ? {
      used: true,
      items: $('#cheesesItems').value ? $('#cheesesItems').value.split(',').map(s => s.trim()).filter(s => s) : []
    } : { used: false, items: [] },
    cream: $('#usedCream').checked ? { used: true, note: $('#creamNote').value || '' } : { used: false, note: null }
  }

  // 香り要素の収集
  const aromaIngredientsData = {
    italian_parsley: $('#aromaItalianParsley').checked,
    basil: $('#aromaBasil').checked,
    rosemary: $('#aromaRosemary').checked,
    sage: $('#aromaSage').checked,
    lemon: $('#aromaLemon').checked,
    black_pepper: $('#aromaBlackPepper').checked,
    other: $('#aromaOther').value || null
  }

  // 旨味系具材の収集
  const umamiIngredientsArray = $('#umamiIngredients').value
    ? $('#umamiIngredients').value.split(',').map(s => s.trim()).filter(s => s)
    : []

  // その他具材の収集
  const otherIngredientsArray = $('#otherIngredients').value
    ? $('#otherIngredients').value.split(',').map(s => s.trim()).filter(s => s)
    : []

  console.log('データベース挿入開始')
  const insertData = {
    pasta_kind_id: $('#pasta').value,
    pasta_amount_g: pastaAmount,
    water_amount_l: water,
    boil_salt_pct: saltPct,
    ladle_half_units: $('#ladle').value ? Number($('#ladle').value) : null,
    photo_path: photo.path,
    photo_url: photo.url,
    rating_core: {
      overall: $('#overall').value ? Number($('#overall').value) : null,
      pasta_quality: $('#pastaQuality').value ? Number($('#pastaQuality').value) : null,
      salt_balance: $('#saltBalance').value ? Number($('#saltBalance').value) : null,
      sauce_balance: $('#sauceBalance').value ? Number($('#sauceBalance').value) : null
    },
    core_ingredients: coreIngredientsData,
    sub_ingredients: subIngredientsData,
    aroma_ingredients: aromaIngredientsData,
    umami_ingredients: umamiIngredientsArray,
    other_ingredients: otherIngredientsArray,
    title: pastaName,
    feedback_text: feedbackText,
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
