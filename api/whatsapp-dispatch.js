import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, User } from '../models.js'
import twilio from 'twilio'
import { getUserSubscriptions, storeNotification } from '../lib/notificationService.js'
import webpush from 'web-push'

// Configure web-push if VAPID keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:academics@msec.edu',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Helper to send notifications to user
async function sendUserNotification(userEmail, title, body, url) {
  try {
    const subs = await getUserSubscriptions(userEmail)
    const payload = JSON.stringify({ title, body, url })
    
    await Promise.all(subs.map(sub => 
      webpush.sendNotification(sub, payload).catch(() => {})
    ))
    
    await storeNotification(userEmail, title, body, url)
  } catch (err) {
    console.error('Notification error:', err.message)
  }
}

// Initialize Twilio client
let twilioClient = null
let twilioConfigError = null

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  // Validate credentials format
  if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioConfigError = 'Invalid TWILIO_ACCOUNT_SID format. It should start with "AC"'
    console.warn('⚠️ ', twilioConfigError)
  } else if (process.env.TWILIO_AUTH_TOKEN.length < 30) {
    twilioConfigError = 'TWILIO_AUTH_TOKEN appears to be invalid (too short)'
    console.warn('⚠️ ', twilioConfigError)
  } else {
    try {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      console.log('✅ Twilio client initialized successfully')
    } catch (err) {
      twilioConfigError = `Failed to initialize Twilio: ${err.message}`
      console.error('❌', twilioConfigError)
    }
  }
} else {
  twilioConfigError = 'Twilio credentials not found in environment variables'
  console.warn('⚠️ ', twilioConfigError)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Health check endpoint
  if (req.method === 'GET' && req.query.action === 'health') {
    return res.status(200).json({
      success: true,
      configured: !!twilioClient,
      error: twilioConfigError,
      accountSid: process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.substring(0, 8) + '...' : 'Not set',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'Not set',
      setupGuide: 'See TWILIO_SETUP_GUIDE.md for configuration instructions'
    })
  }

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in whatsapp-dispatch API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'POST') {
      const { action } = req.query

      if (action === 'send-marksheet') {
        const { marksheetId, marksheetPdfUrl } = req.body

        if (!marksheetId || !marksheetPdfUrl) {
          return res.status(400).json({ 
            success: false, 
            error: 'marksheetId and marksheetPdfUrl are required' 
          })
        }

        if (!twilioClient) {
          console.error('❌ Twilio not configured. Check environment variables.')
          console.error('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing')
          console.error('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '✗ Missing')
          console.error('TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER ? '✓ Set' : '✗ Missing')
          console.error('Configuration error:', twilioConfigError)
          return res.status(500).json({ 
            success: false, 
            error: 'WhatsApp service not configured properly',
            details: twilioConfigError || 'Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in .env file',
            setupGuide: 'See TWILIO_SETUP_GUIDE.md for detailed setup instructions'
          })
        }

        const marksheet = await Marksheet.findById(marksheetId)
        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        // Allow dispatch if approved or rescheduled by HOD
        const allowedStatuses = ['approved_by_hod', 'rescheduled_by_hod']
        if (!allowedStatuses.includes(marksheet.status)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Marksheet must be approved by HOD before dispatch' 
          })
        }

        try {
          // Format phone number for WhatsApp (must include country code)
          let phoneNumber = marksheet.studentDetails.parentPhoneNumber
          if (!phoneNumber.startsWith('+')) {
            // Assume Indian numbers if no country code
            phoneNumber = phoneNumber.startsWith('91') ? `+${phoneNumber}` : `+91${phoneNumber}`
          }

          // Extract examination month and year
          const examMonth = marksheet.examinationDate.toLocaleDateString('en-US', { month: 'long' })
          const examYear = marksheet.examinationDate.getFullYear()

          // Create WhatsApp message
            const message = `Hello! 📚

  Your child's marksheet for ${marksheet.studentDetails.name} (Reg: ${marksheet.studentDetails.regNumber}) is ready.

  🎓 Year/Sem: ${marksheet.studentDetails.year}/${marksheet.semester}
  📅 Examination: ${examMonth} ${examYear}
  📊 Overall Grade: ${marksheet.overallGrade}

  Please find the detailed marksheet attached.

  Best regards,
  MSEC Academics Department`

          // Debug PDF URL
          console.log('📄 PDF URL:', marksheetPdfUrl)
          console.log('📞 Sending to:', `whatsapp:${phoneNumber}`)
          console.log('📱 From:', process.env.TWILIO_WHATSAPP_NUMBER)

          // Send WhatsApp message (temporarily without PDF attachment for testing)
          const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM
          const messageResponse = await twilioClient.messages.create({
            from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
            to: `whatsapp:${phoneNumber}`,
            body: message + `\n\n📎 Download PDF: ${marksheetPdfUrl}`
            // mediaUrl: [marksheetPdfUrl] // Temporarily disabled for testing
          })

          // Update marksheet dispatch status
          await Marksheet.findByIdAndUpdate(marksheetId, {
            status: 'dispatched',
            'dispatchStatus.dispatched': true,
            'dispatchStatus.dispatchedAt': new Date(),
            'dispatchStatus.whatsappStatus': 'sent',
            updatedAt: new Date()
          })

          // Notify staff about successful dispatch
          try {
            const staff = await User.findById(marksheet.staffId)
            if (staff?.email) {
              await sendUserNotification(
                staff.email,
                '✅ Marksheet Dispatched',
                `Marksheet for ${marksheet.studentDetails.name} (${marksheet.studentDetails.regNumber}) has been successfully sent via WhatsApp.`,
                `/marksheets/${marksheet._id}`
              )
            }
          } catch {}

          return res.status(200).json({ 
            success: true, 
            message: 'Marksheet sent successfully via WhatsApp',
            twilioSid: messageResponse.sid
          })

        } catch (twilioErr) {
          console.error('❌ Twilio WhatsApp error:', twilioErr)
          console.error('Error code:', twilioErr.code)
          console.error('Error status:', twilioErr.status)
          console.error('Error message:', twilioErr.message)
          console.error('More info:', twilioErr.moreInfo)
          
          // Check for common Twilio errors
          let errorMessage = twilioErr.message
          if (twilioErr.code === 20003 || twilioErr.message?.includes('Authenticate')) {
            errorMessage = 'Twilio authentication failed. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env file'
          } else if (twilioErr.code === 21211) {
            errorMessage = 'Invalid phone number format. Phone number must include country code (e.g., +91XXXXXXXXXX)'
          } else if (twilioErr.code === 63007) {
            errorMessage = 'WhatsApp Sandbox number not configured. Please activate WhatsApp in your Twilio account or use a production number'
          }
          
          // Update marksheet with error status
          await Marksheet.findByIdAndUpdate(marksheetId, {
            'dispatchStatus.whatsappStatus': 'failed',
            'dispatchStatus.whatsappError': errorMessage,
            updatedAt: new Date()
          })

          // Notify staff about dispatch failure
          try {
            const staff = await User.findById(marksheet.staffId)
            if (staff?.email) {
              await sendUserNotification(
                staff.email,
                '❌ Dispatch Failed',
                `Failed to send marksheet for ${marksheet.studentDetails.name} (${marksheet.studentDetails.regNumber}): ${errorMessage}`,
                `/marksheets/${marksheet._id}`
              )
            }
          } catch {}

          return res.status(500).json({ 
            success: false, 
            error: errorMessage,
            details: twilioErr.message,
            twilioCode: twilioErr.code
          })
        }
      }

      if (action === 'send-bulk') {
        const { marksheetIds, baseUrl } = req.body

        if (!marksheetIds || !Array.isArray(marksheetIds) || marksheetIds.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'marksheetIds array is required' 
          })
        }

        if (!twilioClient) {
          return res.status(500).json({ 
            success: false, 
            error: 'WhatsApp service not configured' 
          })
        }

        const results = {
          successful: 0,
          failed: 0,
          errors: []
        }

        for (const marksheetId of marksheetIds) {
          try {
            const marksheet = await Marksheet.findById(marksheetId)
            if (!marksheet) {
              results.failed++
              results.errors.push(`Marksheet ${marksheetId} not found`)
              continue
            }

            // Allow dispatch if approved or rescheduled by HOD
            const allowedStatuses = ['approved_by_hod', 'rescheduled_by_hod']
            if (!allowedStatuses.includes(marksheet.status)) {
              results.failed++
              results.errors.push(`Marksheet ${marksheetId} not approved by HOD`)
              continue
            }

            // Generate PDF URL for this marksheet
            const marksheetPdfUrl = `${baseUrl}/api/generate-pdf?marksheetId=${marksheetId}`

            // Format phone number
            let phoneNumber = marksheet.studentDetails.parentPhoneNumber
            if (!phoneNumber.startsWith('+')) {
              phoneNumber = phoneNumber.startsWith('91') ? `+${phoneNumber}` : `+91${phoneNumber}`
            }

            // Extract examination month and year
            const examMonth = marksheet.examinationDate.toLocaleDateString('en-US', { month: 'long' })
            const examYear = marksheet.examinationDate.getFullYear()

            const message = `Hello! 📚

Your child's marksheet for ${marksheet.studentDetails.name} (Reg: ${marksheet.studentDetails.regNumber}) is ready.

🎓 Year/Sem: ${marksheet.studentDetails.year}/${marksheet.semester}
📅 Examination: ${examMonth} ${examYear}
📊 Overall Grade: ${marksheet.overallGrade}

Please find the detailed marksheet attached.

Best regards,
MSEC Academics Department`

            // Send WhatsApp message
            const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM
            await twilioClient.messages.create({
              from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
              to: `whatsapp:${phoneNumber}`,
              body: message,
              mediaUrl: [marksheetPdfUrl]
            })

            // Update marksheet status
            await Marksheet.findByIdAndUpdate(marksheetId, {
              status: 'dispatched',
              'dispatchStatus.dispatched': true,
              'dispatchStatus.dispatchedAt': new Date(),
              'dispatchStatus.whatsappStatus': 'sent',
              updatedAt: new Date()
            })

            results.successful++

          } catch (err) {
            console.error(`Error sending marksheet ${marksheetId}:`, err)
            results.failed++
            results.errors.push(`Failed to send marksheet ${marksheetId}: ${err.message}`)

            // Update marksheet with error status
            await Marksheet.findByIdAndUpdate(marksheetId, {
              'dispatchStatus.whatsappStatus': 'failed',
              'dispatchStatus.whatsappError': err.message,
              updatedAt: new Date()
            })
          }

          // Add small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Notify staff about bulk dispatch completion
        try {
          if (marksheetIds.length > 0) {
            const firstMarksheet = await Marksheet.findById(marksheetIds[0]).populate('staffId', 'email name')
            if (firstMarksheet?.staffId?.email) {
              const successRate = ((results.successful / marksheetIds.length) * 100).toFixed(0)
              await sendUserNotification(
                firstMarksheet.staffId.email,
                '📦 Bulk Dispatch Complete',
                `Dispatched ${results.successful} of ${marksheetIds.length} marksheets (${successRate}% success rate). ${results.failed > 0 ? `${results.failed} failed.` : ''}`,
                '/dispatch-requests'
              )
            }
          }
        } catch {}

        return res.status(200).json({ 
          success: true, 
          message: 'Bulk dispatch completed',
          results
        })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'GET') {
      // Get dispatch status for marksheets
      const { marksheetIds } = req.query

      if (!marksheetIds) {
        return res.status(400).json({ success: false, error: 'marksheetIds query parameter required' })
      }

      const ids = Array.isArray(marksheetIds) ? marksheetIds : marksheetIds.split(',')
      
      const marksheets = await Marksheet.find(
        { _id: { $in: ids } },
        { 
          _id: 1, 
          marksheetId: 1, 
          studentDetails: 1, 
          status: 1, 
          dispatchStatus: 1 
        }
      )

      return res.status(200).json({ success: true, marksheets })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (err) {
    console.error('WhatsApp dispatch API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
