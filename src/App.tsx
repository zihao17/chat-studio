import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import Home from './pages/Home'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <div className="min-h-screen bg-gray-50">
        {/* 主页面组件 */}
        <Home />
      </div>
    </ConfigProvider>
  )
}

export default App
