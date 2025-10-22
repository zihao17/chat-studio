// 临时测试文件 - 验证环境变量配置
console.log('=== 环境变量测试 ===');
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('VITE_NODE_ENV:', import.meta.env.VITE_NODE_ENV);
console.log('MODE:', import.meta.env.MODE);
console.log('DEV:', import.meta.env.DEV);
console.log('PROD:', import.meta.env.PROD);
console.log('===================');

// 导出配置供其他模块使用
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
export const NODE_ENV = import.meta.env.VITE_NODE_ENV || 'development';