export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (res.status === 401 && location.pathname !== '/login') location.replace('/login')
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? res.statusText)
  return res.json() as Promise<T>
}
