import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'log-new': './log-new.html',
        'log-list': './log-list.html',
        'log-detail': './log-detail.html',
        'manage': './manage.html'
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