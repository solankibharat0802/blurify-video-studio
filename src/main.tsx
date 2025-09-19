import { createRoot } from 'react-dom/client'
import { AuthProvider } from './hooks/useAuth'
import { SubscriptionProvider } from './hooks/useSubscription'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </AuthProvider>
);
