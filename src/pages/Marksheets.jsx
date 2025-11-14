 import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import { TableSkeleton } from '../components/SkeletonLoaders'
import { NoMarksheets, NoSearchResults } from '../components/EmptyStates'
import { useUndoToast } from '../components/UndoToast'
import { useConfetti } from '../components/Confetti'
import { HelpTooltip } from '../components/ContextualHelp'

function Marksheets() {
  const navigate = useNavigate()
  const { showSuccess, showError, showInfo } = useAlert()
  const { showUndo, ToastContainer } = useUndoToast()
  const { celebrate, ConfettiContainer } = useConfetti()
  const [userData, setUserData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [marksheets, setMarksheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [errors, setErrors] = useState([])
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [examinationDetails, setExaminationDetails] = useState({
    examinationName: '',
    semester: '',
    year: '',
    academicYear: '',
    examinationMonth: '',
    examinationYear: new Date().getFullYear().toString()
  })
  const [showImportSection, setShowImportSection] = useState(false)
  const [selectedExamination, setSelectedExamination] = useState(null)
  const [groupedMarksheets, setGroupedMarksheets] = useState({})
  const [createdExamination, setCreatedExamination] = useState(null)
  const [examinations, setExaminations] = useState([])

  const statusStyles = {
    verified_by_staff: 'bg-blue-100 text-blue-800',
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    rescheduled_by_hod: 'bg-orange-100 text-orange-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    verified_by_staff: '📋',
    dispatch_requested: '⏳',
    rescheduled_by_hod: '🔄',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  useEffect(() => {
    if (userData && userData.role === 'staff') {
      fetchMarksheets()
      fetchExaminations()
    }
  }, [userData])

  // Group marksheets by examination name and sort by register number
  useEffect(() => {
    const grouped = marksheets.reduce((acc, marksheet) => {
      const examName = marksheet.examinationName || 'Unknown Examination'
      if (!acc[examName]) {
        acc[examName] = []
      }
      acc[examName].push(marksheet)
      return acc
    }, {})
    
    // Sort each group by register number in ascending order
    Object.keys(grouped).forEach(examName => {
      grouped[examName].sort((a, b) => {
        const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
        const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
        return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
      })
    })
    
    setGroupedMarksheets(grouped)
  }, [marksheets])

  // Helper function to check if all marksheets in an exam are verified
  const areAllMarksheetsVerified = (examName) => {
    const examMarksheets = examName ? groupedMarksheets[examName] : marksheets
    if (!examMarksheets || examMarksheets.length === 0) return false
    return examMarksheets.every(m => 
      m.status === 'verified_by_staff' || 
      m.status === 'dispatch_requested' || 
      m.status === 'approved_by_hod' || 
      m.status === 'dispatched'
    )
  }

  const fetchMarksheets = async () => {
    try {
      const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
      const response = await fetch(`/api/marksheets?staffId=${staffId}`)
      const data = await response.json()
      if (data.success) {
        setMarksheets(data.marksheets)
      }
    } catch (error) {
      console.error('Error fetching marksheets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExaminations = async () => {
    try {
      const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
      const response = await fetch(`/api/examinations?staffId=${staffId}`)
      const data = await response.json()
      if (data.success) {
        setExaminations(data.examinations)
      }
    } catch (error) {
      console.error('Error fetching examinations:', error)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleCreateExamination = async () => {
    if (!examinationDetails.examinationName || !examinationDetails.semester || !examinationDetails.year || !examinationDetails.academicYear || !examinationDetails.examinationMonth || !examinationDetails.examinationYear) {
      setErrors(['Please fill in all examination details'])
      return
    }

    setUploading(true)
    setErrors([])

    try {
      const staffId = userData._id || userData.id || localStorage.getItem('userId')
      
      const response = await fetch('/api/examinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examinationName: examinationDetails.examinationName,
          year: examinationDetails.year,
          semester: examinationDetails.semester,
          academicYear: examinationDetails.academicYear,
          examinationMonth: examinationDetails.examinationMonth,
          examinationYear: examinationDetails.examinationYear,
          staffId: staffId
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErrors([data.error || 'Failed to create examination'])
        return
      }

      // Store the created examination details
      setCreatedExamination(data.examination)
      
      // Show success message and proceed to import section
      setShowImportSection(true)
      setShowCreateForm(false)
      
      // Refresh examinations list
      await fetchExaminations()

    } catch (error) {
      console.error('Error creating examination:', error)
      setErrors([error.message || 'Failed to create examination'])
    } finally {
      setUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setErrors([])
    setSessionId('')
    try {
      const form = new FormData()
      form.append('excelFile', file)
      form.append('staffId', userData._id || userData.id || localStorage.getItem('userId'))
      
      // Create examination date from the form details
      const examinationDate = new Date(`${examinationDetails.examinationYear}-${String(examinationDetails.examinationMonth).padStart(2, '0')}-01`)
      form.append('examinationDate', examinationDate.toISOString())
      form.append('examinationName', examinationDetails.examinationName)
      form.append('semester', examinationDetails.semester)
      form.append('department', userData.department)
      form.append('year', userData.year)

      const res = await fetch('/api/import-excel?action=upload', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrors([data.error || 'Upload failed'])
      } else {
        setSessionId(data.sessionId)
        setErrors(data.errorMessages || [])
      }
    } catch (e) {
      setErrors([e.message || 'Unexpected error'])
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!sessionId) return
    setUploading(true)
    try {
      const res = await fetch('/api/import-excel?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrors([data.error || 'Confirm failed'])
      } else {
        // Refresh list after import
        await fetchMarksheets()
        setSessionId('')
        setFile(null)
      }
    } catch (e) {
      setErrors([e.message || 'Unexpected error'])
    } finally {
      setUploading(false)
    }
  }

  const verifyAll = async () => {
    if (!marksheets || marksheets.length === 0) return
    setVerifyingAll(true)
    try {
      const candidates = marksheets.filter(m => m.status !== 'verified_by_staff')
      if (candidates.length === 0) {
        showInfo('Already Verified', 'All marksheets are already verified')
        setVerifyingAll(false)
        return
      }
      
      // Check if user has uploaded signature
      if (!userData?.eSignature) {
        showError('Signature Required', 'Please upload your signature in Settings before verifying marksheets')
        setVerifyingAll(false)
        return
      }
      
      const staffSignature = userData.eSignature
      await Promise.all(candidates.map(async (m) => {
        try {
          const res = await fetch('/api/marksheets?action=verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marksheetId: m._id, staffSignature })
          })
          await res.json().catch(() => ({}))
        } catch {}
      }))
      await fetchMarksheets()
      showSuccess('✓ All Verified', `Successfully verified ${candidates.length} marksheet${candidates.length > 1 ? 's' : ''}`)
      celebrate() // Trigger confetti!
    } catch (error) {
      showError('Verification Failed', 'Could not verify all marksheets')
    } finally {
      setVerifyingAll(false)
    }
  }

  // New: verify all and immediately request dispatch for each verified marksheet
  const verifyAllAndRequestDispatch = async () => {
    if (!marksheets || marksheets.length === 0) return
    setVerifyingAll(true)
    try {
      const candidates = marksheets.filter(m => m.status !== 'verified_by_staff')
      if (candidates.length === 0) {
        showInfo('Already Complete', 'All marksheets are already verified')
        setVerifyingAll(false)
        return
      }
      
      // Check if user has uploaded signature
      if (!userData?.eSignature) {
        showError('Signature Required', 'Please upload your signature in Settings before verifying marksheets')
        setVerifyingAll(false)
        return
      }
      
      const staffSignature = userData.eSignature

      await Promise.all(candidates.map(async (m) => {
        try {
          // Verify
          const vRes = await fetch('/api/marksheets?action=verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marksheetId: m._id, staffSignature })
          })
          const vData = await vRes.json().catch(() => ({}))

          // If verification succeeded, request dispatch for that marksheet so it appears in the dispatch list
          if (vRes.ok && vData && vData.success) {
            try {
              await fetch('/api/marksheets?action=request-dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marksheetId: m._id, staffId: userData?.id })
              })
            } catch (e) {
              // ignore per-item failures
            }
          }
        } catch (e) {
          // ignore per-item failures
        }
      }))

      await fetchMarksheets()
      showSuccess('✓ Verified & Requested', `${candidates.length} marksheet${candidates.length > 1 ? 's' : ''} verified and dispatch requested`)
      celebrate() // Trigger confetti!
    } catch (error) {
      showError('Action Failed', 'Could not complete verification and dispatch request')
    } finally {
      setVerifyingAll(false)
    }
  }

  if (!userData || userData.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members can view marksheets.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="w-48 h-8 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
            <div className="w-64 h-4 bg-gray-100 rounded animate-pulse"></div>
          </div>
          <TableSkeleton rows={8} columns={6} />
        </div>
      </div>
    )
  }

  // Calculate stats for visualization
  const totalMarksheets = marksheets.length
  const verifiedCount = marksheets.filter(m => 
    m.status === 'verified_by_staff' || 
    m.status === 'dispatch_requested' || 
    m.status === 'rescheduled_by_hod' ||
    m.status === 'approved_by_hod' || 
    m.status === 'dispatched'
  ).length
  const dispatchRequestedCount = marksheets.filter(m => m.status === 'dispatch_requested').length
  const dispatchedCount = marksheets.filter(m => m.status === 'dispatched').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 no-mobile-anim">
      <div className="responsive-container py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-6 md:mb-8">
            <div className="glass-card no-mobile-backdrop responsive-spacing rounded-3xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#111418] mb-2">
                    Marksheets
                  </h1>
                  <p className="text-base sm:text-lg text-gray-600">
                    Manage marksheets for {userData.department} Department - Class {userData.year}-{userData.section}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500 whitespace-nowrap">Total Marksheets</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-theme-gold-600">{totalMarksheets}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500">Verified</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{verifiedCount}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500 whitespace-nowrap">Dispatch Requested</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">{dispatchRequestedCount}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500">Dispatched</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{dispatchedCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-card p-8 rounded-3xl mb-8">

            {/* Create Marksheet Button - Only show on main examinations page */}
            {!showCreateForm && !showImportSection && !selectedExamination && (
              <div className="text-center mb-8">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-4 sm:px-8 py-2 sm:py-4 bg-blue-600 text-white rounded-xl font-semibold text-sm sm:text-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Marksheet
                </button>
              </div>
            )}

            {/* Create Examination Form */}
            {showCreateForm && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Create New Examination</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Examination Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Mid Term, Final Exam, Unit Test 1"
                      value={examinationDetails.examinationName}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, examinationName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <select
                      value={examinationDetails.year}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, year: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Year</option>
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                    <select
                      value={examinationDetails.semester}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, semester: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Semester</option>
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                      <option value="V">V</option>
                      <option value="VI">VI</option>
                      <option value="VII">VII</option>
                      <option value="VIII">VIII</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                    <input
                      type="text"
                      placeholder="e.g., 2024-25"
                      value={examinationDetails.academicYear}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, academicYear: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Examination Month</label>
                    <select
                      value={examinationDetails.examinationMonth}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, examinationMonth: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Month</option>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Examination Year</label>
                    <input
                      type="number"
                      value={examinationDetails.examinationYear}
                      onChange={(e) => setExaminationDetails(prev => ({ ...prev, examinationYear: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2020"
                      max="2030"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-6">
                  <button
                    onClick={handleCreateExamination}
                    disabled={uploading}
                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm sm:text-base ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {uploading ? 'Creating...' : 'Create & Continue to Import'}
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Import Section - Only show after creating examination */}
            {showImportSection && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="font-semibold text-green-900">Examination Created Successfully</h3>
                  </div>
                  
                  {createdExamination && (
                    <div className="bg-white rounded-lg p-4 border border-green-100 mb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div><strong>Name:</strong> {createdExamination.examinationName}</div>
                        <div><strong>Year:</strong> {createdExamination.year}</div>
                        <div><strong>Semester:</strong> {createdExamination.semester}</div>
                        <div><strong>Academic Year:</strong> {createdExamination.academicYear}</div>
                        <div><strong>Month:</strong> {new Date(2000, createdExamination.examinationMonth - 1).toLocaleString('default', { month: 'long' })}</div>
                        <div><strong>Exam Year:</strong> {createdExamination.examinationYear}</div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-green-100 text-xs text-gray-600">
                        <div><strong>Examination ID:</strong> {createdExamination._id}</div>
                        <div><strong>Created:</strong> {new Date(createdExamination.createdAt).toLocaleString()}</div>
                        <div><strong>Status:</strong> <span className="capitalize font-medium text-green-600">{createdExamination.status}</span></div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-sm text-green-800">
                    You can now import student marks for this examination using the Excel template below.
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-yellow-900 mb-2">📋 Required Excel Format:</h4>
                  <p className="text-sm text-yellow-800 mb-2">Your Excel file should contain the following columns in this exact order:</p>
                  <div className="bg-white rounded-lg p-3 font-mono text-xs border">
                    Name | RegNumber | Year | Section | ParentPhone | Mathematics | Physics | Chemistry | Computer | English | ...
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    • First 5 columns are required student details<br/>
                    • Remaining columns are subject names with their marks<br/>
                    • Marks should be numeric values (0-100)
                  </p>
                </div>

            {/* Import & Template actions - stacked on mobile, inline on larger screens */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6">
              {/* Import Excel (label) */}
              <div className="w-full sm:w-auto flex items-center">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" id="excelFileMarksheets" />
                <label
                  htmlFor="excelFileMarksheets"
                  className="glass-button inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-green-600 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-colors duration-300 cursor-pointer w-full justify-center sm:justify-start"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <span className="hidden sm:inline">Import Excel</span>
                  <span className="sm:hidden">Import</span>
                </label>
              </div>

              {/* Download Template */}
              <a
                href="/api/demo-excel"
                className="glass-button inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-gray-600 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-colors duration-300 w-full sm:w-auto justify-center"
              >
                <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Download Template</span>
                <span className="sm:hidden">Template</span>
              </a>

              {/* Upload (show when a file is selected) */}
              {file && (
                <div className="w-full sm:w-auto">
                  <button
                    disabled={uploading}
                    onClick={handleUpload}
                    className={`w-full sm:w-auto inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-colors duration-300 shadow-md hover:shadow-lg justify-center ${uploading ? 'opacity-60' : ''}`}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}

              {/* Confirm Import (session present) */}
              {sessionId && (
                <button
                  onClick={handleConfirm}
                  disabled={uploading}
                  className={`w-full sm:w-auto inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-colors duration-300 shadow-md hover:shadow-lg justify-center ${uploading ? 'opacity-60' : ''}`}
                >
                  {uploading ? 'Processing...' : 'Confirm Import'}
                </button>
              )}

              {/* Verify All (responsive: full-width on mobile, pushed to right on desktop) */}
              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <button
                  onClick={verifyAll}
                  disabled={verifyingAll || areAllMarksheetsVerified(null)}
                  className={`flex-1 sm:flex-initial inline-flex justify-center items-center gap-2 px-4 sm:px-5 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-colors duration-200 ${
                    verifyingAll || areAllMarksheetsVerified(null)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                  }`}
                >
                  {areAllMarksheetsVerified(null) ? '✓ All Verified' : verifyingAll ? 'Verifying...' : 'Verify All'}
                </button>
                <HelpTooltip content="Verify all unverified marksheets at once. This will mark them as verified by staff." />
              </div>
            </div>
              </>
            )}

            {errors && errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 rounded-xl text-red-800">
                <div className="font-semibold mb-2">Issues found:</div>
                <ul className="list-disc pl-6 space-y-1">
                  {errors.map((e, idx) => (<li key={idx}>{e}</li>))}
                </ul>
              </div>
            )}

            {marksheets.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No marksheets found</h3>
                <p className="text-gray-600">Import student marks to generate marksheets</p>
              </div>
            ) : selectedExamination ? (
              // Show marksheets for selected examination
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => setSelectedExamination(null)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 font-medium transition-colors text-sm sm:text-base"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Examinations
                    </button>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedExamination}</h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                      {groupedMarksheets[selectedExamination]?.length || 0} marksheets
                    </span>
                  </div>
                  
                  {/* Verify All button for selected examination */}
                  <div className="flex gap-2 sm:gap-3 flex-wrap">
                    <button
                      onClick={verifyAll}
                      disabled={verifyingAll || areAllMarksheetsVerified(selectedExamination)}
                      className={`inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                        verifyingAll || areAllMarksheetsVerified(selectedExamination)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      {areAllMarksheetsVerified(selectedExamination) ? '✓ All Verified' : verifyingAll ? 'Verifying...' : 'Verify All'}
                    </button>
                    
                    <button
                      onClick={verifyAllAndRequestDispatch}
                      disabled={verifyingAll || areAllMarksheetsVerified(selectedExamination)}
                      className={`inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                        verifyingAll || areAllMarksheetsVerified(selectedExamination)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      {areAllMarksheetsVerified(selectedExamination) ? '✓ All Verified' : verifyingAll ? 'Processing...' : 'Verify & Request'}
                    </button>
                  </div>
                </div>
                {groupedMarksheets[selectedExamination]?.map((marksheet) => (
                  <div key={marksheet._id} className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
                    {/* Header with name and status icon */}
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words flex-1 pr-4">
                        {marksheet.studentDetails?.name || 'Unknown student'}
                      </h3>
                      <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-0.5 sm:gap-1 flex-shrink-0 whitespace-nowrap ${statusStyles[marksheet.status] || 'bg-gray-100 text-gray-700'}`}>
                        <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                        <span className="text-xs">{(marksheet.status || 'unknown').replace(/_/g, ' ')}</span>
                      </span>
                    </div>
                    
                    {/* Details with spacing */}
                    <div className="space-y-3 mb-4">
                      <p className="text-gray-600 text-xs sm:text-sm">
                        {marksheet.studentDetails?.regNumber || '—'} • Class {(() => {
                          const year = (marksheet.studentDetails?.year || '').toString()
                          const section = (marksheet.studentDetails?.section || '').toString()
                          if (year && section) return `${year}-${section}`
                          if (year) return year
                          if (section) return section
                          return '—'
                        })()}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Overall Grade: <span className="font-semibold text-gray-900">{marksheet.overallGrade}</span>
                      </p>
                    </div>

                    {/* View Details button */}
                    <div>
                      <button onClick={() => navigate(`/marksheets/${marksheet._id || marksheet.marksheetId}`)} className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show grouped examinations
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Examinations</h2>
                {Object.keys(groupedMarksheets).map((examName) => {
                  const examMarksheets = groupedMarksheets[examName]
                  const totalCount = examMarksheets.length
                  const statusCounts = examMarksheets.reduce((acc, m) => {
                    acc[m.status] = (acc[m.status] || 0) + 1
                    return acc
                  }, {})
                  
                  return (
                    <div
                      key={examName}
                      onClick={() => setSelectedExamination(examName)}
                      className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-yellow-300 hover:bg-yellow-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{examName}</h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">
                              Total: <span className="text-blue-600 font-semibold">{totalCount}</span> marksheets
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                              {Object.entries(statusCounts).map(([status, count]) => (
                                <span key={status} className="flex items-center gap-1 whitespace-nowrap">
                                  <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${statusStyles[status]?.includes('bg-') ? statusStyles[status].split(' ')[0] : 'bg-gray-300'}`}></span>
                                  <span className="capitalize text-xs sm:text-sm">{status.replace(/_/g, ' ')}: {count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="self-end sm:self-auto text-right">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Undo Toast Container */}
      <ToastContainer />
      
      {/* Confetti Container */}
      <ConfettiContainer />
    </div>
  )
}

export default Marksheets
