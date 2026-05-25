import {
  ChevronDown,
  Cloud,
  Download,
  LogIn,
  LogOut,
  Palette,
  Settings,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, PageId } from '../types'
import {
  getCloudSession,
  loadCloudSave,
  onCloudAuthChange,
  signInWithGoogleAccount,
  signOutCloudAccount,
  uploadCloudSave,
} from '../storage/cloudSave'
import { isSupabaseConfigured, type CloudSession } from '../storage/supabaseClient'
import { Modal } from './Modal'

interface UserMenuProps {
  data: AppData
  onReplaceData: (data: AppData) => void
  onNavigate: (page: PageId) => void
}

interface UserProfile {
  displayName: string
}

const USER_PROFILE_KEY = 'roland-plan-user-profile-v1'

const readUserProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY)

    if (!raw) {
      return { displayName: '' }
    }

    const parsed = JSON.parse(raw) as Partial<UserProfile>

    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
    }
  } catch {
    return { displayName: '' }
  }
}

const saveUserProfile = (profile: UserProfile) => {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Profile settings are cosmetic; the app should keep running if localStorage is blocked.
  }
}

const getMetadataText = (session: CloudSession | null, keys: string[]) => {
  const metadata = session?.user.user_metadata

  for (const key of keys) {
    const value = metadata?.[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const getInitial = (name: string) => name.trim().charAt(0).toUpperCase() || 'R'

export function UserMenu({ data, onReplaceData, onNavigate }: UserMenuProps) {
  const [session, setSession] = useState<CloudSession | null>(null)
  const [profile, setProfile] = useState(readUserProfile)
  const [draftProfile, setDraftProfile] = useState(profile)
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('当前存档已自动保存')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    getCloudSession()
      .then(setSession)
      .catch(() => setSession(null))

    return onCloudAuthChange(setSession)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const accountName = useMemo(() => {
    const cloudName = getMetadataText(session, ['full_name', 'name', 'preferred_username'])

    return profile.displayName.trim() || cloudName || session?.user.email || '本地用户'
  }, [profile.displayName, session])
  const accountEmail = session?.user.email || '仅使用浏览器本地存档'
  const avatarUrl = getMetadataText(session, ['avatar_url', 'picture'])
  const isCloudUser = Boolean(session)

  const runCloudAction = async (action: () => Promise<void>) => {
    setBusy(true)

    try {
      await action()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '云存档操作失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = () => {
    runCloudAction(async () => {
      const updatedAt = await uploadCloudSave(data)
      setStatus(`手动存档已更新：${new Date(updatedAt).toLocaleString('zh-CN')}`)
    })
  }

  const handleRestore = () => {
    runCloudAction(async () => {
      const snapshot = await loadCloudSave()

      if (!snapshot) {
        setStatus('云端还没有存档。')
        return
      }

      const confirmed = window.confirm(
        `确认用云端存档覆盖当前本地存档？\n云端更新时间：${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`,
      )

      if (!confirmed) {
        return
      }

      onReplaceData(snapshot.data)
      setStatus(`已从云端恢复：${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`)
      setIsOpen(false)
    })
  }

  const handleSignOut = () => {
    runCloudAction(async () => {
      await signOutCloudAccount()
      setSession(null)
      setStatus('已退出云存档账号。')
    })
  }

  const handleGoogleSignIn = () => {
    runCloudAction(async () => {
      setStatus('正在打开 Google 登录...')
      await signInWithGoogleAccount()
    })
  }

  const openProfileSettings = () => {
    setDraftProfile(profile)
    setIsProfileOpen(true)
    setIsOpen(false)
  }

  const commitProfile = () => {
    const nextProfile = {
      displayName: draftProfile.displayName.trim(),
    }

    setProfile(nextProfile)
    saveUserProfile(nextProfile)
    setStatus('用户资料已更新。')
    setIsProfileOpen(false)
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="user-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(accountName)}
        </span>
        <span className="user-trigger-copy">
          <strong>{accountName}</strong>
          <small>{isCloudUser ? '云存档账号' : '本地模式'}</small>
        </span>
        <ChevronDown size={15} />
      </button>

      {isOpen ? (
        <div className="user-popover" role="menu">
          <div className="user-popover-head">
            <span className="user-avatar large">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(accountName)}
            </span>
            <div>
              <strong>{accountName}</strong>
              <span>{accountEmail}</span>
            </div>
          </div>

          <div className="user-status-card">
            <Cloud size={16} />
            <div>
              <strong>{isCloudUser ? '云存档已登录' : '本地模式'}</strong>
              <span>{status}</span>
            </div>
          </div>

          <div className="user-menu-actions">
            {isCloudUser ? (
              <>
                <button type="button" onClick={handleUpload} disabled={busy}>
                  <Upload size={16} />
                  上传手动存档
                </button>
                <button type="button" onClick={handleRestore} disabled={busy}>
                  <Download size={16} />
                  恢复手动存档
                </button>
              </>
            ) : (
              <button type="button" onClick={handleGoogleSignIn} disabled={busy || !isSupabaseConfigured}>
                <LogIn size={16} />
                使用 Google 登录
              </button>
            )}
            <button type="button" onClick={openProfileSettings}>
              <Palette size={16} />
              显示名称
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigate('settings')
                setIsOpen(false)
              }}
            >
              <Settings size={16} />
              账号与云存档
            </button>
            {isCloudUser ? (
              <button type="button" onClick={handleSignOut} disabled={busy}>
                <LogOut size={16} />
                退出登录
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isProfileOpen ? (
        <Modal title="用户资料" onClose={() => setIsProfileOpen(false)}>
          <div className="profile-editor">
            <div className="profile-preview">
              <span className="user-avatar large">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(draftProfile.displayName || accountName)}
              </span>
              <div>
                <strong>{draftProfile.displayName.trim() || accountName}</strong>
                <span>{isCloudUser ? '登录用户会优先显示 Google 头像' : '显示名称只保存在当前浏览器'}</span>
              </div>
            </div>

            <label>
              显示名称
              <input
                value={draftProfile.displayName}
                onChange={(event) => setDraftProfile((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={session?.user.email || '本地用户'}
              />
            </label>

            <div className="form-actions">
              <button className="button button-primary" type="button" onClick={commitProfile}>
                保存资料
              </button>
              <button className="button button-ghost" type="button" onClick={() => setIsProfileOpen(false)}>
                取消
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
