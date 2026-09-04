import { Fragment, type ReactNode } from 'react'
import { splitStartersBench } from './roster'

type RosterLinesProps<T> = {
  items: T[]
  isStarter: (item: T) => boolean
  itemKey: (item: T) => string
  render: (item: T) => ReactNode
}

export default function RosterLines<T>({ items, isStarter, itemKey, render }: RosterLinesProps<T>) {
  const { starters, bench } = splitStartersBench(items, isStarter)
  const showRule = starters.length > 0 && bench.length > 0

  return (
    <>
      {starters.map((item) => (
        <Fragment key={itemKey(item)}>{render(item)}</Fragment>
      ))}
      {showRule ? <hr className="roster-bench-rule" /> : null}
      {bench.map((item) => (
        <Fragment key={itemKey(item)}>{render(item)}</Fragment>
      ))}
    </>
  )
}
