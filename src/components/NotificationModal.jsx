import { useEffect } from 'react'

// Confirmation Dialog Component
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeStyles = {
    danger: {
      button: 'bg-red-600 hover:bg-red-700',
      icon: '⚠️',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    warning: {
      button: 'bg-yellow-600 hover:bg-yellow-700',
      icon: '⚠️',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600'
    },
    info: {
      button: 'bg-blue-600 hover:bg-blue-700',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    }
  }

  const style = typeStyles[type] || typeStyles.danger

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm no-mobile-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${style.iconBg} mb-4`}>
          <span className={`text-2xl ${style.iconColor}`}>{style.icon}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 px-4 py-2.5 ${style.button} text-white font-medium rounded-lg transition-colors duration-200 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Toast Notification Component
export function Toast({ isOpen, onClose, message, type = 'success', duration = 3000 }) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  const typeStyles = {
    success: {
      bg: 'bg-green-500',
      icon: '✓',
      progressBar: 'bg-green-700'
    },
    error: {
      bg: 'bg-red-500',
      icon: '✕',
      progressBar: 'bg-red-700'
    },
    warning: {
      bg: 'bg-yellow-500',
      icon: '⚠',
      progressBar: 'bg-yellow-700'
    },
    info: {
      bg: 'bg-blue-500',
      icon: 'ℹ',
      progressBar: 'bg-blue-700'
    }
  }

  const style = typeStyles[type] || typeStyles.success

  return (
    <div className="fixed top-4 right-4 z-50 animate-slideInRight">
      <div className={`${style.bg} text-white px-6 py-4 rounded-lg shadow-2xl max-w-md flex items-center gap-3 relative overflow-hidden`}>
        {/* Icon */}
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white bg-opacity-20 rounded-full font-bold">
          {style.icon}
        </div>

        {/* Message */}
        <p className="flex-1 font-medium">{message}</p>

        {/* Close button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 text-white hover:bg-white hover:bg-opacity-20 rounded p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress bar */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white bg-opacity-20">
            <div 
              className={`h-full ${style.progressBar}`}
              style={{
                animation: `shrink ${duration}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Alert Dialog (non-blocking, like alert but styled)
export function AlertDialog({ isOpen, onClose, title, message, type = 'info' }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeStyles = {
    success: {
      icon: '✓',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700'
    },
    error: {
      icon: '✕',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      icon: '⚠',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    info: {
      icon: 'ℹ',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const style = typeStyles[type] || typeStyles.info

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm no-mobile-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${style.iconBg} mb-4`}>
          <span className={`text-2xl ${style.iconColor} font-bold`}>{style.icon}</span>
        </div>

        {/* Title */}
        {title && (
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          className={`w-full px-4 py-2.5 ${style.button} text-white font-medium rounded-lg transition-colors duration-200 shadow-lg`}
        >
          OK
        </button>
      </div>
    </div>
  )
}
