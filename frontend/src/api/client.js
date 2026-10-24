import axios from 'axios'
import { API_BASE_URL } from '../config'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

export async function fetchActuals(from, to) {
  const res = await api.get('/api/actuals', { params: { from, to } })
  return res.data
}

export async function fetchForecasts(from, to, cutoff) {
  const res = await api.get('/api/forecasts', { params: { from, to, cutoff } })
  return res.data
}

export async function fetchAccuracy(from, to, cutoff) {
  const res = await api.get('/api/accuracy', { params: { from, to, cutoff } })
  return res.data
}

export async function fetchConfig() {
  const res = await api.get('/api/config')
  return res.data
}

export async function fetchDecision(deliveryDate, cutoff) {
  const res = await api.get('/api/decision', { params: { delivery_date: deliveryDate, cutoff } })
  return res.data
}

export async function fetchVintages(deliveryDate, cutoff) {
  const res = await api.get('/api/vintages', { params: { delivery_date: deliveryDate, cutoff } })
  return res.data
}

export async function fetchQuality() {
  const res = await api.get('/api/quality')
  return res.data
}

export async function fetchHealth() {
  const res = await api.get('/api/health')
  return res.data
}
