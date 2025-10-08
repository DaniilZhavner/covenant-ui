import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/covenant-ui/', // <- имя репозитория со слэшем
})

