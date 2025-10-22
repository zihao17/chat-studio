/**
 * 配置API工具函数
 * 处理与后端的配置信息获取
 */

import axios from 'axios';

// API 基础配置 - 使用环境变量
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api`;

// 配置 axios 默认设置
axios.defaults.withCredentials = true;

// 服务配置接口
export interface ServiceConfiguration {
  hasUserModelscope: boolean;
  hasDashscope: boolean;
  hasOpenai: boolean;
  usingFallback: boolean;
}

// 服务响应接口
export interface ServicesResponse {
  success: boolean;
  data: {
    availableServices: string[];
    configuration: ServiceConfiguration;
  };
}

// 模型配置接口
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: "dashscope" | "modelscope" | "openai";
}

// 模型响应接口
export interface ModelsResponse {
  success: boolean;
  data: {
    models: ModelConfig[];
    configuration: ServiceConfiguration;
  };
}

/**
 * 获取可用的AI服务列表
 */
export async function getAvailableServices(): Promise<ServicesResponse> {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/services`);
    return response.data;
  } catch (error: any) {
    console.error('获取服务配置失败:', error);
    throw new Error(error.response?.data?.message || '获取服务配置失败');
  }
}

/**
 * 获取可用的模型列表
 */
export async function getAvailableModels(): Promise<ModelsResponse> {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/models`);
    return response.data;
  } catch (error: any) {
    console.error('获取模型列表失败:', error);
    throw new Error(error.response?.data?.message || '获取模型列表失败');
  }
}