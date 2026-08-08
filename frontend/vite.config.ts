import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(), 
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  build: {
    // Compatibilidad para WebViews en Android más antiguos
    target: 'es2015',
    // Generar sourcemaps para debug en Android
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
