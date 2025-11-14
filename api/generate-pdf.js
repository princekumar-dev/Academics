import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, User } from '../models.js'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import crypto from 'crypto'

// PDF cache to avoid regenerating identical PDFs
const pdfCache = new Map()
const CACHE_MAX_SIZE = 50
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Function to generate cache key
const getCacheKey = (marksheetId) => {
  return `pdf_${marksheetId}`
}

// Function to expand department abbreviations to full names
const expandDepartmentName = (dept) => {
  const departmentMap = {
    'AI_DS': 'Artificial Intelligence and Data Science',
    'CSE': 'Computer Science and Engineering',
    'IT': 'Information Technology',
    'ECE': 'Electronics and Communication Engineering',
    'EEE': 'Electrical and Electronics Engineering',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering'
  }
  
  return departmentMap[dept] || dept
}

// Function to generate PDF using PDFKit
const generateMarksheetPDF = (marksheet, staffSignature, hodSignature, principalSignature) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers = []
      
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers)
        resolve(pdfData)
      })
      
      // Header
      doc.fontSize(16).font('Helvetica-Bold')
         .text('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', { align: 'center' })
      
      doc.fontSize(10).font('Helvetica')
         .text('(AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY.)', { align: 'center' })
         .text('363, ARCOT ROAD, KODAMBAKKAM, CHENNAI-600024', { align: 'center' })
      
      doc.fontSize(12).font('Helvetica-Bold')
         .text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', { align: 'center' })
      
      const examDate = new Date(marksheet.examinationDate)
      const examText = `${marksheet.examinationName || 'END SEMESTER EXAMINATIONS'} - ${examDate.toLocaleString('default', { month: 'long' }).toUpperCase()} - ${examDate.getFullYear()}`
      doc.fontSize(10).font('Helvetica-Bold')
         .text(examText, { align: 'center' })
      
      doc.moveDown(2)
      
      // Student Information
      doc.fontSize(12).font('Helvetica-Bold')
         .text(`Register Number: ${marksheet.studentDetails.regNumber}`)
         .text(`Student Name: ${marksheet.studentDetails.name}`)
         .text(`Department: B.Tech ${expandDepartmentName(marksheet.studentDetails.department)}`)
         .text(`Year/Semester: ${marksheet.studentDetails.year}${marksheet.semester ? `/${marksheet.semester}` : ''}`)
      
      doc.moveDown(2)
      
      // Marks Table Header
      doc.fontSize(10).font('Helvetica-Bold')
         .text('S.No', 50, doc.y, { width: 50 })
         .text('Course', 100, doc.y, { width: 250 })
         .text('Mark', 350, doc.y, { width: 80 })
         .text('Grade', 430, doc.y, { width: 80 })
      
      doc.moveDown()
      
      // Marks Table Rows
      marksheet.subjects.forEach((subject, index) => {
        doc.fontSize(9).font('Helvetica')
           .text((index + 1).toString(), 50, doc.y, { width: 50 })
           .text(subject.subjectName, 100, doc.y, { width: 250 })
           .text(subject.marks.toString(), 350, doc.y, { width: 80 })
           .text(subject.grade, 430, doc.y, { width: 80 })
        doc.moveDown()
      })
      
      // Signatures
      doc.moveDown(3)
      doc.fontSize(10).font('Helvetica-Bold')
         .text('Signature of Staff', 50, doc.y, { width: 150 })
         .text('Signature of Class Teacher', 200, doc.y, { width: 150 })
         .text('Signature of HOD', 350, doc.y, { width: 150 })
      
      doc.end()
      
    } catch (error) {
      reject(error)
    }
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in generate-pdf API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const { marksheetId } = req.query

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      // Get marksheet data
      const marksheet = await Marksheet.findById(marksheetId).populate('staffId').populate('hodId')
      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      // Check cache first
      const cacheKey = getCacheKey(marksheetId)
      const cached = pdfCache.get(cacheKey)
      
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log('Serving cached PDF for:', marksheetId)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf"`)
        res.setHeader('Content-Length', cached.buffer.length)
        res.setHeader('X-Cache', 'HIT')
        return res.status(200).send(cached.buffer)
      }

      // Get signatures
      const staffData = marksheet.staffId
      const staffSignature = staffData?.eSignature || null
      const hodData = marksheet.hodId
      const hodSignature = hodData?.eSignature || null
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null

      try {
        // Generate PDF using PDFKit
        const pdfBuffer = await generateMarksheetPDF(marksheet, staffSignature, hodSignature, principalSignature)

        // Cache the PDF
        if (pdfCache.size >= CACHE_MAX_SIZE) {
          const firstKey = pdfCache.keys().next().value
          pdfCache.delete(firstKey)
        }
        pdfCache.set(cacheKey, {
          buffer: pdfBuffer,
          timestamp: Date.now()
        })

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf"`)
        res.setHeader('Content-Length', pdfBuffer.length)
        res.setHeader('X-Cache', 'MISS')

        return res.status(200).send(pdfBuffer)

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate PDF',
          details: pdfError.message
        })
      }
    }

    if (req.method === 'POST') {
      const { marksheetId, returnType = 'base64' } = req.body

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const marksheet = await Marksheet.findById(marksheetId).populate('staffId').populate('hodId')
      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      const staffData = marksheet.staffId
      const staffSignature = staffData?.eSignature || null
      const hodData = marksheet.hodId
      const hodSignature = hodData?.eSignature || null
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null

      try {
        const pdfBuffer = await generateMarksheetPDF(marksheet, staffSignature, hodSignature, principalSignature)

        if (returnType === 'base64') {
          const base64Pdf = pdfBuffer.toString('base64')
          return res.status(200).json({ 
            success: true, 
            pdfBase64: base64Pdf,
            filename: `marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf`
          })
        } else {
          return res.status(200).json({ 
            success: true, 
            message: 'Use GET method to download PDF directly' 
          })
        }

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate PDF',
          details: pdfError.message
        })
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (err) {
    console.error('Generate PDF API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
