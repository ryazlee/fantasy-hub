import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
  title: string
  subtitle?: string
  extra?: ReactNode
}

export default function AppHeader({ title, subtitle, extra }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand-block">
          <div className="brand-row">
            <h1 className="brand">
              <Link to="/">
                <img
                  className="brand__mark"
                  src={`${import.meta.env.BASE_URL}favicon.png`}
                  alt=""
                  width={24}
                  height={24}
                />
                <span>{title}</span>
              </Link>
            </h1>
          </div>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
        <div className="header-actions">
          {extra}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
