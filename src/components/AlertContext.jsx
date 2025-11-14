import { createContext, useContext, useState, useCallback } from 'react'
import GlassAlert from './GlassAlert'

const AlertContext = createContext()

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([])

  const showAlert = useCallback(({
    type = 'info',
    title,
    message,
    duration = 5000,
    position = 'top-right',
    autoClose = true
  }) => {
    const id = Date.now() + Math.random()
    setAlerts(prev => [...prev, { id, type, title, message, duration, position, autoClose }])
    return id
  }, [])

  const hideAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const showSuccess = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'success', title, message, ...options })
  }, [showAlert])

  const showError = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'error', title, message, ...options })
  }, [showAlert])

  const showWarning = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'warning', title, message, ...options })
  }, [showAlert])

  const showInfo = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'info', title, message, ...options })
  }, [showAlert])

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {/* Render all active alerts */}
      {alerts.map(alert => (
        <GlassAlert
          key={alert.id}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          duration={alert.duration}
          position={alert.position}
          autoClose={alert.autoClose}
          onClose={() => hideAlert(alert.id)}
        />
      ))}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}
