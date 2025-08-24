#!/bin/bash

# Iniciar el servidor unificado (API REST + WebSocket + Frontend)
cd /app/server
pm2 start ecosystem.config.js

# Mantener el contenedor en ejecución
pm2 logs 