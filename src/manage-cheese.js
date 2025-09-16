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
let editingCheese = null
let currentFilter = {}

// チーズ種類の読み込み
async function loadCheeses(filter = {}) {
  let query = supa
    .from('cheeses')
    .select('id, name, manufacturer, purchase_location, is_active, image_path, image_url')
    .order('name')

  // フィルター適用
  if (filter.name) {
    query = query.ilike('name', `%${filter.name}%`)
  }
  if (filter.manufacturer) {
    query = query.ilike('manufacturer', `%${filter.manufacturer}%`)
  }
  if (filter.location) {
    query = query.ilike('purchase_location', `%${filter.location}%`)
  }

  const { data, error } = await query

  if (error) {
    alert('チーズ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#cheeseList')
  const count = $('#cheeseCount')
  count.textContent = data?.length || 0

  list.innerHTML = ''

  for (const cheese of (data || [])) {
    let imgUrl = null
    if (cheese.image_url) {
      imgUrl = cheese.image_url
    } else if (cheese.image_path) {
      const { data: urlData } = await supa.storage.from('pasta-images').createSignedUrl(cheese.image_path, 3600)
      if (urlData) imgUrl = urlData.signedUrl
    }

    const div = document.createElement('div')
    div.className = `flex items-center justify-between p-4 border rounded-xl bg-white hover:shadow-md transition-shadow`
    div.innerHTML = `
      <div class="flex items-center gap-4 flex-1">
        ${imgUrl ? `<img src="${imgUrl}" class="w-16 h-16 object-cover rounded-lg border" />` : '<div class="w-16 h-16 bg-gray-200 rounded-lg border flex items-center justify-center text-gray-400 text-xs">画像なし</div>'}
        <div class="flex-1">
          <div class="font-semibold text-lg">${cheese.name}</div>
          <div class="text-gray-600">
            ${cheese.manufacturer ? `メーカー: ${cheese.manufacturer}` : 'メーカー未設定'}
          </div>
          <div class="text-gray-500 text-sm">
            ${cheese.purchase_location ? `購入場所: ${cheese.purchase_location}` : '購入場所未設定'}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn bg-blue-100 text-blue-600"
                onclick="editCheese('${cheese.id}')">
          編集
        </button>
        <button class="btn bg-red-100 text-red-600"
                onclick="deleteCheese('${cheese.id}')">
          削除
        </button>
      </div>
    `
    list.appendChild(div)
  }
}

// チーズ追加/更新
$('#addCheese').onclick = async () => {
  const name = $('#cheeseName').value.trim()
  if (!name) {
    alert('チーズ名を入力してください')
    return
  }

  const userId = (await supa.auth.getUser()).data.user.id
  const imageFile = $('#cheeseImage').files[0]
  const image = await uploadImage(imageFile, userId, 'cheese')

  const data = {
    name,
    manufacturer: $('#cheeseManufacturer').value || null,
    purchase_location: $('#cheesePurchaseLocation').value || null,
    is_active: true
  }

  if (image.path) {
    data.image_path = image.path
    data.image_url = image.url
  }

  let error
  if (editingCheese) {
    // 更新
    const { error: updateError } = await supa
      .from('cheeses')
      .update(data)
      .eq('id', editingCheese)
    error = updateError
  } else {
    // 新規追加
    const { error: insertError } = await supa.from('cheeses').insert(data)
    error = insertError
  }

  if (error) {
    alert((editingCheese ? '更新' : '追加') + 'に失敗: ' + error.message)
  } else {
    clearCheeseForm()
    loadCheeses(currentFilter)
  }
}

// チーズフォームクリア
function clearCheeseForm() {
  $('#cheeseName').value = ''
  $('#cheeseManufacturer').value = ''
  $('#cheesePurchaseLocation').value = ''
  $('#cheeseImage').value = ''
  editingCheese = null
  $('#addCheese').textContent = '追加'
  $('#cancelCheeseEdit').style.display = 'none'
}

// チーズ編集
window.editCheese = async (id) => {
  const { data } = await supa.from('cheeses').select('*').eq('id', id).single()
  if (data) {
    $('#cheeseName').value = data.name || ''
    $('#cheeseManufacturer').value = data.manufacturer || ''
    $('#cheesePurchaseLocation').value = data.purchase_location || ''
    editingCheese = id
    $('#addCheese').textContent = '更新'
    $('#cancelCheeseEdit').style.display = 'inline-flex'
  }
}

// チーズ編集キャンセル
$('#cancelCheeseEdit').onclick = () => {
  clearCheeseForm()
}

// チーズの削除
window.deleteCheese = async (id) => {
  if (!confirm('このチーズを削除しますか？')) return

  const { error } = await supa
    .from('cheeses')
    .delete()
    .eq('id', id)

  if (error) {
    alert('削除に失敗: ' + error.message)
  } else {
    loadCheeses(currentFilter)
  }
}

// フィルター適用
$('#applyFilter').onclick = () => {
  const filter = {}

  const name = $('#nameFilter').value.trim()
  const manufacturer = $('#manufacturerFilter').value.trim()
  const location = $('#locationFilter').value.trim()

  if (name) filter.name = name
  if (manufacturer) filter.manufacturer = manufacturer
  if (location) filter.location = location

  currentFilter = filter
  loadCheeses(filter)
}

// フィルタークリア
$('#clearFilter').onclick = () => {
  $('#nameFilter').value = ''
  $('#manufacturerFilter').value = ''
  $('#locationFilter').value = ''
  currentFilter = {}
  loadCheeses()
}

// 初期読み込み
loadCheeses()