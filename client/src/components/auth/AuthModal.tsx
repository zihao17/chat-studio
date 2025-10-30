/**
 * 认证弹窗组件
 * 提供登录和注册功能的统一弹窗界面
 */

import { useState } from "react";
import { Modal, Form, Input, Button, Tabs, App } from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  LoginOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";

interface AuthModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function AuthModal({
  visible,
  onCancel,
  onSuccess,
}: AuthModalProps) {
  const { login, register, state } = useAuth();
  // 使用 App.useApp() 获取 message 实例
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loginForm] = Form.useForm<LoginFormData>();
  const [registerForm] = Form.useForm<RegisterFormData>();

  /**
   * 处理登录
   */
  const handleLogin = async (values: LoginFormData) => {
    try {
      await login(values.email, values.password);
      // 先显示成功提示
      message.success("登录成功！");
      loginForm.resetFields();
      onSuccess?.();
      // 立即关闭模态框，不需要延迟
      onCancel();
    } catch (error: any) {
      message.error(error.message || "登录失败");
    }
  };

  /**
   * 处理注册
   */
  const handleRegister = async (values: RegisterFormData) => {
    try {
      await register(values.username, values.email, values.password);
      // 先显示成功提示
      message.success("注册成功！");
      registerForm.resetFields();
      onSuccess?.();
      // 立即关闭模态框，不需要延迟
      onCancel();
    } catch (error: any) {
      message.error(error.message || "注册失败");
    }
  };

  /**
   * 关闭弹窗时重置表单
   */
  const handleCancel = () => {
    loginForm.resetFields();
    registerForm.resetFields();
    onCancel();
  };

  /**
   * 切换标签页时重置表单
   */
  const handleTabChange = (key: string) => {
    setActiveTab(key as "login" | "register");
    loginForm.resetFields();
    registerForm.resetFields();
  };

  // 登录表单
  const LoginForm = (
    <Form
      form={loginForm}
      name="login"
      onFinish={handleLogin}
      layout="vertical"
      size="large"
      autoComplete="off"
    >
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: "请输入邮箱" },
          { type: "email", message: "请输入有效的邮箱地址" },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="请输入邮箱"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 6, message: "密码长度至少为6位" },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={state.isLoading}
          icon={<LoginOutlined />}
          block
          className="h-12 text-base font-medium"
        >
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  // 注册表单
  const RegisterForm = (
    <Form
      form={registerForm}
      name="register"
      onFinish={handleRegister}
      layout="vertical"
      size="large"
      autoComplete="off"
    >
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: "请输入用户名" },
          { min: 2, message: "用户名长度至少为2位" },
          { max: 20, message: "用户名长度不能超过20位" },
          {
            pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
            message: "用户名只能包含字母、数字、下划线和中文",
          },
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入用户名"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: "请输入邮箱" },
          { type: "email", message: "请输入有效的邮箱地址" },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="请输入邮箱"
          autoComplete="off"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 6, message: "密码长度至少为6位" },
          { max: 50, message: "密码长度不能超过50位" },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="确认密码"
        dependencies={["password"]}
        rules={[
          { required: true, message: "请确认密码" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("两次输入的密码不一致"));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请再次输入密码"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={state.isLoading}
          icon={<UserAddOutlined />}
          block
          className="h-12 text-base font-medium"
        >
          注册
        </Button>
      </Form.Item>
    </Form>
  );

  // 标签页配置
  const tabItems = [
    {
      key: "login",
      label: (
        <span className="flex items-center gap-2 px-2">
          <LoginOutlined />
          登录
        </span>
      ),
      children: LoginForm,
    },
    {
      key: "register",
      label: (
        <span className="flex items-center gap-2 px-2">
          <UserAddOutlined />
          注册
        </span>
      ),
      children: RegisterForm,
    },
  ];

  return (
    <Modal
      title={
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            欢迎使用 Chat Studio
          </div>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={420}
      centered
      destroyOnClose
      maskClosable={false}
      className="auth-modal"
    >
      <div className="py-4">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          centered
          size="large"
          items={tabItems}
          className="auth-tabs"
        />
      </div>
    </Modal>
  );
}
