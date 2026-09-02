import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, '0.0.0.0', () => {
        server.close(() => resolve(true));
      });
    });
    if (available) return port;
  }
  throw new Error(`no free port found near ${startPort}`);
}

function binPath(name) {
  return path.resolve('node_modules/.bin', process.platform === 'win32' ? `${name}.cmd` : name);
}

const backendPort = await findFreePort(Number(process.env.BACKEND_PORT ?? 3001));
const frontendPort = await findFreePort(Number(process.env.PORT ?? 5173));

const backend = spawn(binPath('tsx'), ['server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(backendPort),
  },
});

const frontend = spawn(binPath('vite'), ['--host', '0.0.0.0', '--port', String(frontendPort)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BACKEND_PORT: String(backendPort),
  },
});

const shutdown = () => {
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
backend.on('exit', (code) => {
  frontend.kill('SIGTERM');
  process.exit(code ?? 0);
});
frontend.on('exit', (code) => {
  backend.kill('SIGTERM');
  process.exit(code ?? 0);
});

console.log(`backend http://localhost:${backendPort}`);
console.log(`frontend http://localhost:${frontendPort}`);
