import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in users API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      // list users for academic system
      const users = await User.find().sort({ createdAt: -1 }).lean()
      // Remove sensitive fields before sending to client
      const safe = users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        year: u.year,
        section: u.section,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt
      }))
      return res.status(200).json({ success: true, users: safe })
    }

    if (req.method === 'POST') {
      // create academic user
      const { name, email, password, role, department, year, section, phoneNumber } = req.body
      if (!name || !email || !password || !role || !department) {
        return res.status(400).json({ success: false, error: 'name, email, password, role and department are required' })
      }

      // Validate role
      if (!['staff', 'hod'].includes(role)) {
        return res.status(400).json({ success: false, error: 'role must be either staff or hod' })
      }

      // Validate department
      const validDepartments = ['CSE', 'AI_DS', 'ECE', 'MECH', 'CIVIL', 'EEE']
      if (!validDepartments.includes(department)) {
        return res.status(400).json({ success: false, error: 'invalid department' })
      }

      // For staff, year and section are required
      if (role === 'staff' && (!year || !section)) {
        return res.status(400).json({ success: false, error: 'year and section are required for staff role' })
      }

      const existing = await User.findOne({ email: email.toLowerCase() })
      if (existing) {
        return res.status(409).json({ success: false, error: 'User already exists' })
      }

      const hashed = await bcrypt.hash(password, 10)
      const userData = {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role,
        department,
        phoneNumber
      }

      // Add class for staff (constructed from year and section)
      if (role === 'staff') {
        userData.year = year;
        userData.section = section;
      }

      const user = new User(userData)
      await user.save()

      // return safe user object
      const safe = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        class: user.class,
        phoneNumber: user.phoneNumber
      }
      return res.status(201).json({ success: true, user: safe })
    }

    if (req.method === 'DELETE') {
      // Expect JSON body with { userId }
      const { userId } = req.body || {}
      if (!userId) return res.status(400).json({ success: false, error: 'userId required' })

      try {
        const deleted = await User.findByIdAndDelete(userId)
        if (!deleted) return res.status(404).json({ success: false, error: 'User not found' })
        return res.status(200).json({ success: true, deleted: true })
      } catch (delErr) {
        console.error('Error deleting user:', delErr)
        return res.status(500).json({ success: false, error: 'Failed to delete user' })
      }
    }

    // PATCH endpoints for user updates
    if (req.method === 'PATCH') {
      const { action, userId } = req.query
      if (!action || !userId) return res.status(400).json({ success: false, error: 'action and userId required' })

      if (action === 'update-signature') {
        const { eSignature } = req.body
        const u = await User.findByIdAndUpdate(userId, { eSignature }, { new: true }).lean()
        return res.status(200).json({ success: true, user: { id: u._id, eSignature: u.eSignature } })
      }

      if (action === 'update-profile') {
        const { name, phoneNumber } = req.body
        const updateData = {}
        if (name) updateData.name = name
        if (phoneNumber) updateData.phoneNumber = phoneNumber
        
        const u = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean()
        return res.status(200).json({ success: true, user: { 
          id: u._id, 
          name: u.name, 
          phoneNumber: u.phoneNumber 
        }})
      }

      if (action === 'reset-password') {
        const { currentPassword, newPassword } = req.body
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' })
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
        }

        try {
          // Find user and verify current password
          const user = await User.findById(userId)
          if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
          }

          // Verify current password
          const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
          if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' })
          }

          // Hash new password and update
          const hashedPassword = await bcrypt.hash(newPassword, 10)
          const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword }, { new: true }).lean()

          return res.status(200).json({ success: true, message: 'Password updated successfully', user: { id: updatedUser._id, email: updatedUser.email } })
        } catch (error) {
          console.error('Error resetting password:', error)
          return res.status(500).json({ success: false, error: 'Failed to reset password' })
        }
      }

      return res.status(400).json({ success: false, error: 'unknown action' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Users API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
