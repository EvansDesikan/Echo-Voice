import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import Nav from './components/Nav'
import DemoNav from './components/DemoNav'
import LandingPage from './pages/LandingPage'
import ConsentPage from './pages/onboarding/ConsentPage'
import VoiceEnrollmentPage from './pages/onboarding/VoiceEnrollmentPage'
import QuestionnairePage from './pages/onboarding/QuestionnairePage'
import PhraseBankPage from './pages/onboarding/PhraseBankPage'
import MemoriesPage from './pages/onboarding/MemoriesPage'
import OnboardingCompletePage from './pages/onboarding/OnboardingCompletePage'
import SessionStartPage from './pages/family/SessionStartPage'
import VoiceChatPage from './pages/family/VoiceChatPage'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminClientDetailPage from './pages/admin/AdminClientDetailPage'

export default function App() {
  return (
    <ThemeProvider>
    <LanguageProvider>
      <BrowserRouter>
        <DemoNav />
        <Routes>
          {/* Public landing */}
          <Route path="/" element={<><Nav /><LandingPage /></>} />
          <Route path="/login" element={<LoginPage />} />

          {/* Client onboarding flow */}
          <Route path="/onboarding/consent"    element={<ConsentPage />} />
          <Route path="/onboarding/voice"      element={<VoiceEnrollmentPage />} />
          <Route path="/onboarding/quiz"       element={<QuestionnairePage />} />
          <Route path="/onboarding/phrases"    element={<PhraseBankPage />} />
          <Route path="/onboarding/memories"   element={<MemoriesPage />} />
          <Route path="/onboarding/complete"   element={<OnboardingCompletePage />} />

          {/* Family interaction */}
          <Route path="/family"                element={<SessionStartPage />} />
          <Route path="/family/chat/:sessionId" element={<VoiceChatPage />} />

          {/* Admin — no Nav wrapper, internal tool */}
          <Route path="/admin"                       element={<AdminLoginPage />} />
          <Route path="/admin/dashboard"             element={<AdminDashboardPage />} />
          <Route path="/admin/client/:clientId"      element={<AdminClientDetailPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
    </ThemeProvider>
  )
}
