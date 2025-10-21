/**
 * API Key 管理工具
 * 提供简单的加密解密功能，避免明文暴露敏感信息
 */

const crypto = require('crypto');

// 简单的混淆密钥（不是真正的加密密钥）
const OBFUSCATION_KEY = 'chat_studio_2024_key_obfuscation';

/**
 * 简单的字符串混淆函数
 * @param {string} text - 要混淆的文本
 * @returns {string} - 混淆后的文本
 */
function obfuscateString(text) {
  if (!text) return '';
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const keyChar = OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
    result += String.fromCharCode(char ^ keyChar);
  }
  
  // 转换为base64以避免特殊字符
  return Buffer.from(result, 'binary').toString('base64');
}

/**
 * 简单的字符串反混淆函数
 * @param {string} obfuscatedText - 混淆后的文本
 * @returns {string} - 原始文本
 */
function deobfuscateString(obfuscatedText) {
  if (!obfuscatedText) return '';
  
  try {
    // 从base64解码
    const binaryText = Buffer.from(obfuscatedText, 'base64').toString('binary');
    
    let result = '';
    for (let i = 0; i < binaryText.length; i++) {
      const char = binaryText.charCodeAt(i);
      const keyChar = OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      result += String.fromCharCode(char ^ keyChar);
    }
    
    return result;
  } catch (error) {
    console.error('反混淆失败:', error);
    return '';
  }
}

// 预设的备用API密钥（混淆后）
const FALLBACK_MODELSCOPE_TOKEN = obfuscateString('ms-b17d8ad4-ec75-41cb-926f-974738713881');

/**
 * 获取ModelScope API密钥
 * 优先使用用户配置的密钥，如果没有则使用备用密钥
 * @returns {string} - API密钥
 */
function getModelscopeApiKey() {
  // 优先使用用户配置的密钥
  if (process.env.MODELSCOPE_API_KEY && process.env.MODELSCOPE_API_KEY.trim()) {
    return process.env.MODELSCOPE_API_KEY.trim();
  }
  
  // 如果用户没有配置，使用备用密钥
  console.log('🔑 使用内置备用ModelScope API密钥');
  return deobfuscateString(FALLBACK_MODELSCOPE_TOKEN);
}

/**
 * 检查用户是否配置了完整的API密钥
 * @returns {object} - 配置状态对象
 */
function checkApiKeyConfiguration() {
  const config = {
    hasUserModelscope: !!(process.env.MODELSCOPE_API_KEY && process.env.MODELSCOPE_API_KEY.trim()),
    hasDashscope: !!(process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_API_KEY.trim()),
    hasOpenai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()),
    usingFallback: false
  };
  
  // 如果用户没有配置ModelScope密钥，标记为使用备用密钥
  if (!config.hasUserModelscope) {
    config.usingFallback = true;
  }
  
  return config;
}

/**
 * 获取可用的服务类型列表
 * @returns {string[]} - 可用的服务类型数组
 */
function getAvailableServices() {
  const config = checkApiKeyConfiguration();
  const services = [];
  
  // ModelScope总是可用（有备用密钥）
  services.push('modelscope');
  
  // 其他服务需要用户配置
  if (config.hasDashscope) {
    services.push('dashscope');
  }
  
  if (config.hasOpenai) {
    services.push('openai');
  }
  
  return services;
}

module.exports = {
  obfuscateString,
  deobfuscateString,
  getModelscopeApiKey,
  checkApiKeyConfiguration,
  getAvailableServices
};