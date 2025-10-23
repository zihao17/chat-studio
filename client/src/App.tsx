import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import Home from './pages/Home'
import { ChatProvider } from './contexts/ChatContext'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      {/* 使用 AntdApp 组件提供 message context */}
      <AntdApp>
        <AuthProvider>
          <ChatProvider>
            <div className="min-h-screen bg-gray-50">
              {/* 主页面组件 */}
              <Home />
            </div>
          </ChatProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App;
