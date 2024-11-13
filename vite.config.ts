import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: '/scoresceror/', // This should match the repository name
  plugins: [react()],
});
