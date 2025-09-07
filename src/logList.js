import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

async function loadRecipes() {
  const { data } = await supa.from('recipes')
    .select('id,name').eq('is_active', true).order('name')
  const sel = document.querySelector('#recipeFilter'); sel.innerHTML = ''
  const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent='すべて'
  sel.appendChild(opt0)
  data?.forEach(r => {
    const o = document.createElement('option'); o.value=r.id; o.textContent=r.name; sel.appendChild(o)
  })
}
await loadRecipes()

async function resolvePhotoUrl(row){
  if (row.photo_url) return row.photo_url
  if (row.photo_path) {
    const { data, error } = await supa.storage.from('pasta-photos').createSignedUrl(row.photo_path, 3600)
    if (!error) return data.signedUrl
  }
  return null
}

async function reload() {
  const recipeId = document.querySelector('#recipeFilter').value
  let q = supa.from('pasta_logs')
    .select('id,taken_at,photo_url,photo_path,recipe_id,pasta_kind_id,rating_core,feedback_text')
    .order('rating_core->>overall', { ascending: false })
    .order('taken_at', { ascending: false })
    .limit(50)
  if (recipeId) q = q.eq('recipe_id', recipeId)

  const { data, error } = await q
  if (error) { alert(error.message); return }

  const list = document.querySelector('#list'); list.innerHTML = ''
  for (const row of (data||[])) {
    const star = row.rating_core?.overall ?? '-'
    const url = await resolvePhotoUrl(row)
    const img = url ? `<img src="${url}" class="w-32 h-24 object-cover rounded-lg border mb-2" />` : ''
    const card = document.createElement('div'); card.className='card p-0'
    card.innerHTML = `
      <a class="block p-4 hover:bg-gray-50 rounded-2xl" href="/log-detail.html?id=${row.id}">
        <div class="flex gap-3">
          ${img}
          <div class="flex-1">
            <div class="text-sm text-gray-500">${new Date(row.taken_at).toLocaleString()}</div>
            <div class="font-semibold">★${star}</div>
            <div class="text-gray-700">${(row.feedback_text||'').slice(0,160)}</div>
          </div>
        </div>
      </a>`
    list.appendChild(card)
  }
}
document.querySelector('#reload').onclick = reload
reload()
