import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: resolve(__dirname, 'src/renderer'),
    base: './',
    build: {
        outDir: resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: resolve(__dirname, 'src/renderer/index.html'),
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true
    }
});
