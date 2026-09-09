import { useEffect, useId, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

export type OverflowToggleItem = {
  type: 'toggle'
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}

export type OverflowSelectItem = {
  type: 'select'
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
}

export type OverflowMenuItem = OverflowToggleItem | OverflowSelectItem

export default function OverflowMenu({
  label,
  items,
}: {
  label: string
  items: OverflowMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const baseId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (rootRef.current?.contains(target as Node)) return
      if (target instanceof Element && (target.tagName === 'OPTION' || target.closest('select'))) return
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
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="overflow__menu" id={menuId} role="dialog" aria-label={label}>
          {items.map((item, index) => {
            if (item.type === 'select') {
              const selectId = `${baseId}-select-${index}`
              return (
                <div key={item.label} className="overflow__row overflow__row--select">
                  <label className="overflow__row-label" htmlFor={selectId}>
                    {item.label}
                  </label>
                  <select
                    id={selectId}
                    className="overflow__select"
                    value={item.value}
                    onChange={(event) => item.onChange(event.target.value)}
                  >
                    {item.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            }

            return (
              <label key={item.label} className="overflow__row">
                <span className="overflow__row-label">{item.label}</span>
                <input
                  className="switch"
                  type="checkbox"
                  checked={item.checked}
                  onChange={(event) => item.onChange(event.target.checked)}
                />
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
