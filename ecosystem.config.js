// Config de PM2. Con dominio propio + HTTPS NO se necesita ngrok:
// deja solo el proceso del server. Si usas ngrok, descomenta mototaxi-ngrok.
module.exports = {
  apps: [
    {
      name: 'mototaxi-server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      watch: false,
    },
    // {
    //   name: 'mototaxi-ngrok',
    //   script: 'ngrok',
    //   args: 'http 3001',
    //   interpreter: 'none',
    // },
  ],
};
