import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'
import { v4 as uuidv4 } from 'uuid'

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

const params = new URLSearchParams(location.search)
const id = params.get('id')
const $ = (s) => document.querySelector(s)

// 編集モードの状態管理
let isEditMode = false
let currentData = null
let masterData = { recipes: [], pastas: [], cheeses: [] }

console.log('詳細画面: URLパラメータ確認', { search: location.search, id })

if (!id) {
  $('#content').innerHTML = '<p class="text-red-600">IDが指定されていません。</p>'
  throw new Error('missing id')
}

function fmt(ts){ try{return new Date(ts).toLocaleString()}catch{ return '-' } }

// 堅さ値を文字列に変換
function firmnessToText(value) {
  const firmnessMap = {
    1: 'やわらかい',
    2: '少しやわらかい', 
    3: 'ちょうどよい',
    4: '少しかたい',
    5: 'かたい'
  }
  return firmnessMap[value] || '-'
}

// マスターデータ読み込み
async function loadMasters() {
  const [recipes, pastas, cheeses] = await Promise.all([
    supa.from('recipes').select('id,name').eq('is_active', true).order('name'),
    supa.from('pasta_kinds').select('id,brand,thickness_mm,purchase_location,image_path,image_url').eq('is_active', true).order('brand').order('thickness_mm'),
    supa.from('cheeses').select('id,name,image_path,image_url').eq('is_active', true).order('name')
  ])
  
  masterData = {
    recipes: recipes.data || [],
    pastas: pastas.data || [],
    cheeses: cheeses.data || []
  }
}

async function resolvePhotoUrl(row){
  if (row.photo_url) return row.photo_url
  if (row.photo_path) {
    const { data, error } = await supa.storage.from('pasta-photos').createSignedUrl(row.photo_path, 3600)
    if (!error) return data.signedUrl
  }
  return null
}

