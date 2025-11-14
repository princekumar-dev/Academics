import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  // CORS is already handled by the cors middleware in server.js
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      // Connect to database
      try {
        await connectToDatabase()
      } catch (dbError) {
        console.error('Database connection error:', dbError.message)
        return res.status(503).json({
          success: false,
          error: 'Database connection error. Please check MongoDB connection.'
        })
      }

      const { email, password } = req.body

      // Basic validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        })
      }

      // Find user in msec_academics database
      const user = await User.findOne({ email: email.toLowerCase() })
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        })
      }

      // Compare submitted password with hashed password from DB
      const passwordMatches = await bcrypt.compare(password, user.password)
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        })
      }

      // Authentication successful
      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          year: user.year,
          section: user.section
        }
      })

    } catch (error) {
      console.error('Authentication error:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }
}