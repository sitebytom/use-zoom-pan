import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    base: '/use-zoom-pan/',
    root: 'dev',
    resolve: {
        alias: {
            '@sitebytom/use-zoom-pan': path.resolve(__dirname, './src/index.ts'),
        },
    },
    build: {
        outDir: '../dist-docs',
        emptyOutDir: true,
    },
    server: {
        open: true,
    },
})
