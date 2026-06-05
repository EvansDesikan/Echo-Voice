import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
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

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <DemoNav />
        <Routes>
          {/* Public landing */}
          <Route path="/" element={<><Nav /><LandingPage /></>} />

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
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
