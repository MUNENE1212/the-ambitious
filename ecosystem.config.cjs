module.exports = {
  apps: [
    {
      name: 'the-ambitious',
      script: '.next/standalone/server.js',
      cwd: '/opt/the-ambitious/current',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};