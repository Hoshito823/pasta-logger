import { supa, requireSession } from './supa.js'
import { initAuthUI } from './auth.js'

await initAuthUI('#auth')
const session = await requireSession()
if (!session) throw new Error('ログインしてください')

const params = new URLSearchParams(location.search)
const id = params.get('id')
const $ = (s) => document.querySelector(s)

console.log('詳細画面: URLパラメータ確認', { search: location.search, id })

if (!id) {
  $('#content').innerHTML = '<p class="text-red-600">IDが指定されていません。</p>'
  throw new Error('missing id')
}

function fmt(ts){ try{return new Date(ts).toLocaleString()}catch{ return '-' } }

async function resolvePhotoUrl(row){
  if (row.photo_url) return row.photo_url
  if (row.photo_path) {
    const { data, error } = await supa.storage.from('pasta-photos').createSignedUrl(row.photo_path, 3600)
    if (!error) return data.signedUrl
  }
  return null
}

async function load(){
  console.log('詳細画面: データ読み込み開始', { id })
  
  const { data, error } = await supa
    .from('pasta_logs')
    .select(`
      id, taken_at, photo_url, photo_path, feedback_text, rating_core,
      boil_salt_pct, ladle_half_units, boil_start_ts, up_ts, combine_end_ts,
      recipe:recipes(name), pasta:pasta_kinds(brand,thickness_mm)
    `)
    .eq('id', id)
    .single()

  console.log('詳細画面: クエリ結果', { data, error })

  if (error) {
    console.error('詳細画面: エラー詳細', error)
    $('#content').innerHTML = `<p class="text-red-600">読み込み失敗: ${error.message}</p>`
    return
  }

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
          <div>堅さ：${data.rating_core?.firmness ?? '-'}</div>
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

      <div class="card">
        <div class="font-semibold mb-2">メモ</div>
        <div class="whitespace-pre-wrap">${(displayMemo || '-')
          .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</div>
      </div>
    </div>
  `

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
