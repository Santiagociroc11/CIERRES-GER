module.exports = {
  apps: [{
    name: 'cierres-ger-dev',
    script: 'src/server.ts',
    watch: ['src'],
    env: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      PORT: 3001
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
