import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const backendProxy: ProxyOptions = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyRequest, request) => {
      // Preserve same-origin semantics across the local development proxy.
      // Requests from another origin keep their original Origin header.
      if (request.headers.origin === `http://${request.headers.host}`) {
        proxyRequest.setHeader('Origin', 'http://localhost:8080')
      }
    })
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendProxy,
      '/actuator': backendProxy,
    },
  },
})

