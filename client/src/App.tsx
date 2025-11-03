import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import Home from './pages/Home'
import { ChatProvider } from './contexts/ChatContext'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

const InnerApp: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, cssVar: true }}>
      {/* 启用 antd CSS 变量，提升主题切换的一致性与性能 */}
      <AntdApp>
        <AuthProvider>
          <ChatProvider>
            <div className="min-h-screen bg-app transition-colors">
              <Home />
            </div>
          </ChatProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <InnerApp />
    </ThemeProvider>
  )
}

export default App;
