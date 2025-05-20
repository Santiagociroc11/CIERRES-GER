#!/bin/bash

# Iniciar el servidor WebSocket en segundo plano
cd /app/server
pm2 start ecosystem.config.js

# Iniciar el frontend
cd /app
serve -s dist -l 4445 