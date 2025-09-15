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
let editingCheese = null
let editingRecipe = null

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
async function loadPastas() {
  const { data, error } = await supa
    .from('pasta_kinds')
    .select('id, thickness_mm, brand, purchase_location, is_active, image_path, image_url')
    .order('brand')
    .order('thickness_mm')
  
  if (error) {
    alert('パスタ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#pastaList')
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
    div.className = `flex items-center justify-between p-3 border rounded-xl bg-white`
    div.innerHTML = `
      <div class="flex items-center gap-3">
        ${imgUrl ? `<img src="${imgUrl}" class="w-12 h-12 object-cover rounded-lg border" />` : '<div class="w-12 h-12 bg-gray-200 rounded-lg border flex items-center justify-center text-gray-400 text-xs">画像なし</div>'}
        <div class="flex-1">
          <div class="font-semibold">
            ${pasta.brand || 'ブランド未設定'} ${pasta.thickness_mm ? pasta.thickness_mm + 'mm' : ''}
          </div>
          <div class="text-gray-500 text-sm">
            ${pasta.purchase_location ? `購入場所: ${pasta.purchase_location}` : ''}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn text-sm bg-blue-100 text-blue-600"
                onclick="editPasta('${pasta.id}')">
          編集
        </button>
        <button class="btn text-sm bg-red-100 text-red-600"
                onclick="deletePasta('${pasta.id}')">
          削除
        </button>
      </div>
    `
    list.appendChild(div)
  }
}

// チーズ種類の読み込み
async function loadCheeses() {
  const { data, error } = await supa
    .from('cheeses')
    .select('id, name, manufacturer, purchase_location, is_active, image_path, image_url')
    .order('name')
  
  if (error) {
    alert('チーズ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#cheeseList')
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
    div.className = `flex items-center justify-between p-3 border rounded-xl bg-white`
    div.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        ${imgUrl ? `<img src="${imgUrl}" class="w-12 h-12 object-cover rounded-lg border" />` : '<div class="w-12 h-12 bg-gray-200 rounded-lg border flex items-center justify-center text-gray-400 text-xs">画像なし</div>'}
        <div class="flex-1">
          <div class="font-semibold">${cheese.name}</div>
          <div class="text-gray-500 text-sm">
            ${cheese.manufacturer ? `メーカー: ${cheese.manufacturer}` : ''}
            ${cheese.manufacturer && cheese.purchase_location ? ' | ' : ''}
            ${cheese.purchase_location ? `購入場所: ${cheese.purchase_location}` : ''}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn text-sm bg-blue-100 text-blue-600"
                onclick="editCheese('${cheese.id}')">
          編集
        </button>
        <button class="btn text-sm bg-red-100 text-red-600"
                onclick="deleteCheese('${cheese.id}')">
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
    loadPastas()
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
    loadCheeses()
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
    loadPastas()
  }
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
    loadCheeses()
  }
}

// カテゴリ（レシピ）読み込み
async function loadRecipes() {
  const { data, error } = await supa
    .from('recipes')
    .select('id, name, is_active')
    .order('name')
  
  if (error) {
    alert('カテゴリ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#recipeList')
  list.innerHTML = data.map(recipe => `
    <div class="card bg-gray-50 space-y-2">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-semibold">${recipe.name}</h4>
        </div>
        <div class="flex gap-1">
          <button onclick="editRecipe('${recipe.id}')" class="btn text-xs bg-blue-100 text-blue-600">編集</button>
          <button onclick="deleteRecipe('${recipe.id}')" class="btn text-xs bg-red-100 text-red-600">削除</button>
        </div>
      </div>
    </div>
  `).join('')
}

// カテゴリ追加/更新
$('#addRecipe').onclick = async () => {
  const name = $('#recipeName').value.trim()
  if (!name) {
    alert('カテゴリ名を入力してください')
    return
  }

  const data = {
    name,
    is_active: true
  }

  let error
  if (editingRecipe) {
    // 更新
    const { error: updateError } = await supa
      .from('recipes')
      .update(data)
      .eq('id', editingRecipe)
    error = updateError
  } else {
    // 新規追加
    const { error: insertError } = await supa.from('recipes').insert(data)
    error = insertError
  }

  if (error) {
    alert((editingRecipe ? '更新' : '追加') + 'に失敗: ' + error.message)
  } else {
    clearRecipeForm()
    loadRecipes()
  }
}

// カテゴリフォームクリア
function clearRecipeForm() {
  $('#recipeName').value = ''
  editingRecipe = null
  $('#addRecipe').textContent = '追加'
  $('#cancelRecipeEdit').style.display = 'none'
}

// カテゴリ編集
window.editRecipe = async (id) => {
  const { data } = await supa.from('recipes').select('*').eq('id', id).single()
  if (data) {
    $('#recipeName').value = data.name || ''
    editingRecipe = id
    $('#addRecipe').textContent = '更新'
    $('#cancelRecipeEdit').style.display = 'inline-flex'
  }
}

// カテゴリ編集キャンセル
$('#cancelRecipeEdit').onclick = () => {
  clearRecipeForm()
}

// カテゴリの削除
window.deleteRecipe = async (id) => {
  if (!confirm('このカテゴリを削除しますか？')) return

  const { error } = await supa
    .from('recipes')
    .delete()
    .eq('id', id)

  if (error) {
    alert('削除に失敗: ' + error.message)
  } else {
    loadRecipes()
  }
}

// 初期読み込み
loadRecipes()
loadPastas()
loadCheeses()