import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <div className="min-h-screen bg-gray-50">
        {/* 后续添加路由和页面内容 */}
      </div>
    </ConfigProvider>
  )
}

export default App
