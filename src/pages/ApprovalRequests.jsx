import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RefreshButton from '../components/RefreshButton'
import { useAlert } from '../components/AlertContext'
import { CardSkeleton, ListSkeleton } from '../components/SkeletonLoaders'
import { NoPendingRequests } from '../components/EmptyStates'
import { useConfetti } from '../components/Confetti'
import { HelpTooltip } from '../components/ContextualHelp'

function ApprovalRequests() {
  const { showSuccess, showError, showWarning } = useAlert()
  const { celebrate, ConfettiContainer } = useConfetti()
  const [userData] = useState(() => {
    try {
      const auth = localStorage.getItem('auth')
      return auth ? JSON.parse(auth) : null
    } catch (err) {
      console.error('Failed to parse auth data:', err)
      return null
    }
  })
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [actionModal, setActionModal] = useState({ open: false, type: null, marksheet: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (userData?.role === 'hod') {
      fetchPendingRequests()
    } else {
      setLoading(false)
    }
  }, [userData])

  const fetchPendingRequests = async () => {
    if (!userData) return
    setLoading(true)
    try {
      const response = await fetch(`/api/marksheets?department=${userData.department}&status=dispatch_requested,rescheduled_by_hod`)
      const data = await response.json()
      if (data.success) {
        setPendingRequests(data.marksheets)
      } else {
        setPendingRequests([])
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      setPendingRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchPendingRequests()
    } finally {
      setRefreshing(false)
    }
  }

  const handleAction = (marksheet, type) => {
    setActionError('')
    setActionModal({ open: true, type, marksheet })
  }

  const closeModal = () => {
    setActionModal({ open: false, type: null, marksheet: null })
    setActionError('')
  }

  const submitAction = async ({ comments, scheduledDispatchDate }) => {
    if (!actionModal.marksheet || !actionModal.type) return
    try {
      setActionLoading(true)
      const hodId = userData._id || userData.id
      const res = await fetch('/api/marksheets?action=hod-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marksheetId: actionModal.marksheet._id,
          hodId,
          response: actionModal.type,
          comments,
          scheduledDispatchDate
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit response')
      }
      const actionVerb = actionModal.type === 'approved' ? 'approved' : actionModal.type === 'rejected' ? 'rejected' : 'rescheduled'
      const studentName = actionModal.marksheet?.studentDetails?.name || 'Student'
      setFeedback(`Dispatch request ${actionVerb} successfully.`)
      
      // Show glassmorphism alert
      if (actionModal.type === 'approved') {
        showSuccess('✓ Approved', `Dispatch approved for ${studentName}`)
      } else if (actionModal.type === 'rejected') {
        showWarning('Request Rejected', `Dispatch rejected for ${studentName}`)
      } else {
        showSuccess('Rescheduled', `Dispatch rescheduled for ${studentName}`)
      }
      
      closeModal()
      await fetchPendingRequests()
    } catch (err) {
      setActionError(err.message || 'Unexpected error')
      showError('Action Failed', err.message || 'Could not process the request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkAction = async (actionType) => {
    const targetRequests = filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod')
    if (targetRequests.length === 0) {
      setFeedback(`No pending requests available for bulk ${actionType}.`)
      return
    }

    try {
      setBulkActionLoading(true)
      setActionError('')
      const hodId = userData._id || userData.id
      
      const promises = targetRequests.map(marksheet => 
        fetch('/api/marksheets?action=hod-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marksheetId: marksheet._id,
            hodId,
            response: actionType,
            comments: '',
            scheduledDispatchDate: null
          })
        }).then(res => res.json())
      )

      const results = await Promise.all(promises)
      const successCount = results.filter(result => result.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        const msg = `Successfully ${actionType} ${successCount} request${successCount > 1 ? 's' : ''}.${failCount > 0 ? ` ${failCount} failed.` : ''}`
        setFeedback(msg)
        showSuccess(
          `Bulk ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`,
          `${successCount}/${results.length} requests processed successfully`
        )
        if (failCount === 0) {
          celebrate() // Trigger confetti for 100% success!
        }
      } else {
        const errorMsg = `Failed to ${actionType.slice(0, -1)} any requests. Please try again.`
        setActionError(errorMsg)
        showError('Bulk Action Failed', errorMsg)
      }

      await fetchPendingRequests()
    } catch (err) {
      setActionError(err.message || `Failed to perform bulk ${actionType}`)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All', count: pendingRequests.length },
    { id: 'dispatch_requested', label: 'Pending', count: pendingRequests.filter(m => m.status === 'dispatch_requested').length },
    { id: 'rescheduled_by_hod', label: 'Rescheduled', count: pendingRequests.filter(m => m.status === 'rescheduled_by_hod').length }
  ]), [pendingRequests])

  const filteredRequests = useMemo(() => {
    const filtered = selectedStatus === 'all' ? pendingRequests : pendingRequests.filter(m => m.status === selectedStatus)
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [pendingRequests, selectedStatus])

  const statusStyles = {
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    rescheduled_by_hod: 'bg-orange-100 text-orange-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    dispatch_requested: '⏳',
    rescheduled_by_hod: '🔄',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  const formatClass = (details = {}) => {
    const year = (details.year || '').toString()
    const section = (details.section || '').toString()
    if (!year && !section) return 'N/A'
    if (!section) return year
    if (!year) return section
    return `${year}-${section}`
  }

  if (!userData || userData.role !== 'hod') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only HODs can approve dispatch requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Approval Requests</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Review and approve dispatch requests for {userData.department} Department
            </p>
          </div>
          
          <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl mb-8">

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading pending requests...</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No pending requests</h3>
                <p className="text-gray-600">All dispatch requests have been processed</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedStatus(filter.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                        selectedStatus === filter.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      {filter.label}
                      <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${selectedStatus === filter.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>

                {feedback && (
                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    {feedback}
                  </div>
                )}

                {actionError && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {actionError}
                  </div>
                )}

                {/* Bulk Action Buttons */}
                <div className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">Bulk Actions</h3>
                          <HelpTooltip content="Quickly approve, reschedule, or reject all pending dispatch requests at once." />
                        </div>
                        <p className="text-xs text-gray-600">
                          {filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length} pending requests available
                        </p>
                      </div>
                    </div>
                    <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <button
                      onClick={() => handleBulkAction('approved')}
                      disabled={bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${
                        bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>✅</span>
                        <span>{bulkActionLoading ? 'Processing...' : 'Approve All'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleBulkAction('rescheduled')}
                      disabled={bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                        bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-orange-500 hover:bg-orange-600'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>🔄</span>
                        <span>{bulkActionLoading ? 'Processing...' : 'Reschedule All'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleBulkAction('rejected')}
                      disabled={bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 ${
                        bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested' || m.status === 'rescheduled_by_hod').length === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>⛔</span>
                        <span>{bulkActionLoading ? 'Processing...' : 'Reject All'}</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredRequests.map((marksheet) => (
                    <div key={marksheet._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* Header Section */}
                      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 truncate">{marksheet.studentDetails?.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{marksheet.studentDetails?.regNumber} • {formatClass(marksheet.studentDetails)}</p>
                          </div>
                          <span className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap ${statusStyles[marksheet.status] || 'bg-yellow-100 text-yellow-800'}`}>
                            <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                            <span className="text-xs">{(marksheet.status || '').replace(/_/g, ' ')}</span>
                          </span>
                        </div>
                        
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Staff:</p>
                            <p className="font-medium text-gray-900 truncate">{marksheet.staffName || 'demo staff'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Parent Phone:</p>
                            <p className="font-medium text-gray-900">{marksheet.studentDetails?.parentPhoneNumber || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Exam Date:</p>
                            <p className="font-medium text-gray-900">
                              {marksheet.examinationDate 
                                ? new Date(marksheet.examinationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                : '—'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Subjects:</p>
                            <p className="font-medium text-gray-900">{marksheet.subjects?.length || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100"></div>
                      
                      {/* Action Buttons Section */}
                      <div className="p-4 sm:p-6 pt-3 sm:pt-4 bg-gray-50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <button
                            onClick={() => handleAction(marksheet, 'approved')}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                          >
                            <span className="hidden sm:inline">Approve Dispatch</span>
                            <span className="sm:hidden">Approve</span>
                          </button>
                          <button
                            onClick={() => handleAction(marksheet, 'rejected')}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                          >
                            <span className="hidden sm:inline">Reject Request</span>
                            <span className="sm:hidden">Reject</span>
                          </button>
                          <button
                            onClick={() => handleAction(marksheet, 'rescheduled')}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => navigate(`/marksheets/${marksheet._id || marksheet.marksheetId}`)}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                          >
                            <span className="hidden sm:inline">View Details</span>
                            <span className="sm:hidden">Details</span>
                          </button>
                        </div>
                      </div>
                          {/* Divider before buttons */}
                          <div className="my-6 border-t border-dashed border-gray-300" />

                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ActionDialog
        open={actionModal.open}
        type={actionModal.type}
        marksheet={actionModal.marksheet}
        onClose={closeModal}
        onSubmit={submitAction}
        loading={actionLoading}
        error={actionError}
      />
      
      {/* Confetti celebration */}
      <ConfettiContainer />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="text-sm">
      <span className="text-gray-500 block mb-1">{label}:</span>
      <div className="font-semibold text-gray-900 break-words">{value}</div>
    </div>
  )
}

function ActionDialog({ open, type, marksheet, onClose, onSubmit, loading, error }) {
  const [comments, setComments] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')

  useEffect(() => {
    if (!open || !marksheet) return
    setComments('')
    if (marksheet.dispatchRequest?.scheduledDispatchDate) {
      const existing = new Date(marksheet.dispatchRequest.scheduledDispatchDate)
      if (!Number.isNaN(existing.getTime())) {
        setScheduledDate(existing.toISOString().slice(0, 16))
      } else {
        setScheduledDate('')
      }
    } else {
      setScheduledDate('')
    }
  }, [open, type, marksheet])

  if (!open || !marksheet) return null

  const isReschedule = type === 'rescheduled'
  const title = type === 'approved' ? 'Approve dispatch request' : type === 'rejected' ? 'Reject dispatch request' : 'Reschedule dispatch request'

  const submit = (e) => {
    e.preventDefault()
    const payload = {
      comments: comments.trim() || undefined,
      scheduledDispatchDate: undefined
    }
    if (scheduledDate) {
      const iso = new Date(scheduledDate)
      if (!Number.isNaN(iso.getTime())) {
        payload.scheduledDispatchDate = iso.toISOString()
      }
    }
    onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {marksheet.studentDetails?.name} • {marksheet.studentDetails?.regNumber}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder={type === 'rejected' ? 'Let the staff know the reason for rejection' : 'Add any notes for the staff member'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule (optional)</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required={isReschedule}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
            {isReschedule && (
              <p className="text-xs text-gray-500 mt-2">Provide the new date/time for dispatch. This will be visible to the staff member.</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={loading} className={`px-5 py-2 rounded-lg text-white ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ApprovalRequests
