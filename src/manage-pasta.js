import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'
import { v4 as uuidv4 } from 'uuid'

const $ = (s) => document.querySelector(s)

// 画像アップロード関数
async function uploadImage(file, userId, folder){
  if(!file) return { path: null, url: null }
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${folder}/${userId}/${uuidv4()}.${ext}`
  const { error } = await supa.storage.from('pasta-images').upload(path, file, { upsert:false, contentType:file.type })
  if(error){ alert('画像アップロード失敗: '+error.message); return { path:null, url:null } }
  const { data } = supa.storage.from('pasta-images').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

// 編集状態の管理
let editingPasta = null
let currentFilter = {}

// 太さ選択ボタンの設定
document.querySelectorAll('.thickness-btn').forEach(btn => {
  btn.onclick = () => {
    const thickness = btn.dataset.thickness
    $('#pastaThickness').value = thickness
    // アクティブ状態の表示
    document.querySelectorAll('.thickness-btn').forEach(b => b.classList.remove('btn-primary'))
    btn.classList.add('btn-primary')
  }
})


// パスタ種類の読み込み
async function loadPastas(filter = {}) {
  let query = supa
    .from('pasta_kinds')
    .select('id, thickness_mm, brand, purchase_location, is_active, image_path, image_url')
    .order('brand')
    .order('thickness_mm')

  // フィルター適用
  if (filter.thicknessMin !== undefined) {
    query = query.gte('thickness_mm', filter.thicknessMin)
  }
  if (filter.thicknessMax !== undefined) {
    query = query.lte('thickness_mm', filter.thicknessMax)
  }
  if (filter.brand) {
    query = query.ilike('brand', `%${filter.brand}%`)
  }
  if (filter.location) {
    query = query.ilike('purchase_location', `%${filter.location}%`)
  }

  const { data, error } = await query

  if (error) {
    alert('パスタ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#pastaList')
  const count = $('#pastaCount')
  count.textContent = data?.length || 0

  list.innerHTML = ''

  for (const pasta of (data || [])) {
    let imgUrl = null
    if (pasta.image_url) {
      imgUrl = pasta.image_url
    } else if (pasta.image_path) {
      const { data: urlData } = await supa.storage.from('pasta-images').createSignedUrl(pasta.image_path, 3600)
      if (urlData) imgUrl = urlData.signedUrl
    }

    const div = document.createElement('div')
    div.className = `flex items-center justify-between p-4 border rounded-xl bg-white hover:shadow-md transition-shadow`
    div.innerHTML = `
      <div class="flex items-center gap-4 flex-1">
        ${imgUrl ? `<img src="${imgUrl}" class="w-16 h-16 object-cover rounded-lg border" />` : '<div class="w-16 h-16 bg-gray-200 rounded-lg border flex items-center justify-center text-gray-400 text-xs">画像なし</div>'}
        <div class="flex-1">
          <div class="font-semibold text-lg">
            ${pasta.brand || 'ブランド未設定'}
          </div>
          <div class="text-gray-600">
            ${pasta.thickness_mm ? `太さ: ${pasta.thickness_mm}mm` : '太さ未設定'}
          </div>
          <div class="text-gray-500 text-sm">
            ${pasta.purchase_location ? `購入場所: ${pasta.purchase_location}` : '購入場所未設定'}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn bg-blue-100 text-blue-600"
                onclick="editPasta('${pasta.id}')">
          編集
        </button>
        <button class="btn bg-red-100 text-red-600"
                onclick="deletePasta('${pasta.id}')">
          削除
        </button>
      </div>
    `
    list.appendChild(div)
  }
}

// パスタ追加/更新
$('#addPasta').onclick = async () => {
  const brand = $('#pastaBrand').value.trim()
  const thickness = $('#pastaThickness').value
  if (!brand && !thickness) {
    alert('ブランドまたは太さを入力してください')
    return
  }

  const userId = (await supa.auth.getUser()).data.user.id
  const imageFile = $('#pastaImage').files[0]
  const image = await uploadImage(imageFile, userId, 'pasta')

  const data = {
    thickness_mm: $('#pastaThickness').value ? parseFloat($('#pastaThickness').value) : null,
    brand: $('#pastaBrand').value || null,
    purchase_location: $('#pastaPurchaseLocation').value || null,
    is_active: true
  }

  if (image.path) {
    data.image_path = image.path
    data.image_url = image.url
  }

  let error
  if (editingPasta) {
    // 更新
    const { error: updateError } = await supa
      .from('pasta_kinds')
      .update(data)
      .eq('id', editingPasta)
    error = updateError
  } else {
    // 新規追加
    const { error: insertError } = await supa.from('pasta_kinds').insert(data)
    error = insertError
  }

  if (error) {
    alert((editingPasta ? '更新' : '追加') + 'に失敗: ' + error.message)
  } else {
    clearPastaForm()
    loadPastas(currentFilter)
  }
}

// パスタフォームクリア
function clearPastaForm() {
  $('#pastaBrand').value = ''
  $('#pastaPurchaseLocation').value = ''
  $('#pastaThickness').value = ''
  $('#pastaImage').value = ''
  document.querySelectorAll('.thickness-btn').forEach(b => b.classList.remove('btn-primary'))
  editingPasta = null
  $('#addPasta').textContent = '追加'
  $('#cancelPastaEdit').style.display = 'none'
}

// パスタ編集
window.editPasta = async (id) => {
  const { data } = await supa.from('pasta_kinds').select('*').eq('id', id).single()
  if (data) {
    $('#pastaBrand').value = data.brand || ''
    $('#pastaPurchaseLocation').value = data.purchase_location || ''
    $('#pastaThickness').value = data.thickness_mm || ''

    // 太さボタンの状態更新
    document.querySelectorAll('.thickness-btn').forEach(b => {
      b.classList.remove('btn-primary')
      if (b.dataset.thickness === String(data.thickness_mm)) {
        b.classList.add('btn-primary')
      }
    })

    editingPasta = id
    $('#addPasta').textContent = '更新'
    $('#cancelPastaEdit').style.display = 'inline-flex'
  }
}

// パスタ編集キャンセル
$('#cancelPastaEdit').onclick = () => {
  clearPastaForm()
}

// パスタの削除
window.deletePasta = async (id) => {
  if (!confirm('このパスタを削除しますか？')) return

  const { error } = await supa
    .from('pasta_kinds')
    .delete()
    .eq('id', id)

  if (error) {
    alert('削除に失敗: ' + error.message)
  } else {
    loadPastas(currentFilter)
  }
}

// フィルター適用
$('#applyFilter').onclick = () => {
  const filter = {}

  const thicknessMin = $('#thicknessMin').value
  const thicknessMax = $('#thicknessMax').value
  const brand = $('#brandFilter').value.trim()
  const location = $('#locationFilter').value.trim()

  if (thicknessMin) filter.thicknessMin = parseFloat(thicknessMin)
  if (thicknessMax) filter.thicknessMax = parseFloat(thicknessMax)
  if (brand) filter.brand = brand
  if (location) filter.location = location

  currentFilter = filter
  loadPastas(filter)
}

// フィルタークリア
$('#clearFilter').onclick = () => {
  $('#thicknessMin').value = ''
  $('#thicknessMax').value = ''
  $('#brandFilter').value = ''
  $('#locationFilter').value = ''
  currentFilter = {}
  loadPastas()
}

// 初期読み込み
loadPastas()