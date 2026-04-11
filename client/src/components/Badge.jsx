const config = {
  paid:        { label: 'Pagó',      className: 'bg-green-100 text-green-800' },
  absent:      { label: 'Ausente',   className: 'bg-yellow-100 text-yellow-800' },
  rescheduled: { label: 'Reagendado', className: 'bg-blue-100 text-blue-800' },
}

export default function Badge({ status }) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
