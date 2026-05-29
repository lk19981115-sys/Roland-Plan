import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect } from 'react'

interface ReleaseAnnouncementProps {
  version: string
  previousVersion: string
  title: string
  items: readonly string[]
  onClose: () => void
}

export function ReleaseAnnouncement({
  version,
  previousVersion,
  title,
  items,
  onClose,
}: ReleaseAnnouncementProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) {
        return
      }

      event.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="release-announcement-root" role="dialog" aria-modal="true" aria-label={`Roland-Plan v${version} 更新`}>
      <section className="release-announcement-card">
        <button className="release-announcement-close" type="button" onClick={onClose} aria-label="关闭更新提示" title="关闭">
          <X size={18} />
        </button>

        <div className="release-announcement-icon" aria-hidden="true">
          <Sparkles size={24} />
        </div>
        <span className="release-announcement-eyebrow">版本更新</span>
        <h2>Roland-Plan v{version}</h2>
        <p>
          从 v{previousVersion} 到 v{version}，{title}
        </p>

        <ul className="release-announcement-list">
          {items.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <button className="button button-primary release-announcement-action" type="button" onClick={onClose}>
          立即体验
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  )
}
