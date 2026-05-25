interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true" />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  )
}
