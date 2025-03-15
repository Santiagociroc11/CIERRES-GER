# Usa una imagen oficial de Node.js con construcción en múltiples etapas
FROM node:18-alpine AS builder

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia package.json y package-lock.json e instala TODAS las dependencias
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Copia el resto del código fuente
COPY . .

# Carga las variables de entorno desde el archivo .env
COPY loadenv.sh .
RUN chmod +x loadenv.sh && ./loadenv.sh

# Construir la aplicación Vite con las variables de entorno cargadas
RUN npm run build

# Etapa final para la imagen de producción
FROM node:18-alpine AS final

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia solo los archivos necesarios de la etapa de construcción
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Instalar `serve` para servir la aplicación en producción
RUN npm install -g serve

# Exponer el puerto 4445 para que EasyPanel lo use
EXPOSE 4445

# Servir la aplicación con `serve`
CMD ["sh", "-c", "exec serve -s dist -l 4445"]