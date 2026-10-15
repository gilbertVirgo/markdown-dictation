import { BrowserRouter, Route, Routes } from 'react-router'

const Login = () => <div>Login</div>
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
