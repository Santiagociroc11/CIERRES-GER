# Usa una imagen oficial de Node.js
FROM node:18

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia package.json y package-lock.json del frontend e instala dependencias
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Copia el resto del código fuente del frontend
COPY . .

# Construir la aplicación Vite con las variables de entorno
RUN npm run build

# Instalar `serve` y PM2 globalmente
RUN npm install -g serve pm2

# Crear directorio para el servidor WebSocket
WORKDIR /app/server

# Copia package.json y package-lock.json del servidor e instala dependencias
COPY server/package.json server/package-lock.json ./
RUN npm install --frozen-lockfile

# Copia el código fuente del servidor
COPY server/src ./src
COPY server/tsconfig.json ./
COPY server/ecosystem.config.js ./

# Compilar el servidor TypeScript
RUN npm run build

# Crear directorio para logs
RUN mkdir -p logs

# Exponer los puertos necesarios
EXPOSE 4445 3000

# Script de inicio que ejecuta tanto el frontend como el servidor WebSocket
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Ejecutar el script de inicio
CMD ["/app/start.sh"]
