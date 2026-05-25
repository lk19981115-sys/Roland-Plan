import {
  ArrowRight,
  Clock,
  Cloud,
  Database,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  signInCloudAccount,
  signInWithGoogleAccount,
  signUpCloudAccount,
} from '../storage/cloudSave'
import { isSupabaseConfigured } from '../storage/supabaseClient'

interface WelcomeGateProps {
  onContinueLocal: () => void
  onSignedIn: () => void
}

export function WelcomeGate({ onContinueLocal, onSignedIn }: WelcomeGateProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isEmailOpen, setIsEmailOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<'google' | 'sign-in' | 'sign-up' | null>(null)
  const [message, setMessage] = useState('登录后可使用云存档；也可以直接跳过，继续使用本地存档。')

  const runAuthAction = async (
    action: 'google' | 'sign-in' | 'sign-up',
    handler: () => Promise<void>,
  ) => {
    setBusyAction(action)

    try {
      await handler()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录操作失败，请稍后再试。')
    } finally {
      setBusyAction(null)
    }
  }

  const submitEmailAuth = (mode: 'sign-in' | 'sign-up') => {
    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      setMessage('请先填写邮箱和密码。')
      return
    }

    runAuthAction(mode, async () => {
      const session =
        mode === 'sign-in'
          ? await signInCloudAccount(normalizedEmail, password)
          : await signUpCloudAccount(normalizedEmail, password)

      setPassword('')

      if (session) {
        setMessage('登录成功，正在进入 Roland-Plan。')
        onSignedIn()
        return
      }

      setMessage('注册成功，请先检查邮箱完成确认，然后再登录。')
    })
  }

  const handleEmailAuth = (mode: 'sign-in' | 'sign-up') => (event: FormEvent) => {
    event.preventDefault()
    submitEmailAuth(mode)
  }

  const handleGoogleSignIn = () => {
    runAuthAction('google', async () => {
      setMessage('正在打开 Google 登录...')
      await signInWithGoogleAccount()
    })
  }

  const isBusy = busyAction !== null

  return (
    <main className="welcome-gate" aria-label="Roland-Plan 登录入口">
      <div className="welcome-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <section className="welcome-stage">
        <section className="welcome-hero">
          <div className="welcome-logo-shell" aria-hidden="true">
            <div className="welcome-brand-mark">
              <Clock size={40} strokeWidth={1.9} />
            </div>
          </div>

          <div className="welcome-copy">
            <p>Roland-Plan</p>
            <h1>日程表系统</h1>
            <strong>良辰勿向白驹乞，好景莫与东风借！</strong>
          </div>

          <div className="welcome-promises">
            <span>
              <Database size={15} />
              本地自动保存
            </span>
            <span>
              <Cloud size={15} />
              云存档可选
            </span>
            <span>
              <ShieldCheck size={15} />
              多端同步预备
            </span>
          </div>
        </section>

        <section className="welcome-auth-card">
          <div className="welcome-card-heading">
            <span>INITIALIZE ROLAND-PLAN</span>
            <p>{message}</p>
          </div>

          {isSupabaseConfigured ? (
            <>
              <div className="welcome-primary-actions">
                <button
                  className="welcome-orbit-button"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isBusy}
                >
                  {busyAction === 'google' ? <Loader2 className="spin-icon" size={18} /> : <ShieldCheck size={18} />}
                  <span>使用 Google 登录</span>
                </button>

                <button className="welcome-skip-button" type="button" onClick={onContinueLocal} disabled={isBusy}>
                  跳过登录
                  <ArrowRight size={17} />
                </button>
              </div>

              <button
                className="welcome-email-toggle"
                type="button"
                onClick={() => setIsEmailOpen((current) => !current)}
                aria-expanded={isEmailOpen}
              >
                <Mail size={16} />
                邮箱登录 / 注册
              </button>

              {isEmailOpen ? (
                <form className="welcome-auth-form" onSubmit={handleEmailAuth('sign-in')}>
                  <label className="welcome-input">
                    <Mail size={16} />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="邮箱"
                      autoComplete="email"
                    />
                  </label>
                  <label className="welcome-input">
                    <Lock size={16} />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="密码"
                      autoComplete="current-password"
                    />
                  </label>
                  <div className="welcome-auth-actions">
                    <button className="button button-ghost" type="submit" disabled={isBusy}>
                      {busyAction === 'sign-in' ? <Loader2 className="spin-icon" size={17} /> : <ArrowRight size={17} />}
                      邮箱登录
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => submitEmailAuth('sign-up')}
                      disabled={isBusy}
                    >
                      注册账号
                    </button>
                  </div>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <div className="welcome-local-note">
                当前未配置云存档，仍可完整使用本地模式。
              </div>
              <button className="welcome-orbit-button" type="button" onClick={onContinueLocal}>
                <Database size={18} />
                <span>使用本地存档</span>
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
