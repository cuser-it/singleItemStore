import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = Number(process.env.VITE_BACKEND_PORT ?? 3001);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${backendPort}`,
      '/img': `http://127.0.0.1:${backendPort}`,
    },
  },
  test: {
    // 客户端与服务端测试需要不同运行环境：
    // - client：jsdom + 浏览器 setup
    // - server：node（jsdom 的 fetch/FormData 会破坏 multipart 上传，导致上传接口误报 400）
    //   并强制清空 DATABASE_URL，避免 @prisma/client 自动加载 .env 后测试直接读写生产库
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          env: {
            DATABASE_URL: '',
            // 清空 S3 配置，否则 @prisma/client 自动加载 .env 后，测试会把文件传到真实对象存储
            S3_ENDPOINT: '',
            S3_REGION: '',
            S3_ACCESS_KEY_ID: '',
            S3_SECRET_ACCESS_KEY: '',
            S3_BUCKET: '',
            S3_PUBLIC_BASE_URL: '',
          },
        },
      },
    ],
  },
});
