import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Apagar sourcemaps para proteger el código original en producción
    sourcemap: false,

    // Configuración de empaquetado
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/media-[hash].[ext]'
      }
    }
  }
})
