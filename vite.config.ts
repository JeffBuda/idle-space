import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(
  {
    server: {
      port: 2945,
    },
  base: '/idle-space/', // This should match the repository name
  plugins: [react()],
});
