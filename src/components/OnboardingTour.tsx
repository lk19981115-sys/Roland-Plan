import { ArrowRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface TourStep {
  target: string
  title: string
  description: string
  placement: 'top' | 'right' | 'bottom' | 'left'
}

interface OnboardingTourProps {
  isOpen: boolean
  steps: TourStep[]
  onClose: () => void
}

interface HighlightBox {
  top: number
  left: number
  width: number
  height: number
}

const TOUR_PADDING = 8

const findVisibleTarget = (selector: string) => {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))

  return candidates.find((element) => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  })
}

const getHighlightBox = (element: HTMLElement): HighlightBox => {
  const rect = element.getBoundingClientRect()

  return {
    top: Math.max(8, rect.top - TOUR_PADDING),
    left: Math.max(8, rect.left - TOUR_PADDING),
    width: rect.width + TOUR_PADDING * 2,
    height: rect.height + TOUR_PADDING * 2,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function OnboardingTour({ isOpen, steps, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [highlight, setHighlight] = useState<HighlightBox | null>(null)
  const currentStep = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  useEffect(() => {
    if (!isOpen || !currentStep) {
      return
    }

    const updateHighlight = () => {
      const target = findVisibleTarget(currentStep.target)

      if (!target) {
        setHighlight(null)
        return
      }

      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      window.requestAnimationFrame(() => setHighlight(getHighlightBox(target)))
    }

    updateHighlight()
    window.addEventListener('resize', updateHighlight)
    window.addEventListener('scroll', updateHighlight, true)

    return () => {
      window.removeEventListener('resize', updateHighlight)
      window.removeEventListener('scroll', updateHighlight, true)
    }
  }, [currentStep, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !currentStep) {
    return null
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const fallbackTop = viewportHeight / 2 - 120
  const fallbackLeft = viewportWidth / 2 - 170
  const cardWidth = Math.min(340, viewportWidth - 32)
  const cardPosition = (() => {
    if (!highlight) {
      return {
        top: clamp(fallbackTop, 16, viewportHeight - 260),
        left: clamp(fallbackLeft, 16, viewportWidth - cardWidth - 16),
      }
    }

    switch (currentStep.placement) {
      case 'top':
        return {
          top: clamp(highlight.top - 214, 16, viewportHeight - 236),
          left: clamp(highlight.left + highlight.width / 2 - cardWidth / 2, 16, viewportWidth - cardWidth - 16),
        }
      case 'left':
        return {
          top: clamp(highlight.top + highlight.height / 2 - 112, 16, viewportHeight - 236),
          left: clamp(highlight.left - cardWidth - 18, 16, viewportWidth - cardWidth - 16),
        }
      case 'right':
        return {
          top: clamp(highlight.top + highlight.height / 2 - 112, 16, viewportHeight - 236),
          left: clamp(highlight.left + highlight.width + 18, 16, viewportWidth - cardWidth - 16),
        }
      case 'bottom':
      default:
        return {
          top: clamp(highlight.top + highlight.height + 18, 16, viewportHeight - 236),
          left: clamp(highlight.left + highlight.width / 2 - cardWidth / 2, 16, viewportWidth - cardWidth - 16),
        }
    }
  })()

  const goNext = () => {
    if (isLastStep) {
      onClose()
      return
    }

    setStepIndex((current) => current + 1)
  }

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="新手教程">
      <div className="tour-shade tour-shade-top" style={{ height: highlight?.top ?? 0 }} />
      <div
        className="tour-shade tour-shade-left"
        style={{
          top: highlight?.top ?? 0,
          width: highlight?.left ?? 0,
          height: highlight?.height ?? '100%',
        }}
      />
      <div
        className="tour-shade tour-shade-right"
        style={{
          top: highlight?.top ?? 0,
          left: highlight ? highlight.left + highlight.width : 0,
          height: highlight?.height ?? '100%',
        }}
      />
      <div
        className="tour-shade tour-shade-bottom"
        style={{ top: highlight ? highlight.top + highlight.height : 0 }}
      />

      {highlight ? (
        <div
          className="tour-highlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}

      <section
        className={`tour-card placement-${currentStep.placement}`}
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardWidth,
        }}
      >
        <button className="tour-close" type="button" onClick={onClose} aria-label="跳过教程" title="跳过教程">
          <X size={17} />
        </button>
        <span className="tour-step-count">
          {stepIndex + 1} / {steps.length}
        </span>
        <h2>{currentStep.title}</h2>
        <p>{currentStep.description}</p>
        <div className="tour-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>
            跳过
          </button>
          <button className="button button-primary" type="button" onClick={goNext}>
            {isLastStep ? '完成' : '下一步'}
            {!isLastStep ? <ArrowRight size={16} /> : null}
          </button>
        </div>
      </section>
    </div>
  )
}
