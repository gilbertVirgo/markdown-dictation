import { BrowserRouter, Route, Routes } from 'react-router'
import DocList from './pages/DocList'
import DocPage from './pages/DocPage'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DocList />} />
        <Route path="/doc/:id" element={<DocPage />} />
      </Routes>
    </BrowserRouter>
  )
}
