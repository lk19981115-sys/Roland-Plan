import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}

const modalStack: string[] = []

export function Modal({ title, children, onClose, className }: ModalProps) {
  const modalId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    modalStack.push(modalId)

    const closeTopModal = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.isComposing ||
        modalStack[modalStack.length - 1] !== modalId
      ) {
        return
      }

      event.preventDefault()
      onCloseRef.current()
    }

    document.addEventListener('keydown', closeTopModal)

    return () => {
      const index = modalStack.lastIndexOf(modalId)

      if (index >= 0) {
        modalStack.splice(index, 1)
      }

      document.removeEventListener('keydown', closeTopModal)
    }
  }, [modalId])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={className ? `modal ${className}` : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭" title="关闭">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
