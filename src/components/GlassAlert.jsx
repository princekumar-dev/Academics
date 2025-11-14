import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export default function GlassAlert({ 
  type = 'info', 
  title, 
  message, 
  onClose, 
  autoClose = true, 
  duration = 5000,
  position = 'top-right' 
}) {
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onClose])

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-400" />,
    error: <AlertCircle className="w-6 h-6 text-red-400" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-400" />,
    info: <Info className="w-6 h-6 text-blue-400" />
  }

  const borderColors = {
    success: 'border-green-400/30',
    error: 'border-red-400/30',
    warning: 'border-yellow-400/30',
    info: 'border-blue-400/30'
  }

  const positions = {
    'top-right': 'top-4 right-4 sm:right-4 left-4 sm:left-auto',
    'top-left': 'top-4 left-4 right-4 sm:right-auto',
    'top-center': 'top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2',
    'bottom-right': 'bottom-4 right-4 sm:right-4 left-4 sm:left-auto',
    'bottom-left': 'bottom-4 left-4 right-4 sm:right-auto',
    'bottom-center': 'bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2',
    'center': 'top-1/2 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 -translate-y-1/2'
  }

  return (
    <div 
      className={`fixed ${positions[position]} z-50 animate-slide-in px-4 sm:px-0`}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      {/* Glassmorphism Alert Box */}
      <div 
        className={`
          relative w-full sm:min-w-[320px] sm:max-w-md rounded-2xl
          backdrop-blur-xl bg-white/90 
          border ${borderColors[type]}
          shadow-2xl shadow-black/20
          p-4
          before:absolute before:inset-0 
          before:rounded-2xl before:bg-gradient-to-br 
          before:from-white/30 before:to-white/10 
          before:pointer-events-none
          hover:shadow-3xl hover:shadow-black/30
          transition-all duration-300
        `}
        style={{
          backdropFilter: 'blur(16px) saturate(180%)',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))',
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-lg 
                     bg-gray-200/80 hover:bg-gray-300/90 
                     transition-colors duration-200
                     backdrop-blur-sm"
            aria-label="Close alert"
          >
            <X className="w-4 h-4 text-gray-700" />
          </button>
        )}

        {/* Alert Content */}
        <div className="flex items-start gap-2 sm:gap-3 pr-6 sm:pr-8">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {icons[type]}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-gray-900 font-semibold text-sm sm:text-base mb-1 drop-shadow-sm break-words">
                {title}
              </h3>
            )}
            {message && (
              <p className="text-gray-800 text-xs sm:text-sm leading-relaxed drop-shadow-sm break-words">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar (for auto-close) */}
        {autoClose && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-2xl overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-white/40 to-white/60"
              style={{
                animation: `progress ${duration}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing alerts
export function useGlassAlert() {
  const [alerts, setAlerts] = useState([])

  const showAlert = useCallback((alertConfig) => {
    const id = Date.now()
    setAlerts(prev => [...prev, { ...alertConfig, id }])
    return id
  }, [])

  const hideAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const AlertContainer = () => (
    <>
      {alerts.map(alert => (
        <GlassAlert
          key={alert.id}
          {...alert}
          onClose={() => hideAlert(alert.id)}
        />
      ))}
    </>
  )

  return { showAlert, hideAlert, AlertContainer }
}

// React import for the hook
import { useState, useCallback } from 'react'
