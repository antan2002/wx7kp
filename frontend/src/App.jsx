import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  fetchDecision,
  fetchAccuracy,
  fetchHealth
} from './api/client'

import BloombergDecisionDesk from './components/BloombergDecisionDesk'
import AccuracyAnalyticsView from './components/AccuracyAnalyticsView'
import MethodologyBriefView from './components/MethodologyBriefView'

import {
  Wind,
  Layers,
  BarChart3,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Activity,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'

import {
  DELIVERY_START,
  DELIVERY_END,
  DEFAULT_DELIVERY_DATE,
  DEFAULT_CUTOFF,
  ALL_JANUARY_DAYS
} from './config'

export default function App() {
  const [activeTab, setActiveTab] = useState('decision') // 'decision' | 'accuracy' | 'methodology'
  const [deliveryDate, setDeliveryDate] = useState(DEFAULT_DELIVERY_DATE)
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF)

  // Data states
  const [decisionData, setDecisionData] = useState(null)
  const [accuracyData, setAccuracyData] = useState(null)
  const [healthStatus, setHealthStatus] = useState(null)

  // Loading states
  const [loadingDecision, setLoadingDecision] = useState(true)
  const [loadingAccuracy, setLoadingAccuracy] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  // Health check
  useEffect(() => {
    fetchHealth()
      .then((res) => setHealthStatus(res))
      .catch(() => setHealthStatus({ status: 'offline' }))
  }, [])

  // Load Day-Specific Decision Model
  const loadDecision = useCallback(async (date, cut) => {
    setLoadingDecision(true)
    setErrorMsg(null)
    try {
      const res = await fetchDecision(date, cut)
      setDecisionData(res)
    } catch (err) {
      console.error('Failed to load decision data:', err)
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to load day decision model.')
    } finally {
      setLoadingDecision(false)
    }
  }, [])

  // Load Month-Wide Quantitative Accuracy
  const loadAccuracy = useCallback(async (cut) => {
    setLoadingAccuracy(true)
    try {
      const res = await fetchAccuracy(DELIVERY_START, DELIVERY_END, cut)
      setAccuracyData(res)
    } catch (err) {
      console.error('Failed to load accuracy data:', err)
    } finally {
      setLoadingAccuracy(false)
    }
  }, [])

  useEffect(() => {
    loadDecision(deliveryDate, cutoff)
  }, [deliveryDate, cutoff, loadDecision])

  useEffect(() => {
    loadAccuracy(cutoff)
  }, [cutoff, loadAccuracy])

  // Navigation handlers
  const handlePrevDay = () => {
    const curIndex = ALL_JANUARY_DAYS.indexOf(deliveryDate)
    if (curIndex > 0) {
      setDeliveryDate(ALL_JANUARY_DAYS[curIndex - 1])
    }
  }

  const handleNextDay = () => {
    const curIndex = ALL_JANUARY_DAYS.indexOf(deliveryDate)
    if (curIndex < ALL_JANUARY_DAYS.length - 1) {
      setDeliveryDate(ALL_JANUARY_DAYS[curIndex + 1])
    }
  }

  // Export CSV handler
  const handleExportCsv = () => {
    if (!decisionData?.periods || !decisionData.periods.length) return
    const headers = [
      'SettlementPeriod',
      'StartTimeUtc',
      'ForecastMw',
      'ActualMw',
      'ForecastErrorMw',
      'P10DownsideBandMw',
      'P90UpsideBandMw',
      'LeadHours',
      'ProcurementStatus'
    ]
    const rows = decisionData.periods.map((p) => {
      const err = (p.forecastMw || 0) - (p.actualMw || 0)
      const status = err > 100 ? 'Over-forecast' : err < -100 ? 'Under-forecast' : 'On Target'
      return [
        p.settlementPeriod,
        p.startTime,
        p.forecastMw ?? '',
        p.actualMw ?? '',
        Math.round(err * 10) / 10,
        p.bandLowMw ?? '',
        p.bandHighMw ?? '',
        p.leadHours ?? '',
        status
      ].join(',')
    })
    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `gustline_wind_decision_${deliveryDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Formatted last synced time
  const syncedTimestamp = useMemo(() => {
    if (!healthStatus?.data?.fetchedAt) return 'Live'
    const d = new Date(healthStatus.data.fetchedAt)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
  }, [healthStatus])

  return (
    <div className="app-wrapper">
      {/* Top Bar: Bloomberg / Light Enterprise Theme */}
      <header className="top-nav">
        <div className="top-nav__inner">
          {/* App Name + UK National Wind Badge */}
          <div className="brand-section">
            <div className="brand-icon-box">
              <Wind size={20} />
            </div>
            <div className="brand-titles">
              <h1>
                GUSTLINE
                <span className="badge-country">UK National Wind</span>
              </h1>
              <p>Day-Ahead Power Procurement &amp; Forecast Risk Intelligence · Elexon BMRS</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tab-group">
            <button
              className={`tab-btn ${activeTab === 'decision' ? 'active' : ''}`}
              onClick={() => setActiveTab('decision')}
            >
              <Wind size={15} />
              Forecast &amp; Decision Desk
            </button>
            <button
              className={`tab-btn ${activeTab === 'accuracy' ? 'active' : ''}`}
              onClick={() => setActiveTab('accuracy')}
            >
              <BarChart3 size={15} />
              Accuracy &amp; Error Analytics
            </button>
            <button
              className={`tab-btn ${activeTab === 'methodology' ? 'active' : ''}`}
              onClick={() => setActiveTab('methodology')}
            >
              <BookOpen size={15} />
              Methodology Brief
            </button>
          </div>

          {/* Topbar Status Badges & Actions */}
          <div className="header-actions">
            {/* D-1 Gate static label */}
            <div className="gate-badge" title="EPEX SPOT / Nord Pool auction gate closure">
              <Clock size={13} />
              D-1 Gate: 11:00 London
            </div>

            {/* Last Synced Timestamp */}
            <div className="sync-badge" title="Elexon BMRS FUELHH & WINDFOR stream sync status">
              <span className="sync-dot"></span>
              Synced: {syncedTimestamp}
            </div>

            {/* Export CSV button */}
            <button className="btn-export" onClick={handleExportCsv} title="Download 48 Settlement Periods CSV">
              <Download size={14} />
              Download CSV
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Control Toolbar: Date Selector & Gate Override */}
      <section className="toolbar-ribbon">
        <div className="toolbar-ribbon__inner">
          {/* Date Selector (Jan 1 - 31, 2026) */}
          <div className="control-field">
            <span className="control-field-label">Delivery Date:</span>
            <div className="date-selector-group">
              <button
                className="date-nav-btn"
                onClick={handlePrevDay}
                disabled={deliveryDate === DELIVERY_START}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                className="date-dropdown"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              >
                {ALL_JANUARY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </option>
                ))}
              </select>
              <button
                className="date-nav-btn"
                onClick={handleNextDay}
                disabled={deliveryDate === DELIVERY_END}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* D-1 Decision Gate Selector */}
          <div className="control-field">
            <span className="control-field-label">Auction Cut-off:</span>
            <select
              className="select-gate-input"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
            >
              <option value="07:00">07:00 London (Early Desk)</option>
              <option value="09:00">09:00 London (Pre-Auction)</option>
              <option value="11:00">11:00 London (UK Day-Ahead Standard)</option>
              <option value="12:00">12:00 London (Post-Auction)</option>
              <option value="14:00">14:00 London (Intraday Desk)</option>
              <option value="16:00">16:00 London (Late Afternoon)</option>
              <option value="18:00">18:00 London (Evening Close)</option>
            </select>
          </div>

          {/* Dataset Provenance Tag */}
          <div className="control-field" style={{ gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Source: <strong>Elexon BMRS FUELHH (Actuals) &amp; WINDFOR (Forecasts)</strong>
            </span>
            <button
              className="date-nav-btn"
              onClick={() => {
                loadDecision(deliveryDate, cutoff)
                loadAccuracy(cutoff)
              }}
              title="Refresh Analytics"
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      </section>

      {/* Main Layout Area */}
      <main className="main-layout">
        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '6px', color: '#B91C1C', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Tab 1: Forecast & Decision Desk (Bloomberg Style) */}
        {activeTab === 'decision' && (
          <BloombergDecisionDesk
            decisionData={decisionData}
            accuracyData={accuracyData}
            loading={loadingDecision}
            deliveryDate={deliveryDate}
            cutoff={cutoff}
            onSelectDate={(newDate) => setDeliveryDate(newDate)}
            onExportCsv={handleExportCsv}
          />
        )}

        {/* Tab 2: Accuracy & Error Analytics */}
        {activeTab === 'accuracy' && (
          <AccuracyAnalyticsView
            data={accuracyData}
            loading={loadingAccuracy}
          />
        )}

        {/* Tab 3: Methodology Brief */}
        {activeTab === 'methodology' && (
          <MethodologyBriefView />
        )}
      </main>

      {/* Enterprise Footer */}
      <footer className="app-footer">
        <div className="app-footer__inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <strong style={{ color: '#1E40AF' }}>Gustline Energy Intelligence</strong>
            <span>·</span>
            <span>UK National Wind Power Procurement System</span>
            <span>·</span>
            <span>48 Settlement Periods (30m Resolution)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>Empirical P10/P90 Quantile Corridors</span>
            <span>·</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>January 2026 Evaluation Scope</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
