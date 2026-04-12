import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { Docs } from './pages/Docs'
import { Ports } from './pages/Ports'
import { Config } from './pages/Config'
import { useToast } from './hooks/useToast'

function App() {
  const { toasts, removeToast } = useToast()

  return (
    <BrowserRouter>
      <Layout toasts={toasts} onRemoveToast={removeToast}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/ports" element={<Ports />} />
          <Route path="/config" element={<Config />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
