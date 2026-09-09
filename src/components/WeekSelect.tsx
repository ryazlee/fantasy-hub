export default function WeekSelect({
  week,
  weekCount,
  currentWeek,
  onChange,
}: {
  week: number
  weekCount: number
  currentWeek?: number
  onChange: (week: number) => void
}) {
  const weeks = Array.from({ length: weekCount }, (_, index) => index + 1)
  return (
    <label className="week-select">
      <span className="week-select__label">Week</span>
      <select
        className="week-select__control"
        aria-label="Scoring week"
        value={week}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {weeks.map((value) => (
          <option key={value} value={value}>
            {value === currentWeek ? `${value} · now` : String(value)}
          </option>
        ))}
      </select>
    </label>
  )
}
