import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
    year: '',
    section: '',
    phoneNumber: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.role || !formData.department) {
      setError('Please fill in all required fields')
      setIsLoading(false)
      return
    }
    if (formData.role === 'staff' && (!formData.year || !formData.section)) {
      setError('Please select year and section for staff role')
      setIsLoading(false)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      // Create user via API
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department,
        phoneNumber: formData.phoneNumber
      }
      
      // Add year and section for staff role
      if (formData.role === 'staff') {
        userData.year = formData.year
        userData.section = formData.section
      }
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        return
      }

      // On success, navigate to login
      setSuccess('Account created. Redirecting to sign in...')
      setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      console.error('Sign up error:', err)
      setError('An error occurred while creating account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes waveButtonAnimation {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .login-wave-button {
          background: linear-gradient(90deg, var(--theme-gold-600), var(--theme-gold-300), var(--theme-gold-600), var(--theme-gold-300));
          background-size: 300% 100%;
          animation: waveButtonAnimation 3s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        .login-wave-button:hover { animation-duration: 1.5s; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-8 smooth-scroll mobile-smoothest-scroll no-mobile-anim" style={{fontFamily: 'Inter, sans-serif'}}>
        <div className="w-full max-w-md">
          <div className="glass-card no-mobile-backdrop p-8 rounded-3xl shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">Create Account</h1>
              <p className="text-gray-600 text-lg">Sign up for your MSEC Academics account</p>
            </div>

            {error && (
              <div className="mb-6">
                <div className="glass-card no-mobile-backdrop p-4 border-l-4 border-red-500 bg-red-50">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6">
                <div className="glass-card no-mobile-backdrop p-4 border-l-4 border-green-500 bg-green-50">
                  <p className="text-green-700 text-sm font-medium">{success}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Full Name</label>
                <input name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500" placeholder="Dr. John Doe" required />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500" placeholder="john.doe@msec.edu.in" required />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900" required>
                  <option value="">Select Role</option>
                  <option value="staff">Staff</option>
                  <option value="hod">HOD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Department</label>
                <select name="department" value={formData.department} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900" required>
                  <option value="">Select Department</option>
                  <option value="CSE">Computer Science & Engineering</option>
                  <option value="AI_DS">Artificial Intelligence & Datascience</option>
                  <option value="ECE">Electronics & Communication Engineering</option>
                  <option value="MECH">Mechanical Engineering</option>
                  <option value="CIVIL">Civil Engineering</option>
                  <option value="EEE">Electrical & Electronics Engineering</option>
                </select>
              </div>

              {formData.role === 'staff' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">Year</label>
                    <select name="year" value={formData.year || ''} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900" required>
                      <option value="">Select Year</option>
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">Section</label>
                    <select name="section" value={formData.section || ''} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900" required>
                      <option value="">Select Section</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Phone Number</label>
                <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500" placeholder="+91-9876543210" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500" placeholder="Create a password" required />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="glass-input w-full px-4 py-4 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-500" placeholder="Repeat password" required />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="glass-button w-full py-4 px-6 text-blue-600 text-lg font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="truncate">{isLoading ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm">Already have an account? <span className="text-blue-600 font-semibold cursor-pointer hover:underline ml-1" onClick={() => navigate('/login')}>Sign in</span></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default SignUp
