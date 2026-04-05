import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'log-new': './log-new.html',
        'log-list': './log-list.html',
        'log-detail': './log-detail.html',
        'manage': './manage.html',
        'manage-cheese': './manage-cheese.html',
        'manage-pasta': './manage-pasta.html',
        'restaurant-new': './restaurant-new.html',
        'restaurant-list': './restaurant-list.html',
        'restaurant-detail': './restaurant-detail.html'
      }
    }
  },
  server: {
    // 開発時に直接URLアクセスを可能にする
    fs: {
      strict: false
    }
  }
})