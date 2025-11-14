import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      setIsLoading(false)
      return
    }

    try {
      // Send authentication request to the backend API
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        // Set authentication state in localStorage
        localStorage.setItem('auth', JSON.stringify({
          isAuthenticated: true,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          department: data.user.department,
          id: data.user.id,
          year: data.user.year,
          section: data.user.section,
          loginTime: new Date().toISOString()
        }))

        // Also save individual items for backward compatibility
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userEmail', data.user.email)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userId', data.user.id)

        // Show success alert with glassmorphism
        showSuccess('Welcome Back!', `Logged in as ${data.user.name}`)

        // Redirect to home page after successful login
        setTimeout(() => {
          navigate('/')
          // Trigger a custom event to update header authentication state
          window.dispatchEvent(new Event('authStateChanged'))
        }, 1000)
      } else {
        setError(data.error || 'Invalid email or password')
        showError('Login Failed', data.error || 'Invalid email or password')
      }
    } catch (error) {
      console.error('Login error:', error)
      const errorMsg = 'An error occurred during login. Please try again.'
      setError(errorMsg)
      showError('Error', errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>
        {`
          @keyframes waveButtonAnimation {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          
          .login-wave-button {
            background: linear-gradient(90deg, var(--theme-gold-600), var(--theme-gold-300), var(--theme-gold-600), var(--theme-gold-300));
            background-size: 300% 100%;
            animation: waveButtonAnimation 3s ease-in-out infinite;
            transition: all 0.3s ease;
          }
          
          .login-wave-button:hover {
            animation-duration: 1.5s;
          }
        `}
      </style>
      
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-8 smooth-scroll mobile-smoothest-scroll no-mobile-anim" style={{fontFamily: 'Inter, sans-serif'}}>
        <div className="w-full max-w-md">
          <div className="glass-card no-mobile-backdrop p-8 rounded-3xl shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">Welcome Back</h1>
              <p className="text-gray-600 text-lg">Sign in to your MSEC Academics account</p>
            </div>
              
            {/* Error Message */}
            {error && (
              <div className="mb-6">
                <div className="glass-card no-mobile-backdrop p-4 border-l-4 border-red-500 bg-red-50">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="text-center">
                <p className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">
                  Forgot password?
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="glass-button w-full py-4 px-6 text-blue-600 text-lg font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </span>
                </button>
              </div>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm">
                Don't have an account? 
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline ml-1" onClick={() => navigate('/signup')}>
                  Sign up
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login