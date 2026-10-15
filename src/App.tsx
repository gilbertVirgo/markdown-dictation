import { BrowserRouter, Route, Routes } from 'react-router'
import DocList from './pages/DocList'
import Login from './pages/Login'

const Doc = () => <div>Doc</div>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DocList />} />
        <Route path="/doc/:id" element={<Doc />} />
      </Routes>
    </BrowserRouter>
  )
}
