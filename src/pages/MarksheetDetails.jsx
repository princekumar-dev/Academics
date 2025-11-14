import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function MarksheetDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [marksheet, setMarksheet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ studentDetails: {}, subjects: [] })
  const [userData] = useState(() => {
    try {
      const auth = localStorage.getItem('auth')
      return auth ? JSON.parse(auth) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const load = async () => {
      // Validate route param
      if (!id || id === 'undefined' || id === 'null') {
        setError('Invalid marksheet id')
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/marksheets?marksheetId=${encodeURIComponent(id)}`)
        const data = await res.json()
        if (!res.ok || !data.success || !data.marksheet) {
          setError(data.error || 'Failed to load marksheet')
        } else {
          setMarksheet(data.marksheet)
          if (data.marksheet) {
            setForm({
              studentDetails: { ...(data.marksheet.studentDetails || {}) },
              subjects: Array.isArray(data.marksheet.subjects) ? [...data.marksheet.subjects] : []
            })
          }
        }
      } catch (e) {
        setError(e.message || 'Unexpected error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const statusMeta = useMemo(() => {
    const status = marksheet?.status || 'unknown'
    const map = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      verified_by_staff: { label: 'Verified by Staff', className: 'bg-green-100 text-green-800' },
      dispatch_requested: { label: 'Dispatch Requested', className: 'bg-yellow-100 text-yellow-800' },
      rescheduled_by_hod: { label: 'Rescheduled by HOD', className: 'bg-orange-100 text-orange-800' },
      approved_by_hod: { label: 'Approved by HOD', className: 'bg-blue-100 text-blue-800' },
      rejected_by_hod: { label: 'Rejected by HOD', className: 'bg-red-100 text-red-800' },
      dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-800' },
      unknown: { label: 'Unknown', className: 'bg-gray-200 text-gray-700' }
    }
    return map[status] || map.unknown
  }, [marksheet])

  const staffMatchesMarksheet = useMemo(() => {
    if (!marksheet || !userData || userData.role !== 'staff') return false
    const staffIdFromMarksheet = marksheet.staffId?._id || marksheet.staffId
    const userId = userData._id || userData.id
    if (!staffIdFromMarksheet || !userId) return false
    try {
      return String(staffIdFromMarksheet) === String(userId)
    } catch {
      return false
    }
  }, [marksheet, userData])

  const canStaffEdit = userData?.role === 'staff' && staffMatchesMarksheet

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading marksheet...</p>
        </div>
      </div>
    )
  }

  if (error || !marksheet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Found</h1>
          <p className="text-gray-600">{error || 'Marksheet not found'}</p>
          <button onClick={() => navigate(-1)} className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-lg">Go Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Marksheet Details</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              View, verify, and manage individual student marksheet details.<br/>
              Check grades, dispatch status, and update student information as needed.
            </p>
          </div>
          <div className="glass-card p-8 rounded-3xl transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900">{marksheet.studentDetails?.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Student</h2>
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Name</label>
                      <input value={form.studentDetails.name || ''} onChange={e => setForm(prev => ({ ...prev, studentDetails: { ...prev.studentDetails, name: e.target.value } }))} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Reg No</label>
                      <input value={form.studentDetails.regNumber || ''} onChange={e => setForm(prev => ({ ...prev, studentDetails: { ...prev.studentDetails, regNumber: e.target.value } }))} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Year</label>
              <input value={form.studentDetails.year || ''} onChange={e => setForm(prev => ({ ...prev, studentDetails: { ...prev.studentDetails, year: e.target.value } }))} className="w-full border rounded-lg px-3 py-2" placeholder="e.g., II" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Semester</label>
                        <input value={form.semester || form.studentDetails.semester || ''} onChange={e => setForm(prev => ({ ...prev, semester: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="e.g., 1" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Department</label>
                      <input value={form.studentDetails.department || ''} onChange={e => setForm(prev => ({ ...prev, studentDetails: { ...prev.studentDetails, department: e.target.value } }))} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Parent Phone</label>
                      <input value={form.studentDetails.parentPhoneNumber || ''} onChange={e => setForm(prev => ({ ...prev, studentDetails: { ...prev.studentDetails, parentPhoneNumber: e.target.value } }))} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-700"><strong>Reg No:</strong> {marksheet.studentDetails?.regNumber}</p>
                    <p className="text-gray-700"><strong>Year/Sem:</strong> {marksheet.studentDetails?.year}/{marksheet.semester || marksheet.studentDetails?.semester || 'N/A'}</p>
                    <p className="text-gray-700"><strong>Department:</strong> {marksheet.studentDetails?.department}</p>
                    <p className="text-gray-700"><strong>Parent:</strong> {marksheet.studentDetails?.parentPhoneNumber}</p>
                  </>
                )}
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
                <p className="text-gray-700"><strong>Examination Name:</strong> {marksheet.examinationName || 'N/A'}</p>
                <p className="text-gray-700"><strong>Examination Date:</strong> {marksheet.examinationDate ? new Date(marksheet.examinationDate).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
                <p className="text-gray-700"><strong>Overall Grade:</strong> {marksheet.overallGrade}</p>
                <p className="text-gray-700"><strong>Staff:</strong> {marksheet.staffName}</p>
                {marksheet.hodName && (<p className="text-gray-700"><strong>HOD:</strong> {marksheet.hodName}</p>)}
                {marksheet.status === 'approved_by_hod' && marksheet.dispatchRequest?.respondedAt && (
                  <p className="text-gray-700"><strong>Approved On:</strong> {new Date(marksheet.dispatchRequest.respondedAt).toLocaleString()}</p>
                )}
              </div>
            </div>

            {(marksheet.dispatchRequest?.hodResponse || marksheet.dispatchRequest?.scheduledDispatchDate) && (
              <div className="mt-6 bg-white p-6 rounded-xl border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Dispatch Notes</h2>
                <dl className="space-y-2 text-gray-700">
                  {marksheet.dispatchRequest?.hodResponse && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium">HOD Decision</dt>
                      <dd className="capitalize">{marksheet.dispatchRequest.hodResponse}</dd>
                    </div>
                  )}
                  {marksheet.dispatchRequest?.hodComments && (
                    <div>
                      <dt className="font-medium">Comments</dt>
                      <dd className="text-gray-700 mt-1">{marksheet.dispatchRequest.hodComments}</dd>
                    </div>
                  )}
                  {marksheet.dispatchRequest?.scheduledDispatchDate && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium">Scheduled Dispatch</dt>
                      <dd>{new Date(marksheet.dispatchRequest.scheduledDispatchDate).toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Subjects</h2>
              {editMode ? (
                <div className="space-y-3">
                  {form.subjects.map((sub, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-3 items-center">
                      <input value={sub.subjectName} onChange={e => setForm(prev => { const arr = [...prev.subjects]; arr[idx] = { ...arr[idx], subjectName: e.target.value }; return { ...prev, subjects: arr } })} className="border rounded-lg px-3 py-2" />
                      <input type="number" value={sub.marks} onChange={e => setForm(prev => { const arr = [...prev.subjects]; arr[idx] = { ...arr[idx], marks: Number(e.target.value) }; return { ...prev, subjects: arr } })} className="border rounded-lg px-3 py-2" />
                      <input value={sub.grade} onChange={e => setForm(prev => { const arr = [...prev.subjects]; arr[idx] = { ...arr[idx], grade: e.target.value }; return { ...prev, subjects: arr } })} className="border rounded-lg px-3 py-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {(marksheet.subjects || []).map((sub, idx) => (
                    <div key={idx} className="py-3 space-y-1 sm:space-y-0 sm:grid sm:grid-cols-2 sm:items-center">
                      <span className="text-gray-800 break-words min-w-0">{sub.subjectName}</span>
                      <div className="flex items-center justify-between sm:justify-end gap-2 text-gray-700">
                        <span className="font-semibold">{sub.marks}</span>
                        <span className="whitespace-nowrap">Grade: {sub.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate(-1)} className="px-5 py-2 bg-gray-100 text-gray-800 rounded-lg transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full sm:w-auto">Back</button>
              {!editMode && canStaffEdit && (
                <>
                  <VerifyButton marksheet={marksheet} onVerified={setMarksheet} />
                  <button onClick={() => setEditMode(true)} className="px-5 py-2 bg-blue-600 text-white rounded-lg transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full sm:w-auto">Edit & Regenerate</button>
                </>
              )}
              {editMode && canStaffEdit && (
                <>
                  <button onClick={() => setEditMode(false)} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full sm:w-auto">Cancel</button>
                  <SaveEditsButton id={marksheet._id} form={form} onSaved={(m) => { setMarksheet(m); setEditMode(false) }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VerifyButton({ marksheet, onVerified }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [userData] = useState(() => {
    try {
      const auth = localStorage.getItem('auth')
      return auth ? JSON.parse(auth) : null
    } catch {
      return null
    }
  })
  
  // Initialize verified state from marksheet status
  useEffect(() => {
    if (marksheet?.status === 'verified_by_staff' || marksheet?.status === 'approved_by_hod' || marksheet?.status === 'dispatched') setVerified(true)
    else setVerified(false)
  }, [marksheet])
  const lockedStatuses = ['approved_by_hod', 'rejected_by_hod', 'dispatched', 'rescheduled_by_hod']
  const handleVerify = async () => {
    // Check if user has uploaded signature
    if (!userData?.eSignature) {
      setError('Please upload your signature in Settings before verifying marksheets')
      return
    }
    
    setLoading(true)
    setError('')
    try {
      const staffSignature = userData.eSignature
      const res = await fetch('/api/marksheets?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marksheetId: marksheet._id, staffSignature })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Verification failed')
      } else {
        setVerified(true)
        onVerified(data.marksheet)
      }
    } catch (e) {
      setError(e.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <button
        disabled={loading || verified || lockedStatuses.includes(marksheet?.status)}
        onClick={handleVerify}
        className={`px-5 py-2 rounded-lg transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full sm:w-auto ${
          verified || lockedStatuses.includes(marksheet?.status)
            ? 'bg-green-200 text-green-900 cursor-not-allowed'
            : loading
              ? 'bg-green-200 text-green-900'
              : 'bg-green-600 text-white'
        }`}
      >
        {verified ? 'Verified' : loading ? 'Verifying...' : 'Verify'}
      </button>
      {error && (<span className="text-red-600 text-sm ml-2">{error}</span>)}
    </>
  )
}

function SaveEditsButton({ id, form, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marksheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marksheetId: id, studentDetails: form.studentDetails, subjects: form.subjects })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Save failed')
      } else {
        onSaved(data.marksheet)
      }
    } catch (e) {
      setError(e.message || 'Unexpected error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <button disabled={saving} onClick={handleSave} className={`px-5 py-2 rounded-lg transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full sm:w-auto ${saving ? 'bg-blue-200 text-blue-900' : 'bg-blue-600 text-white'}`}>{saving ? 'Saving...' : 'Save Changes'}</button>
      {error && (<span className="text-red-600 text-sm ml-2">{error}</span>)}
    </>
  )
}

export default MarksheetDetails


