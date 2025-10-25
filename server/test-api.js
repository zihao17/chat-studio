/**
 * Chat API 测试脚本
 * 用于测试 /api/chat 代理接口的功能
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

/**
 * 测试非流式对话接口
 */
async function testNonStreamChat() {
  console.log('\n🧪 测试非流式对话接口...');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/chat`, {
      messages: [
        {
          role: 'user',
          content: '你好，请简单介绍一下你自己。'
        }
      ],
      model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
      stream: false
    });

    console.log('✅ 非流式接口测试成功');
    console.log('响应内容:', response.data.content.substring(0, 100) + '...');
    console.log('使用模型:', response.data.model);
  } catch (error) {
    console.error('❌ 非流式接口测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试流式对话接口
 */
async function testStreamChat() {
  console.log('\n🧪 测试流式对话接口...');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/chat`, {
      messages: [
        {
          role: 'user',
          content: '请用一句话介绍人工智能。'
        }
      ],
      model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
      stream: true
    }, {
      responseType: 'stream'
    });

    console.log('✅ 流式接口连接成功');
    
    let content = '';
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n✅ 流式响应完成');
            console.log('完整内容:', content);
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              content += parsed.content;
              process.stdout.write(parsed.content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ 流式接口测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试参数校验
 */
async function testValidation() {
  console.log('\n🧪 测试参数校验...');
  
  // 测试缺少 messages 参数
  try {
    await axios.post(`${API_BASE_URL}/api/chat`, {
      model: 'Qwen/Qwen3-Next-80B-A3B-Instruct'
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 缺少 messages 参数校验通过');
    }
  }

  // 测试缺少 model 参数
  try {
    await axios.post(`${API_BASE_URL}/api/chat`, {
      messages: [{ role: 'user', content: '测试' }]
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 缺少 model 参数校验通过');
    }
  }
}

/**
 * 测试不同模型
 */
async function testDifferentModels() {
  console.log('\n🧪 测试不同模型...');
  
  const models = ['qwen-max', 'qwen-plus', 'gpt-4o'];
  
  for (const model of models) {
    try {
      console.log(`\n测试模型: ${model}`);
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        messages: [
          {
            role: 'user',
            content: '请说"你好"'
          }
        ],
        model,
        stream: false
      });

      console.log(`✅ 模型 ${model} 测试成功`);
    } catch (error) {
      console.error(`❌ 模型 ${model} 测试失败:`, error.response?.data?.message || error.message);
    }
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始 Chat API 测试...');
  
  // 等待服务器启动
  console.log('等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testNonStreamChat();
  await testValidation();
  await testDifferentModels();
  await testStreamChat();
  
  console.log('\n🎉 所有测试完成！');
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testNonStreamChat,
  testStreamChat,
  testValidation,
  testDifferentModels
};