/**
 * API 端点测试脚本
 * 用于验证部署后的服务器端点是否正常工作
 */

const axios = require('axios');

// 从命令行参数获取服务器 URL，默认为本地
const SERVER_URL = process.argv[2] || 'http://localhost:3001';

console.log(`🔍 测试服务器: ${SERVER_URL}`);

async function testEndpoint(url, method = 'GET', data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${SERVER_URL}${url}`,
      headers,
      timeout: 10000
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ ${method} ${url} - 状态: ${response.status}`);
    console.log(`   响应: ${JSON.stringify(response.data).substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.log(`❌ ${method} ${url} - 错误: ${error.response?.status || error.code}`);
    if (error.response?.data) {
      console.log(`   错误信息: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 开始 API 端点测试...\n');
  
  const tests = [
    // 基础端点
    { url: '/', name: '根路径' },
    { url: '/health', name: '健康检查' },
    { url: '/api', name: 'API 信息' },
    
    // 配置端点
    { url: '/api/config/models', name: '模型配置' },
    
    // 认证端点（需要数据）
    { 
      url: '/api/auth/register', 
      method: 'POST', 
      data: { 
        username: 'testuser', 
        email: 'test@example.com', 
        password: 'testpass123' 
      },
      name: '用户注册'
    },
    
    // 聊天同步端点（需要认证，预期会失败）
    { url: '/api/chat-sync/sessions', name: '会话列表（未认证）' }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const success = await testEndpoint(
      test.url, 
      test.method || 'GET', 
      test.data || null,
      test.headers || {}
    );
    if (success) passed++;
    console.log(''); // 空行分隔
  }
  
  console.log(`📊 测试结果: ${passed}/${total} 个端点正常`);
  
  if (passed === total) {
    console.log('🎉 所有基础端点测试通过！');
  } else {
    console.log('⚠️  部分端点存在问题，请检查服务器配置');
  }
}

runTests().catch(console.error);