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
let masterData = { pastas: [] }

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
  const { data: pastas } = await supa.from('pasta_kinds')
    .select('id,brand,thickness_mm,purchase_location,image_path,image_url')
    .eq('is_active', true)
    .order('brand')
    .order('thickness_mm')

  masterData = {
    pastas: pastas || []
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

  // パスタ名とフィードバックテキストを取得
  const pastaName = currentData.title || ''
  const feedbackText = currentData.feedback_text || ''

  const imgUrl = await resolvePhotoUrl(currentData)
  
  // データから値を復元
  const coreIngredients = currentData.core_ingredients || {}
  const subIngredients = currentData.sub_ingredients || {}
  const aromaIngredients = currentData.aroma_ingredients || {}
  const umamiIngredients = currentData.umami_ingredients || []
  const otherIngredients = currentData.other_ingredients || []

  $('#content').innerHTML = `
    <form id="editForm" class="space-y-4">
      <div class="space-y-3">
        ${imgUrl ? `<img src="${imgUrl}" class="w-full max-h-80 object-cover rounded-xl border" />` : ''}

        <!-- 写真選択 -->
        <div>
          <label class="label">写真</label>
          <div class="space-y-2">
            <div class="flex gap-2">
              <button type="button" id="cameraBtn" class="btn flex-1">📷 カメラで撮影</button>
              <button type="button" id="galleryBtn" class="btn flex-1">🖼️ ギャラリーから選択</button>
            </div>
            <input type="file" id="photo" accept="image/*" class="input hidden">
            <div id="photoPreview" class="hidden">
              <img id="previewImage" class="w-full max-w-xs h-auto rounded-lg border">
              <button type="button" id="removePhoto" class="btn text-sm mt-1">写真を削除</button>
            </div>
          </div>
        </div>

        <!-- パスタ名 -->
        <div>
          <label class="label">パスタ名</label>
          <input id="pastaName" class="input" placeholder="ナスとアンチョビのペペロンチーノ" value="${pastaName}">
        </div>

        <!-- 麺セクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">麺</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">麺の種類 <span class="text-red-500">*</span></label>
              <select id="pasta" class="input" required>
                <option value="">パスタを選択</option>
                ${masterData.pastas.map(p => {
                  const displayName = `${p.brand || 'ブランド未設定'} ${p.thickness_mm ? p.thickness_mm + 'mm' : ''}`
                  return `<option value="${p.id}" ${String(currentData.pasta?.id) === String(p.id) ? 'selected' : ''}>${displayName}</option>`
                }).join('')}
              </select>
            </div>
            <div>
              <label class="label">グラム数 <span class="text-red-500">*</span></label>
              <div class="flex items-center gap-2">
                <button type="button" id="pastaAmountMinus" class="btn w-8 h-8 flex items-center justify-center p-0">-</button>
                <input id="pastaAmount" type="number" min="50" max="150" step="10" value="${currentData.pasta_amount_g || 80}" class="input text-center" required>
                <button type="button" id="pastaAmountPlus" class="btn w-8 h-8 flex items-center justify-center p-0">+</button>
                <span class="text-sm text-gray-600">g</span>
              </div>
              <div class="grid grid-cols-4 gap-1 mt-1">
                <button type="button" class="amount-preset-btn btn text-xs py-1" data-amount="70">70g</button>
                <button type="button" class="amount-preset-btn btn text-xs py-1" data-amount="80">80g</button>
                <button type="button" class="amount-preset-btn btn text-xs py-1" data-amount="90">90g</button>
                <button type="button" class="amount-preset-btn btn text-xs py-1" data-amount="100">100g</button>
              </div>
            </div>
          </div>
        </section>

        <!-- 茹で時間設定 -->
        <div>
          <label class="label">茹で時間</label>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 flex-1">
                <button type="button" id="boilMinuteMinus" class="btn w-6 h-6 flex items-center justify-center p-0 text-xs">-</button>
                <input id="boilMinutes" type="number" min="0" max="9" value="8" class="input text-center w-12 text-sm">
                <button type="button" id="boilMinutePlus" class="btn w-6 h-6 flex items-center justify-center p-0 text-xs">+</button>
                <span class="text-xs text-gray-600">分</span>
              </div>
              <div class="flex items-center gap-1 flex-1">
                <button type="button" id="boilSecondMinus" class="btn w-6 h-6 flex items-center justify-center p-0 text-xs">-</button>
                <input id="boilSeconds" type="number" min="0" max="59" step="10" value="0" class="input text-center w-12 text-sm">
                <button type="button" id="boilSecondPlus" class="btn w-6 h-6 flex items-center justify-center p-0 text-xs">+</button>
                <span class="text-xs text-gray-600">秒</span>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1 text-xs">
              <button type="button" class="boil-preset-btn btn py-1 px-1" data-minutes="6" data-seconds="30">6:30</button>
              <button type="button" class="boil-preset-btn btn py-1 px-1" data-minutes="7" data-seconds="0">7:00</button>
              <button type="button" class="boil-preset-btn btn py-1 px-1" data-minutes="8" data-seconds="0">8:00</button>
              <button type="button" class="boil-preset-btn btn py-1 px-1" data-minutes="9" data-seconds="0">9:00</button>
            </div>
            <input id="boilTime" type="hidden" value="480">
          </div>
        </div>

        <!-- 水量・塩・茹で汁 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="label">水量(L)</label>
            <input id="waterAmount" type="number" step="0.1" class="input" placeholder="1.0" value="${currentData.water_amount_l || ''}">
            <div class="grid grid-cols-4 gap-1 mt-1">
              <button type="button" class="water-preset-btn btn text-xs py-1" data-water="1.0">1.0L</button>
              <button type="button" class="water-preset-btn btn text-xs py-1" data-water="1.5">1.5L</button>
              <button type="button" class="water-preset-btn btn text-xs py-1" data-water="2.0">2.0L</button>
              <button type="button" class="water-preset-btn btn text-xs py-1" data-water="2.5">2.5L</button>
            </div>
          </div>
          <div><label class="label">塩(g)</label><input id="saltAmount" type="number" step="1" class="input" placeholder="12"></div>
          <div><label class="label">茹で汁(お玉0.5)</label><input id="ladle" type="number" step="0.5" class="input" placeholder="1.0" value="${currentData.ladle_half_units || ''}"></div>
        </div>

        <div class="text-sm text-gray-500" id="saltPercentage"></div>

        <!-- 5大要素セクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">5大要素（使った項目のみ）</h3>
          <div class="space-y-3">
            <!-- トマト -->
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedPomodoro" class="mt-1" ${coreIngredients.pomodoro?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedPomodoro" class="label cursor-pointer">トマト（Pomodoro）</label>
                <select id="pomodoroDetail" class="input text-sm ${coreIngredients.pomodoro?.used ? '' : 'hidden'}" ${coreIngredients.pomodoro?.used ? '' : 'disabled'}>
                  <option value="">選択してください</option>
                  <option value="ソース" ${coreIngredients.pomodoro?.detail === 'ソース' ? 'selected' : ''}>ソース</option>
                  <option value="ホール缶" ${coreIngredients.pomodoro?.detail === 'ホール缶' ? 'selected' : ''}>ホール缶</option>
                  <option value="生トマト" ${coreIngredients.pomodoro?.detail === '生トマト' ? 'selected' : ''}>生トマト</option>
                  <option value="その他" ${coreIngredients.pomodoro?.detail === 'その他' ? 'selected' : ''}>その他</option>
                </select>
              </div>
            </div>

            <!-- にんにく -->
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedAglio" class="mt-1" ${coreIngredients.aglio?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedAglio" class="label cursor-pointer">にんにく（Aglio）</label>
                <select id="aglioDetail" class="input text-sm ${coreIngredients.aglio?.used ? '' : 'hidden'}" ${coreIngredients.aglio?.used ? '' : 'disabled'}>
                  <option value="">選択してください</option>
                  <option value="スライス" ${coreIngredients.aglio?.detail === 'スライス' ? 'selected' : ''}>スライス</option>
                  <option value="みじん切り" ${coreIngredients.aglio?.detail === 'みじん切り' ? 'selected' : ''}>みじん切り</option>
                  <option value="ホールをつぶす" ${coreIngredients.aglio?.detail === 'ホールをつぶす' ? 'selected' : ''}>ホールをつぶす</option>
                  <option value="その他" ${coreIngredients.aglio?.detail === 'その他' ? 'selected' : ''}>その他</option>
                </select>
              </div>
            </div>

            <!-- オリーブオイル -->
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedOlio" class="mt-1" ${coreIngredients.olio?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedOlio" class="label cursor-pointer">オリーブオイル（Olio d'Oliva）</label>
                <select id="olioDetail" class="input text-sm ${coreIngredients.olio?.used ? '' : 'hidden'}" ${coreIngredients.olio?.used ? '' : 'disabled'}>
                  <option value="">選択してください</option>
                  <option value="加熱用のみ" ${coreIngredients.olio?.detail === '加熱用のみ' ? 'selected' : ''}>加熱用のみ</option>
                  <option value="仕上げ用のみ" ${coreIngredients.olio?.detail === '仕上げ用のみ' ? 'selected' : ''}>仕上げ用のみ</option>
                  <option value="両方" ${coreIngredients.olio?.detail === '両方' ? 'selected' : ''}>両方</option>
                </select>
              </div>
            </div>

            <!-- バター -->
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedBurro" class="mt-1" ${coreIngredients.burro?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedBurro" class="label cursor-pointer">バター（Burro）</label>
                <input id="burroDetail" type="text" class="input text-sm ${coreIngredients.burro?.used ? '' : 'hidden'}" placeholder="ブランド名など" ${coreIngredients.burro?.used ? '' : 'disabled'} value="${coreIngredients.burro?.detail || ''}">
              </div>
            </div>

            <!-- パルミジャーノ -->
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedParmigiano" class="mt-1" ${coreIngredients.parmigiano?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedParmigiano" class="label cursor-pointer">パルミジャーノ（Parmigiano）</label>
                <select id="parmigianoDetail" class="input text-sm ${coreIngredients.parmigiano?.used ? '' : 'hidden'}" ${coreIngredients.parmigiano?.used ? '' : 'disabled'}>
                  <option value="">選択してください</option>
                  <option value="ブロック削り" ${coreIngredients.parmigiano?.detail === 'ブロック削り' ? 'selected' : ''}>ブロック削り</option>
                  <option value="パウダー" ${coreIngredients.parmigiano?.detail === 'パウダー' ? 'selected' : ''}>パウダー</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <!-- サブ要素セクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">サブ要素（使った項目のみ）</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedChiliOil" class="mt-1" ${subIngredients.chili_oil?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedChiliOil" class="label cursor-pointer">唐辛子オイル</label>
                <input id="chiliOilNote" type="text" class="input text-sm ${subIngredients.chili_oil?.used ? '' : 'hidden'}" placeholder="メモ（任意）" ${subIngredients.chili_oil?.used ? '' : 'disabled'} value="${subIngredients.chili_oil?.note || ''}">
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedAnchovy" class="mt-1" ${subIngredients.anchovy?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedAnchovy" class="label cursor-pointer">アンチョビ</label>
                <input id="anchovyNote" type="text" class="input text-sm ${subIngredients.anchovy?.used ? '' : 'hidden'}" placeholder="メモ（任意）" ${subIngredients.anchovy?.used ? '' : 'disabled'} value="${subIngredients.anchovy?.note || ''}">
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedCheeses" class="mt-1" ${subIngredients.cheeses?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedCheeses" class="label cursor-pointer">チーズ各種</label>
                <input id="cheesesItems" type="text" class="input text-sm ${subIngredients.cheeses?.used ? '' : 'hidden'}" placeholder="種類をカンマ区切りで（例：ペコリーノ、ゴルゴンゾーラ）" ${subIngredients.cheeses?.used ? '' : 'disabled'} value="${subIngredients.cheeses?.items?.join(', ') || ''}">
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" id="usedCream" class="mt-1" ${subIngredients.cream?.used ? 'checked' : ''}>
              <div class="flex-1">
                <label for="usedCream" class="label cursor-pointer">生クリーム</label>
                <input id="creamNote" type="text" class="input text-sm ${subIngredients.cream?.used ? '' : 'hidden'}" placeholder="メモ（任意）" ${subIngredients.cream?.used ? '' : 'disabled'} value="${subIngredients.cream?.note || ''}">
              </div>
            </div>
          </div>
        </section>

        <!-- 香り要素セクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">香り要素</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaItalianParsley" ${aromaIngredients.italian_parsley ? 'checked' : ''}>
              <span class="text-sm">イタリアンパセリ</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaBasil" ${aromaIngredients.basil ? 'checked' : ''}>
              <span class="text-sm">バジル</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaRosemary" ${aromaIngredients.rosemary ? 'checked' : ''}>
              <span class="text-sm">ローズマリー</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaSage" ${aromaIngredients.sage ? 'checked' : ''}>
              <span class="text-sm">セージ</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaLemon" ${aromaIngredients.lemon ? 'checked' : ''}>
              <span class="text-sm">レモン</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="aromaBlackPepper" ${aromaIngredients.black_pepper ? 'checked' : ''}>
              <span class="text-sm">黒胡椒</span>
            </label>
          </div>
          <div>
            <label class="label">その他の香り要素</label>
            <input id="aromaOther" type="text" class="input text-sm" placeholder="例：オレガノ、タイム" value="${aromaIngredients.other || ''}">
          </div>
        </section>

        <!-- 具材セクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">具材</h3>
          <div>
            <label class="label">旨味系具材</label>
            <input id="umamiIngredients" type="text" class="input" placeholder="例：グアンチャーレ、パンチェッタ、生ハム、牡蠣（カンマ区切り）" value="${umamiIngredients.join(', ')}">
            <p class="text-xs text-gray-500 mt-1">ソース構成に影響する具材を記録</p>
          </div>
          <div>
            <label class="label">その他具材</label>
            <input id="otherIngredients" type="text" class="input" placeholder="例：ナス、ズッキーニ、エビ（カンマ区切り）" value="${otherIngredients.join(', ')}">
            <p class="text-xs text-gray-500 mt-1">野菜、魚介など</p>
          </div>
        </section>

        <!-- 評価スコアセクション -->
        <section class="card space-y-4">
          <h3 class="text-lg font-semibold">評価スコア（5段階）</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">麺の質</label>
              <div class="flex gap-1" id="pastaQualityStars">
                ${[1,2,3,4,5].map(i =>
                  `<button type="button" class="star-btn ${(currentData.rating_core?.pasta_quality >= i) ? 'active' : ''}" data-rating="${i}">★</button>`
                ).join('')}
              </div>
              <input id="pastaQuality" type="hidden" value="${currentData.rating_core?.pasta_quality || ''}">
            </div>
            <div>
              <label class="label">塩加減</label>
              <div class="flex gap-1" id="saltBalanceStars">
                ${[1,2,3,4,5].map(i =>
                  `<button type="button" class="star-btn ${(currentData.rating_core?.salt_balance >= i) ? 'active' : ''}" data-rating="${i}">★</button>`
                ).join('')}
              </div>
              <input id="saltBalance" type="hidden" value="${currentData.rating_core?.salt_balance || ''}">
            </div>
            <div>
              <label class="label">ソース・食材のバランス</label>
              <div class="flex gap-1" id="sauceBalanceStars">
                ${[1,2,3,4,5].map(i =>
                  `<button type="button" class="star-btn ${(currentData.rating_core?.sauce_balance >= i) ? 'active' : ''}" data-rating="${i}">★</button>`
                ).join('')}
              </div>
              <input id="sauceBalance" type="hidden" value="${currentData.rating_core?.sauce_balance || ''}">
            </div>
            <div>
              <label class="label">全体の完成度</label>
              <div class="flex gap-1" id="overallStars">
                ${[1,2,3,4,5].map(i =>
                  `<button type="button" class="star-btn ${(currentData.rating_core?.overall >= i) ? 'active' : ''}" data-rating="${i}">★</button>`
                ).join('')}
              </div>
              <input id="overall" type="hidden" value="${currentData.rating_core?.overall || ''}">
            </div>
          </div>
        </section>

        <div>
          <label class="label">レシピ参考</label>
          <input id="recipeReference" type="text" class="input" placeholder="参考にしたレシピのURL、書籍名、動画リンクなど" value="${currentData.recipe_reference || ''}">
        </div>

        <div>
          <label class="label">前回から変えたこと・今回の気づき</label>
          <textarea id="feedback" rows="3" class="input" placeholder="例：茹で汁の量を前回より増やした／にんにくをみじん切りに変えた／塩を控えめにした">${feedbackText}</textarea>
        </div>

        <div class="flex gap-3">
          <button type="submit" class="btn btn-primary">保存</button>
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

  // 4つの評価スコアの設定
  setupStarRating('#pastaQualityStars', '#pastaQuality')
  setupStarRating('#saltBalanceStars', '#saltBalance')
  setupStarRating('#sauceBalanceStars', '#sauceBalance')
  setupStarRating('#overallStars', '#overall')

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
      document.querySelectorAll('.amount-preset-btn').forEach(b => b.classList.remove('btn-primary'))
      btn.classList.add('btn-primary')
    }
  })

  // 茹で時間管理
  const boilTimeInput = $('#boilTime')
  const boilMinutesInput = $('#boilMinutes')
  const boilSecondsInput = $('#boilSeconds')

  function updateBoilTimeTotal() {
    const minutes = parseInt(boilMinutesInput.value) || 0
    const seconds = parseInt(boilSecondsInput.value) || 0
    const totalSeconds = minutes * 60 + seconds
    boilTimeInput.value = totalSeconds
  }

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

  // 茹で時間プリセットボタン
  document.querySelectorAll('.boil-preset-btn').forEach(btn => {
    btn.onclick = () => {
      boilMinutesInput.value = btn.dataset.minutes
      boilSecondsInput.value = btn.dataset.seconds
      updateBoilTimeTotal()
      document.querySelectorAll('.boil-preset-btn').forEach(b => b.classList.remove('btn-primary'))
      btn.classList.add('btn-primary')
    }
  })

  boilMinutesInput.oninput = updateBoilTimeTotal
  boilSecondsInput.oninput = updateBoilTimeTotal
  updateBoilTimeTotal()

  // 水量プリセットボタン
  document.querySelectorAll('.water-preset-btn').forEach(btn => {
    btn.onclick = () => {
      $('#waterAmount').value = btn.dataset.water
      updateSaltPercentage()
      document.querySelectorAll('.water-preset-btn').forEach(b => b.classList.remove('btn-primary'))
      btn.classList.add('btn-primary')
    }
  })

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
    const water = currentData.water_amount_l || 1.0
    const salt = (currentData.boil_salt_pct / 100) * (water * 1000)
    if (!$('#waterAmount').value) $('#waterAmount').value = water
    if (!$('#saltAmount').value) $('#saltAmount').value = Math.round(salt)
    updateSaltPercentage()
  }

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

  // グラム数の必須チェック
  const pastaAmount = parseInt($('#pastaAmount').value)
  if (!pastaAmount || pastaAmount < 50 || pastaAmount > 150) {
    alert('グラム数を入力してください (50-150g)')
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

    const updateData = {
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
      id, taken_at, photo_url, photo_path, title, feedback_text, rating_core,
      boil_salt_pct, ladle_half_units, boil_start_ts, up_ts, combine_end_ts,
      recipe_reference, pasta_amount_g, water_amount_l,
      core_ingredients, sub_ingredients, aroma_ingredients,
      umami_ingredients, other_ingredients,
      pasta:pasta_kinds(id,brand,thickness_mm)
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

  const imgUrl = await resolvePhotoUrl(data)

  // パスタ名とメモを取得
  const pastaName = data.title || ''
  const displayMemo = data.feedback_text || ''

  $('#content').innerHTML = `
    <div class="space-y-3">
      ${imgUrl ? `<img src="${imgUrl}" class="w-full max-h-80 object-cover rounded-xl border" />` : ''}
      <div class="text-sm text-gray-500">${fmt(data.taken_at)}</div>

      ${pastaName ? `<div class="text-lg font-bold">${pastaName}</div>` : ''}


      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card">
          <div class="font-semibold mb-2">基本情報</div>
          <div>麺：${data.pasta ? `${data.pasta.brand || 'ブランド未設定'} ${data.pasta.thickness_mm ? data.pasta.thickness_mm + 'mm' : ''}` : '-'}</div>
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
