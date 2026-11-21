// Live Translate — entry
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource-variable/anuphan'
import './index.css'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ToastProvider placement="bottom-right" toastOffset={16} />
      <App />
    </HeroUIProvider>
  </StrictMode>,
)
