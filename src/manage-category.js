import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'

const $ = (s) => document.querySelector(s)

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

// 編集状態の管理
let editingRecipe = null
let currentFilter = {}

// カテゴリ（レシピ）読み込み
async function loadRecipes(filter = {}) {
  let query = supa
    .from('recipes')
    .select('id, name, is_active')
    .order('name')

  // フィルター適用
  if (filter.name) {
    query = query.ilike('name', `%${filter.name}%`)
  }

  const { data, error } = await query

  if (error) {
    alert('カテゴリ読み込みエラー: ' + error.message)
    return
  }

  const list = $('#recipeList')
  const count = $('#recipeCount')
  count.textContent = data?.length || 0

  list.innerHTML = ''

  for (const recipe of (data || [])) {
    const div = document.createElement('div')
    div.className = `flex items-center justify-between p-4 border rounded-xl bg-white hover:shadow-md transition-shadow`
    div.innerHTML = `
      <div class="flex-1">
        <div class="font-semibold text-lg">${recipe.name}</div>
      </div>
      <div class="flex gap-2">
        <button onclick="editRecipe('${recipe.id}')" class="btn bg-blue-100 text-blue-600">編集</button>
        <button onclick="deleteRecipe('${recipe.id}')" class="btn bg-red-100 text-red-600">削除</button>
      </div>
    `
    list.appendChild(div)
  }
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
    loadRecipes(currentFilter)
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
    loadRecipes(currentFilter)
  }
}

// フィルター適用
$('#applyFilter').onclick = () => {
  const filter = {}

  const name = $('#nameFilter').value.trim()
  if (name) filter.name = name

  currentFilter = filter
  loadRecipes(filter)
}

// フィルタークリア
$('#clearFilter').onclick = () => {
  $('#nameFilter').value = ''
  currentFilter = {}
  loadRecipes()
}

// 初期読み込み
loadRecipes()