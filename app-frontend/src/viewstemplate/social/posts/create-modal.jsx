// Auto-generated React page/component from Blade: create-modal.jsx
import React, { useState } from 'react'
import FocusTrap from 'focus-trap-react'

export default function create_modal({ open=false, onClose, onPosted, currentUser, locale='en', translations = {} }){
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const defaultTrans = {
    create_post: 'Create Post',
    placeholder: 'What\'s on your mind?',
    post: 'Post',
    cancel: 'Cancel',
    posting: 'Posting...',
    unauthorized: 'You do not have permission to post.',
    posted: 'Posted',
    error: 'Error posting'
  }

  function t(key){
    // translations can be provided as { key: value } or { locale: { key: value } }
    if (translations && translations[locale] && translations[locale][key]) return translations[locale][key]
    if (translations && translations[key]) return translations[key]
    return defaultTrans[key] || key
  }

  const canPost = (()=>{
    if (!currentUser) return true // allow anonymous posting for demo/stubbed auth
    if (Array.isArray(currentUser.roles) && currentUser.roles.includes('banned')) return false
    if (Array.isArray(currentUser.roles) && currentUser.roles.includes('poster') === false && currentUser.roles.length>0) return false
    return true
  })()

  async function submit(e){
    e && e.preventDefault()
    if (!canPost) { setError(t('unauthorized')); return }
    if (!text && !file) { setError('Please add content or media'); return }
    setLoading(true); setError(null); setSuccess(null)
    try{
      const form = new FormData()
      form.append('content', text)
      if (file) form.append('media', file)
      const res = await fetch((import.meta.env.VITE_API_URL||'') + '/api/frontend/social/posts', { method: 'POST', body: form, headers: { 'x-user-id': (currentUser && currentUser.id) ? currentUser.id : 'user_id_1' } })
      if (res.ok){ setSuccess(t('posted')); setText(''); setFile(null); onPosted && onPosted(); }
      else {
        const body = await res.json().catch(()=>null)
        setError(body && body.error ? body.error : t('error'))
      }
    }catch(err){ setError(err.message || t('error')) }
    finally{ setLoading(false) }
  }

  if (!open) return null

  return (
    <div id="create-post-modal" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <FocusTrap active={open} focusTrapOptions={{ onDeactivate: onClose, escapeDeactivates: true }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose}></div>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: 520, maxWidth: '95%', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', zIndex: 1001 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>{t('create_post')}</strong>
          <button onClick={onClose} aria-label="close">✕</button>
        </div>
        {!canPost && <div style={{ padding: 12, background: '#fff4f4', borderRadius: 6, marginBottom: 8 }}>{t('unauthorized')}</div>}
        <form onSubmit={submit}>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder={t('placeholder')} style={{ width: '100%', marginBottom: 8 }}></textarea>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" onChange={e=>setFile(e.target.files[0])} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose}>{t('cancel')}</button>
              <button type="submit" disabled={loading || !canPost}>{loading ? t('posting') : t('post')}</button>
            </div>
          </div>
          {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
          {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
        </form>
      </div>
      </FocusTrap>
    </div>
  )
}
