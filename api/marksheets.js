import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, Student, User } from '../models.js'
import multer from 'multer'
import webpush from 'web-push'
import { getUserSubscriptions, storeNotification } from '../lib/notificationService.js'

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in marksheets API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  // Configure web-push (align with notifications API)
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'
  try {
    webpush.setVapidDetails(
      'mailto:support@msecconnect.edu',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
  } catch {}

  async function sendUserNotification(userEmail, title, body, url = '/') {
    try {
      const { subscriptions } = await getUserSubscriptions(userEmail)
      const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
      if (!activeSubs || activeSubs.length === 0) {
        // Still store the notification for inbox
        await storeNotification({ userEmail, title, body, url })
        return
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/images/android-chrome-192x192.png',
        badge: '/images/favicon-32x32.png',
        tag: 'msec-academics',
        data: { url }
      })

      await Promise.all(activeSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, payload)
        } catch {}
      }))

      await storeNotification({ userEmail, title, body, url })
    } catch (e) {
      // Best-effort only
      try { await storeNotification({ userEmail, title, body, url }) } catch {}
    }
  }

  try {
    if (req.method === 'GET') {
  const { staffId, hodId, department, status, year: yearParam, includeAll } = req.query
      const rawId = req.query.marksheetId || req.query.id
      
      // Return single marksheet by id if requested
      if (rawId) {
        let one = null
        try {
          // Try Mongo _id lookup first
          one = await Marksheet.findById(rawId)
            .populate('staffId', 'name email department class')
            .populate('hodId', 'name email')
            .lean()
        } catch {}

        // If not found, try by business marksheetId (e.g., MS123...)
        if (!one) {
          one = await Marksheet.findOne({ marksheetId: rawId })
            .populate('staffId', 'name email department class')
            .populate('hodId', 'name email')
            .lean()
        }

        if (!one) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        return res.status(200).json({ success: true, marksheet: one })
      }

      let filter = {}
      let hodDept = null
      
      // Filter by staff ID
      if (staffId) {
        try {
          filter.staffId = new mongoose.Types.ObjectId(staffId)
        } catch {
          // Invalid ObjectId, skip filter
        }
      }
      
      // Filter by HOD's department (pre-fetch if needed)
      if (hodId) {
        const hod = await User.findById(hodId).select('department').lean()
        if (hod) {
          hodDept = hod.department
          filter['studentDetails.department'] = hodDept
        }
      }
      
      // Filter by department
      if (department) {
        filter['studentDetails.department'] = department
      }
      
      // Filter by status (support comma-separated multiple statuses)
      // If includeAll is true, don't filter by status to get all marksheets
      if (status && !includeAll) {
        const statuses = status.split(',').map(s => s.trim())
        if (statuses.length === 1) {
          filter.status = status
        } else {
          filter.status = { $in: statuses }
        }
      }
      
      // Filter by year
      if (yearParam) {
        filter['studentDetails.year'] = yearParam
      }

      // Optimized query with field selection and limit
      const marksheets = await Marksheet.find(filter)
        .select('-__v') // Exclude version key
        .populate('staffId', 'name email department')
        .populate('hodId', 'name email')
        .sort({ createdAt: -1 })
        .limit(500) // Reasonable limit to prevent large payloads
        .lean()

      return res.status(200).json({ success: true, marksheets })
    }

    if (req.method === 'POST') {
      const { action } = req.query
      
      if (action === 'create') {
        const { 
          studentDetails, 
          examinationDate, 
          subjects, 
          staffId 
        } = req.body

        if (!studentDetails || !examinationDate || !subjects || !staffId) {
          return res.status(400).json({ 
            success: false, 
            error: 'studentDetails, examinationDate, subjects, and staffId are required' 
          })
        }

        // Get staff information
        const staff = await User.findById(staffId)
        if (!staff) {
          return res.status(404).json({ success: false, error: 'Staff not found' })
        }

        // Calculate overall grade based on subjects
        const totalMarks = subjects.reduce((sum, sub) => sum + sub.marks, 0)
        const averageMarks = totalMarks / subjects.length
        
        let overallGrade = 'F'
        if (averageMarks >= 90) overallGrade = 'A+'
        else if (averageMarks >= 80) overallGrade = 'A'
        else if (averageMarks >= 70) overallGrade = 'B+'
        else if (averageMarks >= 60) overallGrade = 'B'
        else if (averageMarks >= 50) overallGrade = 'C'
        else if (averageMarks >= 40) overallGrade = 'D'

        const marksheet = new Marksheet({
          studentDetails,
          examinationDate: new Date(examinationDate),
          subjects,
          overallGrade,
          staffId,
          staffName: staff.name,
          staffSignature: staff.eSignature
        })

        await marksheet.save()
        return res.status(201).json({ success: true, marksheet })
      }

      if (action === 'verify') {
        const { marksheetId, staffSignature } = req.body
        
        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          { 
            status: 'verified_by_staff',
            staffSignature,
            updatedAt: new Date()
          },
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        // Notify HOD when all marksheets for the class are verified
        try {
          const staff = await User.findById(marksheet.staffId)
          const year = marksheet.studentDetails?.year
          const dept = marksheet.studentDetails?.department
          if (staff && year && dept) {
            const remainingDrafts = await Marksheet.countDocuments({
              'studentDetails.year': year,
              'studentDetails.department': dept,
              staffId: marksheet.staffId,
              status: { $in: ['draft'] }
            })
            if (remainingDrafts === 0) {
              const hod = await User.findOne({ role: 'hod', department: dept })
              if (hod?.email) {
                await sendUserNotification(
                  hod.email,
                  `Year ${year} marks verified`,
                  `All marksheets for ${dept} - Year ${year} have been verified by ${staff.name}.`,
                  '/approval-requests'
                )
              }
              if (staff.email) {
                await sendUserNotification(
                  staff.email,
                  `Verification complete for Year ${year}`,
                  `You have verified all marksheets for ${dept} - Year ${year}. You can now request dispatch.`,
                  '/dispatch-requests'
                )
              }
            }
          }
        } catch {}

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'mark-visited') {
        const { marksheetId } = req.body
        if (!marksheetId) {
          return res.status(400).json({ success: false, error: 'marksheetId is required' })
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          {
            visited: true,
            visitedAt: new Date(),
            updatedAt: new Date()
          },
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'request-dispatch') {
        const { marksheetId, staffId } = req.body
        
        const staff = await User.findById(staffId)
        if (!staff) {
          return res.status(404).json({ success: false, error: 'Staff not found' })
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          { 
            status: 'dispatch_requested',
            'dispatchRequest.requestedAt': new Date(),
            'dispatchRequest.requestedBy': staff.name,
            'dispatchRequest.status': 'pending',
            'dispatchRequest.hodResponse': null,
            'dispatchRequest.hodComments': null,
            'dispatchRequest.scheduledDispatchDate': null,
            'dispatchRequest.respondedAt': null,
            'dispatchRequest.preDispatchNotificationSent': false,
            'dispatchRequest.autoDispatched': false,
            'dispatchRequest.autoDispatchFailed': false,
            updatedAt: new Date()
          },
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        // Notify HOD about new dispatch request
        try {
          const dept = marksheet.studentDetails?.department
          const hod = await User.findOne({ role: 'hod', department: dept })
          if (hod?.email) {
            await sendUserNotification(
              hod.email,
              'New dispatch request',
              `${staff.name} requested dispatch for ${marksheet.studentDetails?.name} (${marksheet.studentDetails?.regNumber}).`,
              '/approval-requests'
            )
          }
        } catch {}

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'hod-response') {
        const { marksheetId, hodId, response, comments, scheduledDispatchDate } = req.body
        
        const hod = await User.findById(hodId)
        if (!hod) {
          return res.status(404).json({ success: false, error: 'HOD not found' })
        }

        const normalizedResponse = (response || '').toLowerCase()
        const allowedResponses = ['approved', 'rejected', 'rescheduled']
        if (!allowedResponses.includes(normalizedResponse)) {
          return res.status(400).json({ success: false, error: 'Invalid response type' })
        }

        if (normalizedResponse === 'rescheduled' && !scheduledDispatchDate) {
          return res.status(400).json({ success: false, error: 'scheduledDispatchDate is required to reschedule' })
        }

        let statusUpdate = 'dispatch_requested'
        if (normalizedResponse === 'approved') statusUpdate = 'approved_by_hod'
        if (normalizedResponse === 'rejected') statusUpdate = 'rejected_by_hod'
        if (normalizedResponse === 'rescheduled') statusUpdate = 'rescheduled_by_hod'

        const updateData = {
          status: statusUpdate,
          hodId,
          hodName: hod.name,
          hodSignature: hod.eSignature,
          'dispatchRequest.status': normalizedResponse,
          'dispatchRequest.hodResponse': normalizedResponse,
          'dispatchRequest.hodComments': comments,
          'dispatchRequest.respondedAt': new Date(),
          'dispatchRequest.preDispatchNotificationSent': false,
          'dispatchRequest.autoDispatched': false,
          'dispatchRequest.autoDispatchFailed': false,
          'dispatchRequest.dispatchError': null,
          updatedAt: new Date()
        }

        if (scheduledDispatchDate) {
          updateData['dispatchRequest.scheduledDispatchDate'] = new Date(scheduledDispatchDate)
        } else {
          updateData['dispatchRequest.scheduledDispatchDate'] = null
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          updateData,
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        // Notify staff about HOD response
        try {
          const staff = await User.findById(marksheet.staffId)
          if (staff?.email) {
            if (normalizedResponse === 'approved') {
              await sendUserNotification(
                staff.email,
                'Dispatch approved by HOD',
                `Your dispatch request for ${marksheet.studentDetails?.name} has been approved.`,
                '/dispatch-requests'
              )
            } else if (normalizedResponse === 'rejected') {
              await sendUserNotification(
                staff.email,
                'Dispatch rejected by HOD',
                `Your dispatch request for ${marksheet.studentDetails?.name} was rejected. Comments: ${comments || 'N/A'}.`,
                '/dispatch-requests'
              )
            } else if (normalizedResponse === 'rescheduled') {
              const when = scheduledDispatchDate ? new Date(scheduledDispatchDate).toLocaleString() : 'later'
              await sendUserNotification(
                staff.email,
                'Dispatch rescheduled by HOD',
                `Your dispatch request for ${marksheet.studentDetails?.name} was rescheduled to ${when}.`,
                '/dispatch-requests'
              )
            }
          }
        } catch {}

        return res.status(200).json({ success: true, marksheet })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'DELETE') {
      const { marksheetId } = req.body
      
      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const deleted = await Marksheet.findByIdAndDelete(marksheetId)
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      return res.status(200).json({ success: true, deleted: true })
    }

    if (req.method === 'PUT') {
      const { marksheetId, studentDetails, subjects } = req.body

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const update = { updatedAt: new Date() }

      if (studentDetails && typeof studentDetails === 'object') {
        for (const key of ['name','regNumber','class','section','department','parentPhoneNumber']) {
          if (studentDetails[key] !== undefined) {
            update[`studentDetails.${key}`] = studentDetails[key]
          }
        }
      }

      if (Array.isArray(subjects) && subjects.length > 0) {
        update.subjects = subjects
        // Recalculate overall grade based on updated subjects
        const totalMarks = subjects.reduce((sum, sub) => sum + (Number(sub.marks) || 0), 0)
        const averageMarks = totalMarks / subjects.length
        let overallGrade = 'F'
        if (averageMarks >= 90) overallGrade = 'A+'
        else if (averageMarks >= 80) overallGrade = 'A'
        else if (averageMarks >= 70) overallGrade = 'B+'
        else if (averageMarks >= 60) overallGrade = 'B'
        else if (averageMarks >= 50) overallGrade = 'C'
        else if (averageMarks >= 40) overallGrade = 'D'
        update.overallGrade = overallGrade
        // If edited, move back to draft until verified again
        update.status = 'draft'
      }

      const marksheet = await Marksheet.findByIdAndUpdate(
        marksheetId,
        update,
        { new: true }
      )

      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      return res.status(200).json({ success: true, marksheet })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
    
  } catch (err) {
    console.error('Marksheets API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
