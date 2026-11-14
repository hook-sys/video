// pm2: keeps MotionDots running, restarts it if it stops or the server reboots.
// Started by deploy.sh (pm2 startOrReload deploy/ecosystem.config.cjs).
module.exports = {
  apps: [
    {
      name: "motiondots",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      // only on this machine: the world reaches it through Caddy (HTTPS), never directly
      args: "start -H 127.0.0.1 -p 3000",
      env: { NODE_ENV: "production", RENDER_MODE: "local" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "6G",
      kill_timeout: 20000,
      time: true,
    },
  ],
};
