import mongoose from 'mongoose'
import { connectToDatabase } from './mongo.js'
import { Marksheet, User } from '../models.js'
import webpush from 'web-push'
import { getUserSubscriptions, storeNotification } from './notificationService.js'

// Configure web-push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'
try {
  webpush.setVapidDetails(
    'mailto:support@msecacademics.edu',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
} catch {}

async function sendUserNotification(userEmail, title, body, url = '/') {
  try {
    const { subscriptions } = await getUserSubscriptions(userEmail)
    const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/images/android-chrome-192x192.png',
      badge: '/images/favicon-32x32.png',
      tag: 'msec-academics',
      data: { url }
    })

    if (activeSubs && activeSubs.length > 0) {
      await Promise.all(activeSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, payload)
        } catch (err) {
          console.error('Push notification failed:', err.message)
        }
      }))
    }

    await storeNotification({ userEmail, title, body, url })
  } catch (err) {
    console.error('Notification error:', err.message)
  }
}

// Check for upcoming dispatches (1 hour before)
export async function checkUpcomingDispatches() {
  try {
    await connectToDatabase()

    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    // Find marksheets scheduled for dispatch in the next hour that haven't been notified
    const upcomingMarksheets = await Marksheet.find({
      'dispatchRequest.status': { $in: ['approved', 'rescheduled'] },
      'dispatchRequest.scheduledDispatchDate': {
        $gte: now,
        $lte: oneHourLater
      },
      'dispatchRequest.preDispatchNotificationSent': { $ne: true }
    }).populate('staffId')

    for (const marksheet of upcomingMarksheets) {
      const scheduledTime = new Date(marksheet.dispatchRequest.scheduledDispatchDate)
      const examYear = marksheet.examinationDetails?.year || 'N/A'
      const studentName = marksheet.studentDetails?.name || 'Student'

      // Send notification to staff member
      if (marksheet.staffId?.email) {
        await sendUserNotification(
          marksheet.staffId.email,
          '📅 Upcoming Dispatch',
          `Your ${examYear} marksheet for ${studentName} is scheduled to be dispatched at ${scheduledTime.toLocaleTimeString()}`,
          '/marksheets'
        )
      }

      // Mark notification as sent
      marksheet.dispatchRequest.preDispatchNotificationSent = true
      await marksheet.save()
    }

    console.log(`✓ Checked upcoming dispatches: ${upcomingMarksheets.length} notifications sent`)
  } catch (err) {
    console.error('Error checking upcoming dispatches:', err)
  }
}

// Process due dispatches
export async function processScheduledDispatches() {
  try {
    await connectToDatabase()

    const now = new Date()

    // Find marksheets that are due for dispatch
    const dueMarksheets = await Marksheet.find({
      'dispatchRequest.status': { $in: ['approved', 'rescheduled'] },
      'dispatchRequest.scheduledDispatchDate': { $lte: now },
      'dispatchRequest.autoDispatched': { $ne: true }
    }).populate('staffId')

    console.log(`Found ${dueMarksheets.length} marksheets due for dispatch`)

    for (const marksheet of dueMarksheets) {
      try {
        const phoneNumber = marksheet.studentDetails?.parentPhoneNumber
        
        if (!phoneNumber) {
          console.log(`No phone number for marksheet ${marksheet._id}`)
          
          // Notify staff of failure
          if (marksheet.staffId?.email) {
            await sendUserNotification(
              marksheet.staffId.email,
              '❌ Dispatch Failed',
              `Failed to dispatch marksheet for ${marksheet.studentDetails?.name}: No phone number available`,
              '/marksheets'
            )
          }
          
          marksheet.dispatchRequest.autoDispatched = true
          marksheet.dispatchRequest.autoDispatchFailed = true
          await marksheet.save()
          continue
        }

        // Call WhatsApp dispatch API
        const baseUrl = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000'
        const marksheetPdfUrl = `${baseUrl}/api/generate-pdf?marksheetId=${marksheet._id.toString()}`

        const dispatchResponse = await fetch(`${baseUrl}/api/whatsapp-dispatch?action=send-marksheet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marksheetId: marksheet._id.toString(),
            phoneNumber: phoneNumber,
            marksheetPdfUrl
          })
        })

        const dispatchResult = await dispatchResponse.json()

        if (dispatchResult.success) {
          // Update marksheet status
          marksheet.dispatchRequest.status = 'dispatched'
          marksheet.dispatchRequest.dispatchedAt = new Date()
          marksheet.dispatchRequest.autoDispatched = true
          marksheet.dispatchRequest.autoDispatchFailed = false
          await marksheet.save()

          // Notify staff of success
          if (marksheet.staffId?.email) {
            const examYear = marksheet.examinationDetails?.year || 'N/A'
            await sendUserNotification(
              marksheet.staffId.email,
              '✅ Dispatch Successful',
              `${examYear} marksheet for ${marksheet.studentDetails?.name} has been dispatched successfully via WhatsApp`,
              '/marksheets'
            )
          }

          console.log(`✓ Dispatched marksheet ${marksheet._id}`)
        } else {
          // Mark as failed
          marksheet.dispatchRequest.autoDispatched = true
          marksheet.dispatchRequest.autoDispatchFailed = true
          marksheet.dispatchRequest.dispatchError = dispatchResult.error || 'Unknown error'
          await marksheet.save()

          // Notify staff of failure
          if (marksheet.staffId?.email) {
            await sendUserNotification(
              marksheet.staffId.email,
              '❌ Dispatch Failed',
              `Failed to dispatch marksheet for ${marksheet.studentDetails?.name}: ${dispatchResult.error || 'Unknown error'}`,
              '/marksheets'
            )
          }

          console.log(`✗ Failed to dispatch marksheet ${marksheet._id}: ${dispatchResult.error}`)
        }
      } catch (err) {
        console.error(`Error dispatching marksheet ${marksheet._id}:`, err)
        
        // Mark as failed
        marksheet.dispatchRequest.autoDispatched = true
        marksheet.dispatchRequest.autoDispatchFailed = true
        marksheet.dispatchRequest.dispatchError = err.message
        await marksheet.save()

        // Notify staff
        if (marksheet.staffId?.email) {
          await sendUserNotification(
            marksheet.staffId.email,
            '❌ Dispatch Failed',
            `Failed to dispatch marksheet for ${marksheet.studentDetails?.name}: ${err.message}`,
            '/marksheets'
          )
        }
      }
    }

    console.log(`✓ Processed ${dueMarksheets.length} scheduled dispatches`)
  } catch (err) {
    console.error('Error processing scheduled dispatches:', err)
  }
}

// Start the scheduled dispatch service
export function startScheduledDispatchService() {
  console.log('🚀 Starting scheduled dispatch service...')

  // Check for upcoming dispatches every 10 minutes
  setInterval(checkUpcomingDispatches, 10 * 60 * 1000)

  // Process due dispatches every 5 minutes
  setInterval(processScheduledDispatches, 5 * 60 * 1000)

  // Run immediately on startup
  setTimeout(checkUpcomingDispatches, 5000)
  setTimeout(processScheduledDispatches, 10000)

  console.log('✓ Scheduled dispatch service started')
  console.log('  - Checking upcoming dispatches every 10 minutes')
  console.log('  - Processing due dispatches every 5 minutes')
}
