import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { useActiveProfile } from '@/db/queries'
import { ensureSeeded } from '@/db/seed'
import { applyAccent } from '@/theme/accents'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { MealsPage } from '@/features/meals/MealsPage'
import { MealBuilderPage } from '@/features/meals/MealBuilderPage'
import { MealDetailPage } from '@/features/meals/MealDetailPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TabBar } from './TabBar'

export function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureSeeded().then(() => setReady(true))
  }, [])

  if (!ready) return <Splash />

  return (
    <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AccentSync />
        <Shell />
      </BrowserRouter>
    </ToastProvider>
  )
}

function Shell() {
  return (
    <div className="min-h-dvh bg-bg">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/meals" element={<MealsPage />} />
        <Route path="/meals/new" element={<MealBuilderPage />} />
        <Route path="/meals/:id/edit" element={<MealBuilderPage />} />
        <Route path="/meals/:id" element={<MealDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
      <ScrollReset />
    </div>
  )
}

function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AccentSync() {
  const profile = useActiveProfile()
  useEffect(() => {
    applyAccent(profile?.accent)
  }, [profile?.accent])
  return null
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <p className="text-sm font-bold text-ink-soft">Macro Tracker</p>
    </div>
  )
}
