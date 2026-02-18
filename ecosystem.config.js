// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "tcsa-api",
      script: "./index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 4000,
      max_restarts: 5,
      min_uptime: "10s",

      // Solo fija lo imprescindible aquí; el resto vendrá de .env
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // logs en ./logs
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
