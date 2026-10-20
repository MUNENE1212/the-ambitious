module.exports = {
  apps: [
    {
      name: 'the-ambitious',
      // Absolute path on purpose. This box is shared with seven other services
      // that build and run on the system Node 20; `/usr/bin/node` must not be
      // replaced or repointed. Node 24 lives beside it at /opt/node24 and only
      // this app uses it (package.json requires >=24 <25).
      interpreter: '/opt/node24/bin/node',
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