// 編集フォームの表示
async function showEditForm() {
  if (!currentData) return
  
  // パスタ名をフィードバックテキストから抽出
  let pastaName = ''
  let feedbackText = currentData.feedback_text || ''
  if (feedbackText && feedbackText.startsWith('【')) {
    const match = feedbackText.match(/^【(.+?)】\n?(.*)$/s)
    if (match) {
      pastaName = match[1]
      feedbackText = match[2]
    }
  }

  // チーズデータを取得
  let selectedCheeseIds = []
  const { data: logRow } = await supa.from('pasta_logs').select('cheese_kind_ids').eq('id', id).single()
  if (logRow?.cheese_kind_ids?.length) {
    selectedCheeseIds = logRow.cheese_kind_ids.map(id => String(id))
  }

  const imgUrl = await resolvePhotoUrl(currentData)
  
  $('#content').innerHTML = `
    <form id="editForm" class="space-y-4">
      <div class="space-y-3">
        ${imgUrl ? `<img src="${imgUrl}" class="w-full max-h-80 object-cover rounded-xl border" />` : ''}
        
        <!-- 写真選択 -->
        <div class="card">
          <div class="font-semibold mb-2">写真</div>
          <div class="flex gap-2 mb-3">
            <button type="button" id="cameraBtn" class="btn text-sm">📷 カメラで撮影</button>
            <button type="button" id="galleryBtn" class="btn text-sm">🖼️ ギャラリーから選択</button>
          </div>
          <input type="file" id="photo" class="hidden" />
          <div id="photoPreview" class="hidden">
            <img id="previewImage" class="w-full max-h-60 object-cover rounded-xl border mb-2" />
            <button type="button" id="removePhoto" class="btn text-sm">削除</button>
          </div>
        </div>

        <!-- 料理名 -->
        <div class="card">
          <div class="font-semibold mb-2">料理名</div>
          <input type="text" id="pastaName" class="input" placeholder="例: カルボナーラ" value="${pastaName}" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- レシピカテゴリ -->
          <div class="card">
            <div class="font-semibold mb-2">カテゴリ</div>
            <select id="recipe" class="input">
              <option value="">選択してください</option>
              ${masterData.recipes.map(r => 
                `<option value="${r.id}" ${String(currentData.recipe?.id) === String(r.id) ? 'selected' : ''}>${r.name}</option>`
              ).join('')}
            </select>
          </div>

          <!-- パスタ -->
          <div class="card">
            <div class="font-semibold mb-2">麺 <span class="text-red-500">*</span></div>
            <div id="pastaContainer">
              <select id="pasta" class="input" required>
                <option value="">パスタを選択</option>
                ${masterData.pastas.map(p => {
                  const displayName = `${p.brand || 'ブランド未設定'} ${p.thickness_mm ? p.thickness_mm + 'mm' : ''}`
                  return `<option value="${p.id}" ${String(currentData.pasta?.id) === String(p.id) ? 'selected' : ''}>${displayName}</option>`
                }).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- チーズ -->
        <div class="card">
          <div class="font-semibold mb-2">チーズ</div>
          <select id="cheese" class="input" multiple size="3">
            ${masterData.cheeses.map(c => 
              `<option value="${c.id}" ${selectedCheeseIds.includes(String(c.id)) ? 'selected' : ''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>

        <!-- 塩分濃度 -->
        <div class="card">
          <div class="font-semibold mb-2">塩分濃度</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-sm mb-1">水(L)</label>
              <input type="number" id="waterAmount" class="input" step="0.1" min="0" placeholder="1.0" />
            </div>
            <div>
              <label class="block text-sm mb-1">塩(g)</label>
              <input type="number" id="saltAmount" class="input" step="1" min="0" placeholder="10" />
            </div>
          </div>
          <div id="saltPercentage" class="text-sm text-gray-600 mt-1"></div>
        </div>

        <!-- お玉 -->
        <div class="card">
          <div class="font-semibold mb-2">お玉（0.5単位）</div>
          <input type="number" id="ladle" class="input" step="0.5" min="0" placeholder="1.5" 
                 value="${currentData.ladle_half_units || ''}" />
        </div>

        <!-- 評価 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="card">
            <div class="font-semibold mb-2">総合評価</div>
            <div id="overallStars" class="flex gap-1 mb-2">
              ${[1,2,3,4,5].map(i => 
                `<button type="button" class="star-btn ${(currentData.rating_core?.overall >= i) ? 'active' : ''}" data-rating="${i}">★</button>`
              ).join('')}
            </div>
            <input type="hidden" id="overall" value="${currentData.rating_core?.overall || ''}" />
          </div>

          <div class="card">
            <div class="font-semibold mb-2">麺の堅さ</div>
            <div id="firmnessButtons" class="flex gap-2 flex-wrap mb-2">
              <button type="button" class="firmness-btn ${currentData.rating_core?.firmness === 1 ? 'active' : ''}" data-rating="1">やわらかい</button>
              <button type="button" class="firmness-btn ${currentData.rating_core?.firmness === 2 ? 'active' : ''}" data-rating="2">少しやわらかい</button>
              <button type="button" class="firmness-btn ${currentData.rating_core?.firmness === 3 ? 'active' : ''}" data-rating="3">ちょうどよい</button>
              <button type="button" class="firmness-btn ${currentData.rating_core?.firmness === 4 ? 'active' : ''}" data-rating="4">少しかたい</button>
              <button type="button" class="firmness-btn ${currentData.rating_core?.firmness === 5 ? 'active' : ''}" data-rating="5">かたい</button>
            </div>
            <input type="hidden" id="firmness" value="${currentData.rating_core?.firmness || ''}" />
          </div>
        </div>

        <!-- レシピ参考 -->
        <div class="card">
          <div class="font-semibold mb-2">レシピ参考</div>
          <input id="recipeReference" class="input" type="text" placeholder="参考にしたレシピのURL、書籍名、動画リンクなど" value="${currentData.recipe_reference || ''}" />
        </div>

        <!-- メモ -->
        <div class="card">
          <div class="font-semibold mb-2">メモ</div>
          <textarea id="feedback" class="input" rows="4" placeholder="感想など">${feedbackText}</textarea>
        </div>

        <div class="flex gap-3">
          <button type="submit" class="btn">保存</button>
          <button type="button" id="cancelEdit" class="btn">キャンセル</button>
        </div>
      </div>
    </form>
  `
  
  // イベントリスナーの設定
  setupEditFormEvents()
}

// 編集フォームのイベント設定
function setupEditFormEvents() {
  // 写真選択
  const photoInput = $('#photo')
  const cameraBtn = $('#cameraBtn')
  const galleryBtn = $('#galleryBtn')
  const photoPreview = $('#photoPreview')
  const previewImage = $('#previewImage')
  const removePhotoBtn = $('#removePhoto')

  cameraBtn.onclick = () => {
    photoInput.setAttribute('capture', 'environment')
    photoInput.setAttribute('accept', 'image/*')
    photoInput.click()
  }

  galleryBtn.onclick = () => {
    photoInput.removeAttribute('capture')
    photoInput.setAttribute('accept', 'image/*')
    photoInput.click()
  }

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

  removePhotoBtn.onclick = () => {
    photoInput.value = ''
    photoPreview.classList.add('hidden')
    previewImage.src = ''
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

  // 塩分濃度の計算
  function updateSaltPercentage() {
    const water = parseFloat($('#waterAmount').value) || 0
    const salt = parseFloat($('#saltAmount').value) || 0
    const percentage = water > 0 ? (salt / (water * 1000) * 100).toFixed(1) : 0
    $('#saltPercentage').textContent = water > 0 && salt > 0 ? `塩分濃度: ${percentage}%` : ''
  }

  $('#waterAmount').oninput = updateSaltPercentage
  $('#saltAmount').oninput = updateSaltPercentage

  // 現在の塩分濃度を逆算して表示
  if (currentData.boil_salt_pct) {
    // 1Lの水で逆算
    const water = 1.0
    const salt = (currentData.boil_salt_pct / 100) * (water * 1000)
    $('#waterAmount').value = water
    $('#saltAmount').value = Math.round(salt)
    updateSaltPercentage()
  }

  // キャンセルボタン
  $('#cancelEdit').onclick = () => {
    isEditMode = false
    load() // 表示モードに戻る
  }

  // フォーム送信
  $('#editForm').onsubmit = handleEditSubmit
}

// 写真アップロード関数
async function uploadPhoto(file, userId) {
  if (!file) return { path: null, url: null }
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${uuidv4()}.${ext}`
  const { error } = await supa.storage.from('pasta-photos').upload(path, file, { upsert: false, contentType: file.type })
  if (error) { 
    alert('写真アップロード失敗: ' + error.message)
    return { path: null, url: null }
  }
  const { data } = supa.storage.from('pasta-photos').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

// 編集フォームの送信処理
async function handleEditSubmit(e) {
  e.preventDefault()
  
  // 麺選択の必須チェック
  const pastaValue = $('#pasta').value
  if (!pastaValue) {
    alert('麺を選択してください')
    return
  }
  
  try {
    const userId = (await supa.auth.getUser()).data.user.id
    const photoFile = $('#photo').files[0]
    let photo = { path: currentData.photo_path, url: currentData.photo_url }
    
    // 新しい写真がある場合はアップロード
    if (photoFile) {
      // 既存の写真があれば削除
      if (currentData.photo_path) {
        await supa.storage.from('pasta-photos').remove([currentData.photo_path]).catch(() => {})
      }
      photo = await uploadPhoto(photoFile, userId)
    }

    const cheeseSel = Array.from($('#cheese').selectedOptions).map(o => o.value)

    // パスタ名をメモ欄に含める
    let feedbackText = $('#feedback').value || ''
    const pastaName = $('#pastaName').value
    if (pastaName) {
      feedbackText = `【${pastaName}】\n${feedbackText}`.trim()
    }

    // 塩分濃度を計算
    const water = parseFloat($('#waterAmount').value) || null
    const salt = parseFloat($('#saltAmount').value) || null
    const saltPct = (water && salt) ? (salt / (water * 1000) * 100) : null

    const updateData = {
      recipe_id: $('#recipe').value || null,
      pasta_kind_id: $('#pasta').value,
      cheese_kind_ids: cheeseSel,
      boil_salt_pct: saltPct,
      ladle_half_units: $('#ladle').value ? Number($('#ladle').value) : null,
      photo_path: photo.path,
      photo_url: photo.url,
      rating_core: {
        overall: $('#overall').value ? Number($('#overall').value) : null,
        firmness: $('#firmness').value ? Number($('#firmness').value) : null
      },
      feedback_text: feedbackText || null,
      recipe_reference: $('#recipeReference').value || null,
    }

    const { error } = await supa.from('pasta_logs').update(updateData).eq('id', id)
    
    if (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗: ' + error.message)
    } else {
      alert('保存しました')
      isEditMode = false
      load() // 表示モードに戻る
    }
  } catch (error) {
    console.error('編集エラー:', error)
    alert('編集に失敗しました: ' + error.message)
  }
}

async function load(){
  console.log('詳細画面: データ読み込み開始', { id })
  
  // マスターデータを読み込み
  if (!isEditMode) {
    await loadMasters()
  }
  
  const { data, error } = await supa
    .from('pasta_logs')
    .select(`
      id, taken_at, photo_url, photo_path, feedback_text, rating_core,
      boil_salt_pct, ladle_half_units, boil_start_ts, up_ts, combine_end_ts,
      recipe_reference, recipe:recipes(id,name), pasta:pasta_kinds(id,brand,thickness_mm)
    `)
    .eq('id', id)
    .single()

  console.log('詳細画面: クエリ結果', { data, error })

  if (error) {
    console.error('詳細画面: エラー詳細', error)
    $('#content').innerHTML = `<p class="text-red-600">読み込み失敗: ${error.message}</p>`
    return
  }

  // 現在のデータを保存
  currentData = data

  // cheeses は joinの仕方次第で配列にならない場合があるので、ログ側の cheese_kind_ids を直接読む方に変更
  // シンプルに関連名だけを表示する
  let cheeseNames = '-'
  // 代替: cheese_kind_idsから名称を取得
  const { data: logRow } = await supa.from('pasta_logs').select('cheese_kind_ids').eq('id', id).single()
  if (logRow?.cheese_kind_ids?.length) {
    const { data: cz } = await supa.from('cheeses').select('id,name').in('id', logRow.cheese_kind_ids)
    cheeseNames = (cz||[]).map(x=>x.name).join('、') || '-'
  }

  const imgUrl = await resolvePhotoUrl(data)
  
  // メモ欄からパスタ名を抽出
  let pastaName = ''
  let displayMemo = data.feedback_text || ''
  if (data.feedback_text && data.feedback_text.startsWith('【')) {
    const match = data.feedback_text.match(/^【(.+?)】\n?(.*)$/s)
    if (match) {
      pastaName = match[1]
      displayMemo = match[2]
    }
  }

  $('#content').innerHTML = `
    <div class="space-y-3">
      ${imgUrl ? `<img src="${imgUrl}" class="w-full max-h-80 object-cover rounded-xl border" />` : ''}
      <div class="text-sm text-gray-500">${fmt(data.taken_at)}</div>

      ${pastaName ? `<div class="text-lg font-bold">${pastaName}</div>` : ''}


      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card">
          <div class="font-semibold mb-2">基本情報</div>
          <div>カテゴリ：${data.recipe?.name ?? '-'}</div>
          <div>麺：${data.pasta ? `${data.pasta.brand || 'ブランド未設定'} ${data.pasta.thickness_mm ? data.pasta.thickness_mm + 'mm' : ''}` : '-'}</div>
          <div>チーズ：${cheeseNames}</div>
        </div>

        <div class="card">
          <div class="font-semibold mb-2">評価</div>
          <div>総合★：${data.rating_core?.overall ?? '-'}</div>
          <div>堅さ：${data.rating_core?.firmness ? firmnessToText(data.rating_core.firmness) : '-'}</div>
        </div>
      </div>

      <div class="card">
        <div class="font-semibold mb-2">工程・数値</div>
        <div>茹で塩(%)：${data.boil_salt_pct ? data.boil_salt_pct.toFixed(1) + '%' : '-'}</div>
        <div>お玉(0.5単位)：${data.ladle_half_units ?? '-'}</div>
        <div>B(茹で開始)：${fmt(data.boil_start_ts)}</div>
        <div>U(上げ)：${fmt(data.up_ts)}</div>
        <div>C(合わせ終了)：${fmt(data.combine_end_ts)}</div>
      </div>

      ${data.recipe_reference ? `
      <div class="card">
        <div class="font-semibold mb-2">レシピ参考</div>
        <div class="break-all">${data.recipe_reference.startsWith('http') ? 
          `<a href="${data.recipe_reference}" target="_blank" class="text-blue-600 hover:underline">${data.recipe_reference}</a>` : 
          data.recipe_reference
        }</div>
      </div>` : ''}

      <div class="card">
        <div class="font-semibold mb-2">メモ</div>
        <div class="whitespace-pre-wrap">${(displayMemo || '-')
          .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</div>
      </div>
    </div>
  `

  // 編集ボタン
  document.getElementById('editBtn').onclick = async () => {
    isEditMode = true
    await showEditForm()
  }

  // 削除ボタン
  document.getElementById('deleteBtn').onclick = async () => {
    if (!confirm('この記録を削除します。よろしいですか？')) return
    // 画像も消す（あれば）
    if (data.photo_path) {
      await supa.storage.from('pasta-photos').remove([data.photo_path]).catch(()=>{})
    }
    const { error: delErr } = await supa.from('pasta_logs').delete().eq('id', id)
    if (delErr) { alert('削除に失敗: '+delErr.message); return }
    alert('削除しました'); location.href = '/log-list.html'
  }
}

load()
