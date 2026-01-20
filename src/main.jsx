import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './performance.css'

// Suppress browser extension errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Receiving end does not exist') || 
      event.reason?.message?.includes('Could not establish connection')) {
    event.preventDefault()
    // Silently ignore extension errors
    return
  }
})

// Error handling for the root element
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// Create root with error boundary
const root = ReactDOM.createRoot(rootElement)

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('Failed to render app:', error)
  // Fallback rendering without StrictMode
  root.render(<App />)
}