import { useEffect, useMemo, useState } from 'react'
import RefreshButton from '../components/RefreshButton'

function DispatchRequests() {
  const [userData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [marksheets, setMarksheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [batching, setBatching] = useState(false)
  const [requestingIds, setRequestingIds] = useState([])
  const [dispatchingId, setDispatchingId] = useState(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (userData?.role === 'staff') {
      fetchVerifiedMarksheets()
    } else {
      setLoading(false)
    }
  }, [userData])

  const fetchVerifiedMarksheets = async () => {
    if (!userData) return
    setLoading(true)
    try {
      const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
      const response = await fetch(`/api/marksheets?staffId=${staffId}&status=verified_by_staff,dispatch_requested,rescheduled_by_hod,approved_by_hod,rejected_by_hod,dispatched`)
      const data = await response.json()
      if (data.success) {
        setMarksheets(data.marksheets)
      } else {
        setMarksheets([])
      }
    } catch (err) {
      console.error('Error fetching marksheets:', err)
      setMarksheets([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchVerifiedMarksheets()
    } finally {
      setRefreshing(false)
    }
  }

  const requestDispatch = async (marksheetId) => {
    try {
      const res = await fetch('/api/marksheets?action=request-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marksheetId, staffId: userData._id || userData.id })
      })
      return await res.json()
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  const handleRequest = async (marksheetId) => {
    setFeedback('')
    setError('')
    setRequestingIds((ids) => Array.from(new Set([...ids, marksheetId])))
    try {
      const result = await requestDispatch(marksheetId)
      if (result?.success) {
        setFeedback('Dispatch request submitted for HOD approval.')
        setMarksheets((prev) => prev.map((m) => {
          if (m._id === marksheetId) {
            return {
              ...m,
              status: 'dispatch_requested',
              dispatchRequest: {
                ...(m.dispatchRequest || {}),
                requestedAt: new Date().toISOString(),
                requestedBy: userData?._id || userData?.id,
                hodResponse: null,
                hodComments: null,
                scheduledDispatchDate: null
              }
            }
          }
          return m
        }))
      } else {
        setError(result?.error || 'Failed to request dispatch')
      }
    } catch (err) {
      console.error(err)
      setError('Unexpected error while requesting dispatch')
    } finally {
      setRequestingIds((ids) => ids.filter((id) => id !== marksheetId))
      fetchVerifiedMarksheets()
    }
  }

  const requestDispatchAll = async () => {
    const candidates = marksheets.filter((m) => m.status === 'verified_by_staff')
    if (candidates.length === 0) return
    setFeedback('')
    setError('')
    setBatching(true)
    try {
      const results = []
      for (const sheet of candidates) {
        const result = await requestDispatch(sheet._id)
        results.push(result)
      }
      const okCount = results.filter((r) => r?.success).length
      const failCount = results.length - okCount
      if (okCount > 0) {
        setFeedback(`Submitted ${okCount} dispatch request${okCount > 1 ? 's' : ''} for approval.`)
      }
      if (failCount > 0) {
        setError(`Failed to submit ${failCount} request${failCount > 1 ? 's' : ''}. Please try again.`)
      }
    } finally {
      setBatching(false)
      fetchVerifiedMarksheets()
    }
  }

  const sendDispatch = async (marksheet) => {
    if (!marksheet?._id) return
    setFeedback('')
    setError('')
    setDispatchingId(marksheet._id)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const marksheetPdfUrl = `${origin}/api/generate-pdf?marksheetId=${marksheet._id}`
      const res = await fetch('/api/whatsapp-dispatch?action=send-marksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marksheetId: marksheet._id, marksheetPdfUrl })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        const errorMsg = data.details || data.error || 'Failed to dispatch marksheet'
        
        // Show helpful message for Twilio errors
        if (errorMsg.includes('Authenticate') || errorMsg.includes('authentication')) {
          throw new Error('Twilio authentication failed. Please verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env file. See TWILIO_SETUP_GUIDE.md')
        } else if (data.setupGuide) {
          throw new Error(`${errorMsg}. ${data.setupGuide}`)
        } else {
          throw new Error(errorMsg)
        }
      }
      setFeedback('Marksheet dispatched to parent via WhatsApp.')
      setMarksheets((prev) => prev.map((m) => m._id === marksheet._id ? { ...m, status: 'dispatched' } : m))
      await fetchVerifiedMarksheets()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to dispatch marksheet.')
    } finally {
      setDispatchingId(null)
    }
  }

  const sendAllApproved = async () => {
    const approvedMarksheets = marksheets.filter((m) => m.status === 'approved_by_hod')
    if (approvedMarksheets.length === 0) return
    
    setFeedback('')
    setError('')
    setSendingAll(true)
    
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const results = []
      
      for (const marksheet of approvedMarksheets) {
        try {
          const marksheetPdfUrl = `${origin}/api/generate-pdf?marksheetId=${marksheet._id}`
          const res = await fetch('/api/whatsapp-dispatch?action=send-marksheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marksheetId: marksheet._id, marksheetPdfUrl })
          })
          const data = await res.json()
          
          if (res.ok && data.success) {
            results.push({ success: true, id: marksheet._id })
            setMarksheets((prev) => prev.map((m) => 
              m._id === marksheet._id ? { ...m, status: 'dispatched' } : m
            ))
          } else {
            results.push({ success: false, id: marksheet._id, error: data.error })
          }
        } catch (err) {
          results.push({ success: false, id: marksheet._id, error: err.message })
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount
      
      if (successCount > 0) {
        setFeedback(`Successfully sent ${successCount} marksheet${successCount > 1 ? 's' : ''} via WhatsApp.`)
      }
      if (failCount > 0) {
        setError(`Failed to send ${failCount} marksheet${failCount > 1 ? 's' : ''}. Please try sending them individually.`)
      }
    } catch (err) {
      console.error(err)
      setError('Unexpected error while sending marksheets via WhatsApp.')
    } finally {
      setSendingAll(false)
      await fetchVerifiedMarksheets()
    }
  }

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All', count: marksheets.length },
    { id: 'verified_by_staff', label: 'Ready', count: marksheets.filter(m => m.status === 'verified_by_staff').length },
    { id: 'dispatch_requested', label: 'Pending', count: marksheets.filter(m => m.status === 'dispatch_requested').length },
    { id: 'rescheduled_by_hod', label: 'Rescheduled', count: marksheets.filter(m => m.status === 'rescheduled_by_hod').length },
    { id: 'approved_by_hod', label: 'Approved', count: marksheets.filter(m => m.status === 'approved_by_hod').length },
    { id: 'rejected_by_hod', label: 'Rejected', count: marksheets.filter(m => m.status === 'rejected_by_hod').length },
    { id: 'dispatched', label: 'Dispatched', count: marksheets.filter(m => m.status === 'dispatched').length }
  ]), [marksheets])

  const filteredMarksheets = useMemo(() => {
    const filtered = statusFilter === 'all' ? marksheets : marksheets.filter((m) => m.status === statusFilter)
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [marksheets, statusFilter])

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

  if (!userData || userData.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members can manage dispatch requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Dispatch Requests</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Submit and track WhatsApp dispatch requests for verified marksheets.<br/>
              Request approval, send reports, and manage dispatch status for your students.
            </p>
          </div>
          <div className="glass-card p-8 rounded-3xl mb-8">

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading verified marksheets...</p>
              </div>
            ) : marksheets.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No marksheets available</h3>
                <p className="text-gray-600">Import and verify marksheets to begin requesting dispatch approvals.</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 p-4 rounded-xl mb-6 text-blue-800">
                  <strong>Tip:</strong> Request dispatch after verifying marksheets. Once the HOD approves, you can send the report directly to parents via WhatsApp.
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id)}
                      className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-colors duration-200 whitespace-nowrap ${
                        statusFilter === filter.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-yellow-400'
                      }`}
                    >
                      {filter.label}
                      <span className={`ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusFilter === filter.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>

                {(feedback || error) && (
                  <div className="mb-6 space-y-2">
                    {feedback && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        {feedback}
                      </div>
                    )}
                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <button
                      onClick={requestDispatchAll}
                      disabled={batching || marksheets.every((m) => m.status !== 'verified_by_staff')}
                      className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${
                        batching || marksheets.every((m) => m.status !== 'verified_by_staff')
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors'
                      }`}
                    >
                      {batching ? 'Requesting...' : '📋 Request All'}
                    </button>
                    
                    <button
                      onClick={sendAllApproved}
                      disabled={sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')}
                      className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${
                        sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700 transition-colors'
                      }`}
                    >
                      {sendingAll ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          📤 Send All
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="self-end sm:self-auto">
                    <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredMarksheets.map((marksheet) => (
                    <div key={marksheet._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-yellow-300">
                      {/* Header Section */}
                      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 break-words">{marksheet.studentDetails?.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{marksheet.studentDetails?.regNumber} • {formatYear(marksheet.studentDetails)}</p>
                          </div>
                          <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-0.5 sm:gap-1 flex-shrink-0 whitespace-nowrap ${statusStyles[marksheet.status] || 'bg-gray-100 text-gray-700'}`}>
                            <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                            <span className="text-xs">{(marksheet.status || '').replace(/_/g, ' ')}</span>
                          </span>
                        </div>
                        
                        {/* Desktop: Info Grid with Button on Right | Mobile: Full Width */}
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                          {/* Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm flex-1">
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Parent:</p>
                              <p className="font-medium text-gray-900 truncate">{marksheet.studentDetails?.parentPhoneNumber || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Requested:</p>
                              <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.requestedAt ? new Date(marksheet.dispatchRequest.requestedAt).toLocaleDateString() : '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">HOD Decision:</p>
                              <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.hodResponse ? marksheet.dispatchRequest.hodResponse.toUpperCase() : '—'}</p>
                            </div>
                          </div>

                          {/* Action Button - Right side on desktop, full width on mobile */}
                          <div className="w-full md:w-auto md:flex-shrink-0">
                            {marksheet.status === 'verified_by_staff' && (
                              <button
                                onClick={() => handleRequest(marksheet._id)}
                                disabled={requestingIds.includes(marksheet._id)}
                                className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${requestingIds.includes(marksheet._id) ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
                              >
                                {requestingIds.includes(marksheet._id) ? 'Requesting…' : 'Request Dispatch'}
                              </button>
                            )}

                            {marksheet.status === 'rescheduled_by_hod' && (
                              <button
                                onClick={() => handleRequest(marksheet._id)}
                                disabled={requestingIds.includes(marksheet._id)}
                                className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${requestingIds.includes(marksheet._id) ? 'bg-orange-300 cursor-wait' : 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500'}`}
                              >
                                {requestingIds.includes(marksheet._id) ? 'Submitting…' : 'Request Again'}
                              </button>
                            )}

                            {marksheet.status === 'approved_by_hod' && (
                              <button
                                onClick={() => sendDispatch(marksheet)}
                                disabled={dispatchingId === marksheet._id}
                                className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${dispatchingId === marksheet._id ? 'bg-green-300 cursor-wait' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
                              >
                                {dispatchingId === marksheet._id ? 'Sending…' : 'Send via WhatsApp'}
                              </button>
                            )}

                            {marksheet.status === 'rejected_by_hod' && (
                              <a
                                href={`/marksheets/${marksheet._id}`}
                                className="block w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 text-center text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              >
                                Review Marksheet
                              </a>
                            )}

                            {marksheet.status === 'dispatched' && (
                              <a
                                href={`/api/generate-pdf?marksheetId=${marksheet._id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-yellow-600 border border-yellow-300 bg-white hover:bg-yellow-50 hover:border-yellow-400 text-center text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1"
                              >
                                Download PDF
                              </a>
                            )}
                          </div>
                        </div>
                        
                        {marksheet.dispatchRequest?.hodComments && (
                          <div className="mt-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1 font-medium">HOD Comments:</p>
                            <p className="text-gray-700 text-xs sm:text-sm">{marksheet.dispatchRequest.hodComments}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div>
      <span className="block text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

function formatYear(details = {}) {
  const year = (details.year || '').toString()
  const section = (details.section || '').toString()
  if (!year && !section) return '—'
  if (!section) return year
  if (!year) return section
  if (year.includes('-')) return year
  return `${year}-${section}`
}

export default DispatchRequests
