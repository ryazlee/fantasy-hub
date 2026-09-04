import { useSavedConfig } from '../../hooks/useSavedConfig'
import { savePrefs, type DashboardPrefs } from '../../utils/storage'

type TogglePref = Extract<keyof DashboardPrefs, 'showBench' | 'showOpponents'>

export default function PrefToggle({ pref, label }: { pref: TogglePref; label: string }) {
  const on = useSavedConfig().prefs[pref]

  return (
    <button
      type="button"
      className={on ? 'chip chip--on' : 'chip'}
      aria-pressed={on}
      onClick={() => savePrefs({ [pref]: !on })}
    >
      {label}
    </button>
  )
}
