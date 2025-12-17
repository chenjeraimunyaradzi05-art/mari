export type Profile = {
  displayName: string
  handle: string
  avatarPath?: string | null
}

export type Post = {
  id: string
  content: string
  createdAt: string | Date
  imagePath?: string | null
  author: {
    id: string
    name?: string | null
    email?: string | null
    profiles?: Profile[]
  }
}
