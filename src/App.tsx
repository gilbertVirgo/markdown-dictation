import { BrowserRouter, Outlet, Route, Routes, useMatch } from 'react-router'
import DocList from './pages/DocList'
import DocPage from './pages/DocPage'
import Login from './pages/Login'

// Keyed Outlet remounts DocPage per doc, so one useAutosave never spans two docs.
// Phone: list and doc are separate screens. Desktop (lg): the list is a permanent sidebar beside the doc.
export function Shell() {
  const id = useMatch('/doc/:id')?.params.id
  return (
    <>
      <aside className={`${id ? 'hidden' : ''} lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-70 lg:overflow-y-auto`}>
        <DocList />
      </aside>
      <Outlet key={id} />
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
