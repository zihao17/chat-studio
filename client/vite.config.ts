import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // =============================
  // TEMP: Dev anti-cache headers
  // 目的：在开发阶段强制浏览器不缓存任何资源，确保样式/脚本每次请求都新鲜。
  // 恢复：完成调试后，删除整个 server.headers 块即可恢复默认缓存策略。
  // =============================
  // server: {
  //   headers: {
  //     'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  //     'Pragma': 'no-cache',
  //     'Expires': '0',
  //   },
  // },
});
