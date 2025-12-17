import React, { useState } from 'react'

export default function Composer({ onPosted }){
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState(null)

  async function submit(e){
    e.preventDefault()
    const form = new FormData()
    form.append('content', text)
    if (file) form.append('media', file)
    const API_BASE = (typeof window !== 'undefined' && window.__VITE_API_URL__) || (typeof process !== 'undefined' && process.env.VITE_API_URL) || ''
    const res = await postContent({ form, API_BASE, userId: 'user_id_1' })
    if (res.ok){ setMsg('Posted'); setText(''); setFile(null); onPosted && onPosted() }
    else setMsg('Error posting')
  }

  return (
    // eslint-disable-next-line no-console
    console.error('Composer render') ||
    <form onSubmit={submit} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12 }}>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} style={{ width: '100%', marginBottom: 8 }}></textarea>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="file" onChange={e=>setFile(e.target.files[0])} />
        <button type="submit">Post</button>
      </div>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </form>
  )
}

// exported for easier unit testing of the network behavior
export async function postContent({ form, API_BASE = '', userId = '' }){
  const res = await fetch(API_BASE + '/api/frontend/social/posts', { method: 'POST', body: form, headers: { 'x-user-id': userId } })
  return res
}
