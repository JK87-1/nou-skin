import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const useSSL = process.env.VITE_SSL !== 'false';

export default defineConfig({
  plugins: [react(), ...(useSSL ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true,
    open: true,
    https: useSSL,
    allowedHosts: ['.trycloudflare.com'],
  }
});
