# Usa una imagen oficial de Node.js
FROM node:18

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia package.json y package-lock.json del frontend e instala dependencias
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Copia el resto del código fuente del frontend
COPY . .

# Argumentos de construcción (Build Args) para Vite
# Estas variables deben pasarse durante el build para que Vite las inyecte
ARG VITE_POSTGREST_URL
ARG VITE_ENDPOINT_REASIGNA
ARG VITE_ENDPOINT_VENTAEXTERNA
ARG VITE_EVOLUTIONAPI_URL
ARG VITE_EVOLUTIONAPI_TOKEN
ARG VITE_MINIO_ENDPOINT
ARG VITE_MINIO_ACCESS_KEY
ARG VITE_MINIO_SECRET_KEY
ARG VITE_MINIO_BUCKET_NAME

# Asignar ARGs a ENVs para que estén disponibles en el proceso de build
ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_ENDPOINT_REASIGNA=$VITE_ENDPOINT_REASIGNA
ENV VITE_ENDPOINT_VENTAEXTERNA=$VITE_ENDPOINT_VENTAEXTERNA
ENV VITE_EVOLUTIONAPI_URL=$VITE_EVOLUTIONAPI_URL
ENV VITE_EVOLUTIONAPI_TOKEN=$VITE_EVOLUTIONAPI_TOKEN
ENV VITE_MINIO_ENDPOINT=$VITE_MINIO_ENDPOINT
ENV VITE_MINIO_ACCESS_KEY=$VITE_MINIO_ACCESS_KEY
ENV VITE_MINIO_SECRET_KEY=$VITE_MINIO_SECRET_KEY
ENV VITE_MINIO_BUCKET_NAME=$VITE_MINIO_BUCKET_NAME

# Construir la aplicación Vite con las variables de entorno
RUN npm run build

# Instalar PM2 globalmente
RUN npm install -g pm2

# Crear directorio para el servidor
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

# Exponer el puerto del servidor unificado
EXPOSE 4445

# Script de inicio que ejecuta el servidor unificado
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Ejecutar el script de inicio
CMD ["/app/start.sh"]
