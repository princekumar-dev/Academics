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
    'top-right': 'notification-container notification-top-right',
    'top-left': 'notification-container notification-top-left',
    'top-center': 'notification-container notification-top-center',
    'bottom-right': 'notification-container notification-bottom-right',
    'bottom-left': 'notification-container notification-bottom-left',
    'bottom-center': 'notification-container notification-bottom-center',
    'center': 'notification-container notification-center'
  }

  return (
    <div className={`${positions[position]}`}>
      {/* Enhanced Glassmorphism Alert Box */}
      <div 
        className={`
          glass-notification notification-interactive
          relative w-full sm:min-w-[320px] sm:max-w-md 
          rounded-2xl sm:rounded-3xl
          border-2 ${borderColors[type]}
          p-4 sm:p-5
          before:absolute before:inset-0 
          before:rounded-2xl sm:before:rounded-3xl 
          before:bg-gradient-to-br 
          before:from-white/20 before:to-transparent 
          before:pointer-events-none
          transform-gpu
        `}
      >
        {/* Enhanced Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 
                     p-1.5 sm:p-2 rounded-lg sm:rounded-xl
                     bg-white/60 hover:bg-white/80 active:bg-white/90
                     backdrop-blur-sm border border-white/20
                     transition-all duration-200 
                     hover:scale-110 active:scale-95
                     shadow-sm hover:shadow-md
                     touch-manipulation"
            aria-label="Close alert"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-700" />
          </button>
        )}

        {/* Enhanced Alert Content */}
        <div className="flex items-start gap-3 sm:gap-4 pr-8 sm:pr-10">
          {/* Enhanced Icon */}
          <div className="flex-shrink-0 mt-1 p-2 rounded-xl bg-white/40 backdrop-blur-sm">
            {icons[type]}
          </div>

          {/* Enhanced Text Content */}
          <div className="flex-1 min-w-0 pt-1">
            {title && (
              <h3 className="text-gray-900 font-bold text-sm sm:text-base mb-1.5 
                           drop-shadow-sm break-words leading-tight">
                {title}
              </h3>
            )}
            {message && (
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed 
                          drop-shadow-sm break-words opacity-90">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Enhanced Progress Bar (for auto-close) */}
        {autoClose && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 sm:h-2 
                        bg-white/10 rounded-b-2xl sm:rounded-b-3xl overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-theme-gold-400 to-theme-gold-600
                       shadow-sm"
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
