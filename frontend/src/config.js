export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) ||
  ''
export const API_URL = API_BASE_URL

export const DELIVERY_MONTH = '2026-01'
export const DELIVERY_START = `${DELIVERY_MONTH}-01`
export const DELIVERY_END = `${DELIVERY_MONTH}-31`
export const DEFAULT_DELIVERY_DATE = `${DELIVERY_MONTH}-15`
export const DEFAULT_CUTOFF = '11:00'

export const ALL_JANUARY_DAYS = Array.from(
  { length: 31 },
  (_, i) => `${DELIVERY_MONTH}-${String(i + 1).padStart(2, '0')}`
)
