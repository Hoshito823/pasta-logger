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

// 今日の日付をデフォルトでセット
const today = new Date().toISOString().split('T')[0]
$('#visitedAt').value = today

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

setupStarRating('#ratingStars', '#rating')
setupStarRating('#revisitDesireStars', '#revisitDesire')

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

// フォーム送信
$('#restaurantForm').onsubmit = async (e) => {
  e.preventDefault()
  console.log('フォーム送信開始')

  // 必須項目のバリデーション
  const restaurantName = $('#restaurantName').value.trim()
  const dishName = $('#dishName').value.trim()
  const visitedAt = $('#visitedAt').value

  if (!restaurantName) {
    alert('店名を入力してください')
    return
  }

  if (!dishName) {
    alert('料理名を入力してください')
    return
  }

  if (!visitedAt) {
    alert('訪問日を入力してください')
    return
  }

  console.log('バリデーション通過')

  const userId = (await supa.auth.getUser()).data.user.id
  const photoFile = $('#photo').files[0]
  const photo = await uploadPhoto(photoFile, userId)

  const insertData = {
    user_id: userId,
    restaurant_name: restaurantName,
    dish_name: dishName,
    visited_at: visitedAt,
    rating: $('#rating').value ? Number($('#rating').value) : null,
    revisit_desire: $('#revisitDesire').value ? Number($('#revisitDesire').value) : null,
    google_maps_url: $('#googleMapsUrl').value.trim() || null,
    next_menu_to_try: $('#nextMenuToTry').value.trim() || null,
    memo: $('#memo').value.trim() || null,
    photo_path: photo.path,
    photo_url: photo.url
  }

  console.log('挿入データ:', insertData)

  const { error } = await supa.from('restaurant_logs').insert(insertData)
  if (error) {
    console.error('保存エラー:', error)
    alert('保存に失敗: ' + error.message)
  } else {
    console.log('保存成功')
    alert('保存しました')
    location.href = '/restaurant-list.html'
  }
}
