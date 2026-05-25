interface ProgressBarProps {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div className="progress-block" aria-label={label}>
      <div className="progress-meta">
        {label ? <span>{label}</span> : <span>进度</span>}
        <strong>{safeValue}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}
