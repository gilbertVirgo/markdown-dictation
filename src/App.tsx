import { BrowserRouter, Route, Routes } from 'react-router'
import Login from './pages/Login'

const Home = () => <div>Home</div>
const Doc = () => <div>Doc</div>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/doc/:id" element={<Doc />} />
      </Routes>
    </BrowserRouter>
  )
}
