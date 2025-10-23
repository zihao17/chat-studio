/**
 * 认证上下文
 * 管理用户登录状态和认证相关操作
 */

import { createContext, useContext, useReducer, useEffect } from "react";
import type { ReactNode } from "react";
import axios from "axios";

// 用户信息接口
export interface User {
  id: number;
  username: string;
  email: string;
}

// 认证状态接口
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// 认证操作类型
type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: User }
  | { type: "AUTH_FAILURE"; payload: string }
  | { type: "LOGOUT" }
  | { type: "CLEAR_ERROR" };

// 初始状态
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
};

// 状态管理 Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case "AUTH_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        isLoading: false,
        error: null,
      };
    case "AUTH_FAILURE":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: action.payload,
      };
    case "LOGOUT":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

// 认证上下文接口
interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API 基础配置 - 使用环境变量
const API_BASE_URL = `${
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
}/api`;

// 配置 axios 默认设置
axios.defaults.withCredentials = true;

// AuthProvider 组件
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * 检查用户认证状态
   */
  const checkAuth = async () => {
    try {
      dispatch({ type: "AUTH_START" });

      const response = await axios.get(`${API_BASE_URL}/auth/verify`);

      if (response.data.success) {
        console.log("身份验证成功:", response.data.user);
        dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
      } else {
        console.log("身份验证失败:", response.data.message);
        dispatch({ type: "AUTH_FAILURE", payload: "身份验证失败" });
      }
    } catch (error: any) {
      // 401 表示未登录，这是正常情况
      if (error.response?.status === 401) {
        console.log("用户未登录，切换到游客模式");
        dispatch({ type: "LOGOUT" });
      } else {
        console.error("身份验证错误:", error);
        dispatch({ type: "AUTH_FAILURE", payload: "身份验证失败" });
      }
    }
  };

  /**
   * 用户登录
   */
  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: "AUTH_START" });

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      if (response.data.success) {
        dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
      } else {
        // 登录失败时，dispatch错误状态并抛出异常以触发UI提示
        const errorMessage = response.data.message || "登录失败";
        dispatch({
          type: "AUTH_FAILURE",
          payload: errorMessage,
        });
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 处理网络错误或其他异常
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "登录失败，请稍后重试";
      dispatch({ type: "AUTH_FAILURE", payload: errorMessage });
      throw new Error(errorMessage);
    }
  };

  /**
   * 用户注册
   */
  const register = async (
    username: string,
    email: string,
    password: string
  ) => {
    try {
      dispatch({ type: "AUTH_START" });

      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        username,
        email,
        password,
      });

      if (response.data.success) {
        dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
      } else {
        dispatch({
          type: "AUTH_FAILURE",
          payload: response.data.message || "注册失败",
        });
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "注册失败，请稍后重试";
      dispatch({ type: "AUTH_FAILURE", payload: errorMessage });
      throw new Error(errorMessage);
    }
  };

  /**
   * 用户登出
   */
  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`);
    } catch (error) {
      console.error("登出请求失败:", error);
    } finally {
      dispatch({ type: "LOGOUT" });
    }
  };

  /**
   * 清除错误信息
   */
  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  // 组件挂载时检查认证状态
  useEffect(() => {
    checkAuth();
  }, []);

  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * 使用认证上下文的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }
  return context;
}

export default AuthContext;
