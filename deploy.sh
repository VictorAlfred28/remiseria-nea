#!/bin/bash

echo "Iniciando despliegue de UBI Traslados..."

# Actualizar código
git pull origin main

# Instalar dependencias
cd frontend
npm install

# Construir Web
npm run build

# Sincronizar APK Capacitor
npx cap sync android

# Volver a la raíz
cd ..

# Reiniciar Nginx (requiere sudo, asegúrate de correr esto con permisos si falla)
# sudo systemctl restart nginx

echo "¡Despliegue finalizado!"
