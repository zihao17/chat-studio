/**
 * 对话同步Hook
 * 管理游客数据同步和云端数据加载逻辑
 */

import { useState, useCallback } from "react";
import { message } from "antd";
import type { ChatSession } from "../types/chat";
import { STORAGE_KEYS } from "../types/chat";
import { useAuth } from "../contexts/AuthContext";
import {
  syncGuestDataToCloud,
  loadAllCloudSessions,
  saveMessageToCloud,
  deleteCloudSession,
} from "../utils/chatSyncApi";

export interface ChatSyncState {
  isSyncing: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatSyncActions {
  syncGuestData: (guestSessions: ChatSession[]) => Promise<boolean>;
  loadCloudData: () => Promise<ChatSession[]>;
  saveMessage: (
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    title?: string
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

export function useChatSync(): ChatSyncState & ChatSyncActions {
  const { state: authState } = useAuth();
  const [syncState, setSyncState] = useState<ChatSyncState>({
    isSyncing: false,
    isLoading: false,
    error: null,
  });

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setSyncState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * 同步游客数据到云端
   */
  const syncGuestData = useCallback(
    async (guestSessions: ChatSession[]): Promise<boolean> => {
      if (!authState.isAuthenticated) {
        console.warn("用户未登录，无法同步数据");
        return false;
      }

      if (guestSessions.length === 0) {
        console.log("没有游客数据需要同步");
        return true;
      }

      // 防止重复同步
      if (syncState.isSyncing) {
        console.warn("数据同步正在进行中，跳过重复请求");
        return false;
      }

      setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        const result = await syncGuestDataToCloud(guestSessions);

        if (result.success) {
          message.success(`成功同步 ${result.syncedSessions} 个对话到云端`);

          // 同步成功后清空本地游客数据
          localStorage.removeItem(STORAGE_KEYS.CHAT_SESSIONS);
          localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION_ID);

          console.log("游客数据同步成功，本地数据已清空");
          return true;
        } else {
          throw new Error(result.message);
        }
      } catch (error: any) {
        // 检查是否是认证错误
        if (error.response?.status === 401) {
          console.error("同步游客数据失败:", error);
          throw new Error("需要登录");
        }
        
        const errorMessage = error.message || "同步数据失败";
        setSyncState((prev) => ({ ...prev, error: errorMessage }));
        console.error("同步游客数据失败:", error);
        throw new Error(errorMessage);
      } finally {
        setSyncState((prev) => ({ ...prev, isSyncing: false }));
      }
    },
    [authState.isAuthenticated, syncState.isSyncing]
  );

  /**
   * 从云端加载所有对话数据
   */
  const loadCloudData = useCallback(async (): Promise<ChatSession[]> => {
    if (!authState.isAuthenticated) {
      console.warn("用户未登录，无法加载云端数据");
      return [];
    }

    setSyncState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const cloudSessions = await loadAllCloudSessions();
      console.log(`成功加载 ${cloudSessions.length} 个云端对话`);
      return cloudSessions;
    } catch (error: any) {
      // 检查是否是认证错误
      if (error.response?.status === 401) {
        console.error("获取云端会话失败:", error);
        throw new Error("需要登录");
      }
      
      const errorMessage = error.message || "加载云端数据失败";
      setSyncState((prev) => ({ ...prev, error: errorMessage }));
      console.error("加载云端数据失败:", error);
      throw new Error("加载云端数据失败");
    } finally {
      setSyncState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [authState.isAuthenticated]);

  /**
   * 保存消息到云端（仅在用户已登录时）
   */
  const saveMessage = useCallback(
    async (
      sessionId: string,
      role: "user" | "assistant",
      content: string,
      title?: string
    ): Promise<void> => {
      if (!authState.isAuthenticated) {
        // 用户未登录，消息只保存在本地
        return;
      }

      try {
        await saveMessageToCloud(sessionId, role, content, title);
        console.log("消息已保存到云端");
      } catch (error: any) {
        console.error("保存消息到云端失败:", error);
        // 不显示错误提示，避免影响用户体验
        // 消息已经保存在本地，云端同步失败不影响正常使用
      }
    },
    [authState.isAuthenticated]
  );

  /**
   * 删除云端会话（仅在用户已登录时）
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!authState.isAuthenticated) {
        // 用户未登录，只删除本地数据
        return;
      }

      try {
        await deleteCloudSession(sessionId);
        console.log("云端会话已删除");
      } catch (error: any) {
        console.error("删除云端会话失败:", error);
        // 不显示错误提示，本地已经删除，云端删除失败不影响用户体验
      }
    },
    [authState.isAuthenticated]
  );

  return {
    // 状态
    isSyncing: syncState.isSyncing,
    isLoading: syncState.isLoading,
    error: syncState.error,

    // 操作
    syncGuestData,
    loadCloudData,
    saveMessage,
    deleteSession,
    clearError,
  };
}
