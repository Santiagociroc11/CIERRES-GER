# Usa una imagen oficial de Node.js
FROM node:18

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia package.json y package-lock.json e instala TODAS las dependencias
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Copia el resto del código fuente
COPY . .

# Construir la aplicación Vite con las variables de entorno
RUN npm run build


# Instalar `serve` para servir la aplicación en producción
RUN npm install -g serve

# Exponer el puerto 4173 para que EasyPanel lo use
EXPOSE 4445

# Servir la aplicación con `serve`
CMD ["sh", "-c", "exec serve -s dist -l 4445"]
