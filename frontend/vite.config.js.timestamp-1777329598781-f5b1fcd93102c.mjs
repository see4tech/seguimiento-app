// vite.config.js
import { defineConfig } from "file:///sessions/festive-inspiring-ramanujan/mnt/Seguimiento/seguimiento-app/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/festive-inspiring-ramanujan/mnt/Seguimiento/seguimiento-app/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo local, redirige /api/* a netlify dev (puerto 8888)
      // Correr: netlify dev (en lugar de npm run dev)
      // O apuntar al puerto de tu función local:
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZmVzdGl2ZS1pbnNwaXJpbmctcmFtYW51amFuL21udC9TZWd1aW1pZW50by9zZWd1aW1pZW50by1hcHAvZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9mZXN0aXZlLWluc3BpcmluZy1yYW1hbnVqYW4vbW50L1NlZ3VpbWllbnRvL3NlZ3VpbWllbnRvLWFwcC9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZmVzdGl2ZS1pbnNwaXJpbmctcmFtYW51amFuL21udC9TZWd1aW1pZW50by9zZWd1aW1pZW50by1hcHAvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICAvLyBFbiBkZXNhcnJvbGxvIGxvY2FsLCByZWRpcmlnZSAvYXBpLyogYSBuZXRsaWZ5IGRldiAocHVlcnRvIDg4ODgpXG4gICAgICAvLyBDb3JyZXI6IG5ldGxpZnkgZGV2IChlbiBsdWdhciBkZSBucG0gcnVuIGRldilcbiAgICAgIC8vIE8gYXB1bnRhciBhbCBwdWVydG8gZGUgdHUgZnVuY2lcdTAwRjNuIGxvY2FsOlxuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODg4OCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogcGF0aCA9PiBwYXRoXG4gICAgICB9XG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0WixTQUFTLG9CQUFvQjtBQUN6YixPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFNBQVMsVUFBUTtBQUFBLE1BQ25CO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
