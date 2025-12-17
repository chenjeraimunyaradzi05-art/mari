"use client"
import React, { useState } from 'react'
import type { Profile as PrismaProfile } from '@prisma/client'

type Props = {
  profile?: PrismaProfile | null
}

export default function ProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [handle, setHandle] = useState(profile?.handle || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [pronouns, setPronouns] = useState(profile?.pronouns || '')
  const [avatarPath, setAvatarPath] = useState(profile?.avatarPath || '')
  const [coverPath, setCoverPath] = useState(profile?.coverPath || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatarPath || null)
  const [coverPreview, setCoverPreview] = useState<string | null>(profile?.coverPath || null)
  const [skillsText, setSkillsText] = useState<string>(
    Array.isArray(profile?.skills) ? (profile.skills || []).join(', ') : (profile?.skills as string) || ''
  )
  const [interestsText, setInterestsText] = useState<string>(
    Array.isArray(profile?.interests) ? (profile.interests || []).join(', ') : (profile?.interests as string) || ''
  )
  const [goalsText, setGoalsText] = useState<string>(
    Array.isArray(profile?.goals) ? (profile.goals || []).join(', ') : (profile?.goals as string) || ''
  )
  const [privacyLevel, setPrivacyLevel] = useState(profile?.privacyLevel || 'public')
  const [womenSafetyMode, setWomenSafetyMode] = useState(!!profile?.womenSafetyMode)
  const [privacySettings, setPrivacySettings] = useState<Record<string, string>>(
    (profile as any)?.privacySettings || {
      resume: 'public',
      contact_info: 'public',
      family_details: 'public',
      aspirations: 'public',
    },
  )
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setWorking(true)
    setMessage(null)
    try {
      const payload: Record<string, unknown> = { displayName, handle, bio, location, pronouns, privacyLevel, womenSafetyMode }
      payload.privacySettings = privacySettings
      if (avatarPath) payload.avatarPath = avatarPath
      if (coverPath) payload.coverPath = coverPath
      if (skillsText) payload.skills = skillsText
      if (interestsText) payload.interests = interestsText
      if (goalsText) payload.goals = goalsText

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'save_failed')
      setMessage('Saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg || String(err))
    } finally {
      setWorking(false)
    }
  }

  async function uploadFile(file: File, kind: 'avatar' | 'cover') {
    const reader = new FileReader()
    return new Promise<void>((resolve, reject) => {
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string
          // strip data: prefix
          const [, base64] = dataUrl.split(',')
                const res = await fetch('/api/profile/upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileName: file.name, contentType: file.type, data: base64, purpose: kind }),
                })
          const json = (await res.json()) as Record<string, unknown>
          if (!res.ok) throw new Error((json.error as string) || 'upload_failed')
                const p = String(json.path ?? '')
                const thumb = String(json.thumbnailPath ?? '')
                if (kind === 'avatar') {
                  setAvatarPath(p)
                  setAvatarPreview(thumb || p)
                } else {
                  setCoverPath(p)
                  setCoverPreview(thumb || p)
                }
          resolve()
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  async function onFileInput(e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'cover') {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      if (kind === 'avatar') setAvatarUploading(true)
      else setCoverUploading(true)
      await uploadFile(file, kind)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg || 'upload failed')
    } finally {
      if (kind === 'avatar') setAvatarUploading(false)
      else setCoverUploading(false)
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <div>
        <label className="block text-sm font-medium">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Handle</label>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Pronouns</label>
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={womenSafetyMode} onChange={(e) => setWomenSafetyMode(e.target.checked)} />
          <span className="text-sm">Women safety mode</span>
        </label>
        <select value={privacyLevel} onChange={(e) => setPrivacyLevel(e.target.value)} className="rounded border px-2 py-1">
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="connections">Connections</option>
        </select>
      </div>

      <div className="mt-6 bg-white p-4 border rounded">
        <h3 className="text-lg font-semibold mb-3">Privacy Settings</h3>
        <p className="text-sm text-gray-600 mb-3">Control who can see specific parts of your profile.</p>
        {[
          ['resume', 'Resume Visibility'],
          ['contact_info', 'Contact Information'],
          ['family_details', 'Family Details'],
          ['aspirations', 'Career Aspirations'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between p-2 border-b">
            <div className="text-sm font-medium">{label}</div>
            <select
              value={privacySettings[key as string] ?? 'public'}
              onChange={(e) => setPrivacySettings((s) => ({ ...s, [key as string]: e.target.value }))}
              className="rounded border px-2 py-1"
            >
              <option value="public">Public</option>
              <option value="friends">Friends Only</option>
              <option value="recruiters">Recruiters Only</option>
              <option value="private">Private</option>
            </select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Avatar</label>
          <div className="mt-2 flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
              {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500">No avatar</span>}
            </div>
            <div>
              <input type="file" accept="image/*" onChange={(e) => onFileInput(e, 'avatar')} />
              {avatarUploading ? <p className="text-xs text-gray-500 mt-1">Uploading…</p> : null}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Cover</label>
          <div className="mt-2">
            {coverPreview ? <img src={coverPreview} alt="cover" className="w-full h-24 object-cover rounded" /> : <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No cover</div>}
            <div className="mt-2">
              <input type="file" accept="image/*" onChange={(e) => onFileInput(e, 'cover')} />
              {coverUploading ? <p className="text-xs text-gray-500 mt-1">Uploading…</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Skills (comma separated)</label>
        <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Interests (comma separated)</label>
        <input value={interestsText} onChange={(e) => setInterestsText(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Goals (comma separated)</label>
        <input value={goalsText} onChange={(e) => setGoalsText(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
      </div>

      <div>
        <button type="submit" disabled={working} className="px-4 py-2 bg-blue-600 text-white rounded">
          {working ? 'Saving…' : 'Save profile'}
        </button>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </div>
    </form>
  )
}

