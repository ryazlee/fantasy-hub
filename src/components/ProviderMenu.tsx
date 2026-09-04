import { useEffect, useId, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { queryKeys } from '../hooks/queryKeys'
import { queryClient } from '../lib/queryClient'
import type { ProviderName } from '../domain/types'
import { disconnectProvider } from '../utils/storage'

function providerLabel(provider: ProviderName): string {
  if (provider === 'sleeper') return 'Sleeper'
  if (provider === 'yahoo') return 'Yahoo'
  return 'ESPN'
}

export type ProviderMenuItem = {
  label: string
  meta?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export default function ProviderMenu({
  provider,
  connected,
  items,
}: {
  provider: ProviderName
  connected: boolean
  items?: ProviderMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const name = providerLabel(provider)
  const menuItems =
    items ??
    ([
      {
        label: `Disconnect ${name}`,
        danger: true,
        disabled: !connected,
        onClick: () => {
          disconnectProvider(provider)
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        },
      },
    ] satisfies ProviderMenuItem[])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="overflow" ref={rootRef}>
      <button
        type="button"
        className="overflow__btn"
        aria-label={`${name} menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="overflow__menu" id={menuId} role="menu">
          {menuItems.map((item) => (
            <button
              key={`${item.label}:${item.meta ?? ''}`}
              type="button"
              role="menuitem"
              className={item.danger ? 'overflow__item overflow__item--danger' : 'overflow__item'}
              disabled={item.disabled}
              onClick={() => {
                item.onClick()
                setOpen(false)
              }}
            >
              <span className="overflow__item-text">
                {item.label}
                {item.meta ? <span className="overflow__item-meta">{item.meta}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
