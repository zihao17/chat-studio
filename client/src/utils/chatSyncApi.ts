/**
 * 对话同步API工具函数
 * 处理与后端的对话数据同步
 */

import axios from 'axios';
import type { ChatSession } from '../types/chat';

// API 基础配置 - 使用环境变量
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api`;

// 配置 axios 默认设置
axios.defaults.withCredentials = true;

// 云端会话数据接口
export interface CloudSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// 云端消息数据接口
export interface CloudMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 同步响应接口
export interface SyncResponse {
  success: boolean;
  message: string;
  syncedSessions?: number;
}

/**
 * 获取用户的所有云端会话
 */
export async function getCloudSessions(): Promise<CloudSession[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat-sync/sessions`);
    
    if (response.data.success) {
      return response.data.sessions || [];
    } else {
      throw new Error(response.data.message || '获取云端会话失败');
    }
  } catch (error: any) {
    // 保留原始错误信息以便上层处理
    if (error.response?.status === 401) {
      console.error('获取云端会话失败: AxiosError {', 'message:', `'Request failed with status code ${error.response.status}'`, '...', '}');
    } else {
      console.error('获取云端会话失败:', error);
    }
    throw error; // 抛出原始错误，让上层处理
  }
}

/**
 * 获取指定会话的所有消息
 */
export async function getSessionMessages(sessionId: string): Promise<CloudMessage[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/chat-sync/sessions/${sessionId}/messages`);
    
    if (response.data.success) {
      return response.data.messages || [];
    } else {
      throw new Error(response.data.message || '获取会话消息失败');
    }
  } catch (error: any) {
    console.error('获取会话消息失败:', error);
    throw new Error(error.response?.data?.message || '获取会话消息失败');
  }
}

/**
 * 同步游客数据到云端
 */
export async function syncGuestDataToCloud(sessions: ChatSession[]): Promise<SyncResponse> {
  try {
    // 转换本地会话数据格式为后端期望的格式
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      title: session.title,
      messages: session.messages.map(message => ({
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp).toISOString()
      })),
      createdAt: new Date(session.createdAt).toISOString()
    }));

    const response = await axios.post(`${API_BASE_URL}/chat-sync/sync-guest-data`, {
      sessions: formattedSessions
    });
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message,
        syncedSessions: response.data.syncedSessions
      };
    } else {
      throw new Error(response.data.message || '同步数据失败');
    }
  } catch (error: any) {
    // 保留原始错误信息以便上层处理
    if (error.response?.status === 401) {
      console.error('同步游客数据失败:', error);
    } else {
      console.error('同步游客数据失败:', error);
    }
    throw error; // 抛出原始错误，让上层处理
  }
}

/**
 * 保存新的对话消息到云端
 */
export async function saveMessageToCloud(
  sessionId: string, 
  role: 'user' | 'assistant', 
  content: string,
  title?: string
): Promise<void> {
  try {
    const response = await axios.post(`${API_BASE_URL}/chat-sync/sessions/${sessionId}/messages`, {
      role,
      content,
      title
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || '保存消息失败');
    }
  } catch (error: any) {
    console.error('保存消息到云端失败:', error);
    throw new Error(error.response?.data?.message || '保存消息失败');
  }
}

/**
 * 删除云端会话
 */
export async function deleteCloudSession(sessionId: string): Promise<void> {
  try {
    const response = await axios.delete(`${API_BASE_URL}/chat-sync/sessions/${sessionId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || '删除会话失败');
    }
  } catch (error: any) {
    console.error('删除云端会话失败:', error);
    throw new Error(error.response?.data?.message || '删除会话失败');
  }
}

/**
 * 将云端会话数据转换为本地格式
 */
export function convertCloudSessionToLocal(
  cloudSession: CloudSession, 
  messages: CloudMessage[]
): ChatSession {
  return {
    id: cloudSession.session_id,
    title: cloudSession.title,
    messages: messages.map((msg, index) => ({
      id: `cloud-msg-${cloudSession.session_id}-${index}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime()
    })),
    createdAt: new Date(cloudSession.created_at).getTime(),
    updatedAt: new Date(cloudSession.updated_at).getTime()
  };
}

/**
 * 从云端加载所有会话数据
 */
export async function loadAllCloudSessions(): Promise<ChatSession[]> {
  try {
    const cloudSessions = await getCloudSessions();
    const localSessions: ChatSession[] = [];

    // 并行获取所有会话的消息
    const sessionPromises = cloudSessions.map(async (cloudSession) => {
      try {
        const messages = await getSessionMessages(cloudSession.session_id);
        return convertCloudSessionToLocal(cloudSession, messages);
      } catch (error) {
        console.error(`获取会话 ${cloudSession.session_id} 的消息失败:`, error);
        // 即使获取消息失败，也返回空消息的会话
        return convertCloudSessionToLocal(cloudSession, []);
      }
    });

    const results = await Promise.allSettled(sessionPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        localSessions.push(result.value);
      }
    });

    // 按更新时间排序
    return localSessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: any) {
    console.error('加载云端会话数据失败:', error);
    throw new Error('加载云端数据失败');
  }
}