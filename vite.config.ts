import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // O preview do sandbox serve a aplicação por um host próprio
    // (<porta>-<id>.e2b.app). Sem esta liberação o Vite responde 403 e a
    // pré-visualização fica em branco.
    allowedHosts: ['.e2b.app', 'localhost', '.localhost'],
  },
  preview: {
    allowedHosts: ['.e2b.app', 'localhost', '.localhost'],
  },
});
