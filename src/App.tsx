import { BrowserRouter, Outlet, Route, Routes, useMatch } from 'react-router'
import DocList from './pages/DocList'
import DocPage from './pages/DocPage'
import Login from './pages/Login'

// Phone: list and doc are separate screens. Desktop (lg): the list is a permanent sidebar beside the doc.
function Shell() {
  const inDoc = !!useMatch('/doc/:id')
  return (
    <>
      <aside className={`${inDoc ? 'hidden' : ''} lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-70 lg:overflow-y-auto`}>
        <DocList />
      </aside>
      <Outlet />
    </>
  )
}

function Empty() {
  return (
    <div className="fixed inset-y-0 right-0 left-70 hidden items-center justify-center bg-c50 p-8 lg:flex">
      <p className="t-big rise text-[52px] text-mute">Pick a doc, or press +</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Empty />} />
          <Route path="/doc/:id" element={<DocPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
