module.exports = {
  apps: [{
    name: 'whatsapp-events-server',
    script: 'dist/index.js',
    watch: false,
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    restart_delay: 3000,
    exp_backoff_restart_delay: 100
  }]
}; 