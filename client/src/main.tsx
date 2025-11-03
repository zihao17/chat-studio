import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// 临时导入环境变量测试
import './utils/envTest.ts'

// 开发环境启用 StrictMode，生产环境禁用以避免 effect 双调用造成的视觉抖动
createRoot(document.getElementById("root")!).render(
  import.meta.env.DEV ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
);
