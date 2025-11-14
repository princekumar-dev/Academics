import { connectToDatabase } from '../lib/mongo.js'
import { checkUpcomingDispatches, processScheduledDispatches } from '../lib/scheduledDispatchService.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  // POST: Manually trigger dispatch checks (for testing or manual runs)
  if (req.method === 'POST') {
    try {
      const { action } = req.body

      if (action === 'check-upcoming') {
        await checkUpcomingDispatches()
        return res.json({ 
          success: true, 
          message: 'Upcoming dispatches checked successfully' 
        })
      }

      if (action === 'process-due') {
        await processScheduledDispatches()
        return res.json({ 
          success: true, 
          message: 'Due dispatches processed successfully' 
        })
      }

      if (action === 'run-all') {
        await checkUpcomingDispatches()
        await processScheduledDispatches()
        return res.json({ 
          success: true, 
          message: 'All dispatch checks completed successfully' 
        })
      }

      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Use: check-upcoming, process-due, or run-all' 
      })
    } catch (err) {
      console.error('Scheduled dispatch error:', err)
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      })
    }
  }

  // GET: Get service status
  if (req.method === 'GET') {
    return res.json({
      success: true,
      status: 'running',
      message: 'Scheduled dispatch service is active',
      checkIntervals: {
        upcoming: '10 minutes',
        processing: '5 minutes'
      }
    })
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' })
}
