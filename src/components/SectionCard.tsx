import type { ReactNode } from 'react'

type SectionCardProps = {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export default function SectionCard({
  title,
  subtitle,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={['surface-card', className].filter(Boolean).join(' ')}>
      {title ? (
        <div className="surface-card__header">
          <p className="section-label">{title}</p>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="surface-card__body">{children}</div>
    </section>
  )
}
