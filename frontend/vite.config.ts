import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Requerido por Capacitor para rutas relativas
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
