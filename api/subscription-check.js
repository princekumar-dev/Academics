import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    await connectToDatabase()
    
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    // Find user by email
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Check if user has any active push subscriptions
    const hasSubscription = user.pushSubscriptions && 
                           Array.isArray(user.pushSubscriptions) && 
                           user.pushSubscriptions.some(sub => 
                             sub.active === true || sub.status === 'active'
                           )

    return res.status(200).json({ 
      success: true, 
      hasSubscription,
      subscriptionCount: hasSubscription ? user.pushSubscriptions.filter(s => s.active || s.status === 'active').length : 0
    })

  } catch (error) {
    console.error('Subscription check error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check subscription status' 
    })
  }
}
