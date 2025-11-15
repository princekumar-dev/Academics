import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// PDF cache to avoid regenerating identical PDFs
const pdfCache = new Map()
const CACHE_MAX_SIZE = 50
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Function to generate cache key
const getCacheKey = (marksheetId) => {
  return `pdf_${marksheetId}`
}

const LOGO_PATH = (() => {
  const logoPath = path.resolve(process.cwd(), 'public', 'images', 'mseclogo.png')
  return fs.existsSync(logoPath) ? logoPath : null
})()

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

const decodeBase64Image = (dataUrl) => {
  if (!dataUrl) return null
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  try {
    return Buffer.from(base64, 'base64')
  } catch (err) {
    console.warn('Failed to decode base64 image for PDF:', err.message)
    return null
  }
}

// Function to generate PDF using PDFKit
const generateMarksheetPDF = (marksheet, staffSignature, hodSignature, principalSignature) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const buffers = []
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
      
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers)
        resolve(pdfData)
      })

      // Header area with logo left and centered text block on the right
      const headerTop = doc.y
      const logoWidth = 75
      const logoHeight = 75
      const headerGap = 18
      const textBlockX = doc.page.margins.left + logoWidth + headerGap
      const textBlockWidth = contentWidth - logoWidth - headerGap

      if (LOGO_PATH) {
        doc.image(LOGO_PATH, doc.page.margins.left, headerTop + 2, {
          width: logoWidth,
          height: logoHeight
        })
      }

      let textCursorY = headerTop
      const writeHeaderLine = (text, fontSize, fontName = 'Helvetica', spacing = 2) => {
        doc.font(fontName).fontSize(fontSize)
          .text(text, textBlockX, textCursorY, {
            width: textBlockWidth,
            align: 'center'
          })
        textCursorY = doc.y + spacing
      }

      writeHeaderLine('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', 16, 'Helvetica-Bold', 4)
      writeHeaderLine('(AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY.)', 10, 'Helvetica', 2)
      writeHeaderLine('363, ARCOT ROAD, KODAMBAKKAM, CHENNAI-600024', 10, 'Helvetica', 4)
      writeHeaderLine('OFFICE OF THE CONTROLLER OF EXAMINATIONS', 12, 'Helvetica-Bold', 4)

      const examDate = new Date(marksheet.examinationDate)
      const examText = `${(marksheet.examinationName || 'END SEMESTER EXAMINATIONS').toUpperCase()} - ${examDate.toLocaleString('default', { month: 'long' }).toUpperCase()} - ${examDate.getFullYear()}`
      writeHeaderLine(examText, 10, 'Helvetica-Bold', 0)

      const headerBottom = Math.max(textCursorY, headerTop + logoHeight)

      doc.moveTo(doc.page.margins.left, headerBottom + 6)
        .lineTo(doc.page.width - doc.page.margins.right, headerBottom + 6)
        .lineWidth(0.75)
        .stroke()

      doc.y = headerBottom + 16

      // Student Information
      const infoRows = [
        { label: 'Register Number', value: marksheet.studentDetails.regNumber },
        { label: 'Student Name', value: marksheet.studentDetails.name },
        { label: 'Department', value: `B.Tech ${expandDepartmentName(marksheet.studentDetails.department)}` },
        { label: 'Year/Semester', value: `${marksheet.studentDetails.year}${marksheet.semester ? `/${marksheet.semester}` : ''}` }
      ]

      const infoLabelWidth = 140
      const infoValueX = doc.page.margins.left + infoLabelWidth + 6
      const infoLineGap = 6
      infoRows.forEach((row) => {
        const labelOptions = { width: infoLabelWidth }
        const valueOptions = { width: contentWidth - infoLabelWidth - 6 }

        doc.font('Helvetica-Bold').fontSize(11)
        const labelHeight = doc.heightOfString(`${row.label}:`, labelOptions)

        doc.font('Helvetica').fontSize(11)
        const valueHeight = doc.heightOfString(row.value, valueOptions)

        const rowHeight = Math.max(labelHeight, valueHeight)
        const rowY = doc.y

        doc.font('Helvetica-Bold').fontSize(11)
          .text(`${row.label}:`, doc.page.margins.left, rowY, labelOptions)
        doc.font('Helvetica').fontSize(11)
          .text(row.value, infoValueX, rowY, valueOptions)

        doc.y = rowY + rowHeight + infoLineGap
      })

      doc.moveDown(0.5)

      const tableTop = doc.y + 10
      const footerReserve = 140
      const subjects = marksheet.subjects || []
      const rowsCount = subjects.length || 1
      const maxTableHeight = Math.max(120, doc.page.height - doc.page.margins.bottom - footerReserve - tableTop)
      const baseRowHeight = Math.max(20, Math.floor(maxTableHeight / (rowsCount + 1)) || 20)
      const rowFontSize = Math.max(9, Math.min(12, baseRowHeight - 6))
      const columnPaddingX = 6
      const columnPaddingY = 4

      const columns = [
        { key: 'sno', label: 'S.No', width: 45, align: 'center' },
        { key: 'course', label: 'Course', width: contentWidth - 175 },
        { key: 'mark', label: 'Mark', width: 70, align: 'center' },
        { key: 'grade', label: 'Grade', width: 60, align: 'center' }
      ]

      let currentX = doc.page.margins.left
      columns.forEach((col) => {
        col.x = currentX
        currentX += col.width
      })

      const measureCellHeight = (text, col) => {
        const cellText = `${text ?? ''}`
        return doc.heightOfString(cellText, {
          width: col.width - columnPaddingX * 2,
          align: col.align || 'left'
        })
      }

      const getRowHeight = (rowValues) => {
        let maxHeight = 0
        columns.forEach((col) => {
          doc.font('Helvetica').fontSize(rowFontSize)
          maxHeight = Math.max(maxHeight, measureCellHeight(rowValues[col.key], col))
        })
        return Math.max(baseRowHeight, maxHeight + columnPaddingY * 2)
      }

      let currentY = tableTop
      const headerRowHeight = Math.max(baseRowHeight, rowFontSize + columnPaddingY * 2 + 2)

      doc.rect(doc.page.margins.left, currentY, contentWidth, headerRowHeight).stroke()
      columns.forEach((col) => {
        doc.font('Helvetica-Bold').fontSize(rowFontSize)
          .text(col.label, col.x + columnPaddingX, currentY + columnPaddingY, {
            width: col.width - columnPaddingX * 2,
            align: col.align || 'left'
          })
        doc.moveTo(col.x + col.width, currentY)
          .lineTo(col.x + col.width, currentY + headerRowHeight)
          .stroke()
      })

      currentY += headerRowHeight

      subjects.forEach((subject, index) => {
        const rowValues = {
          sno: index + 1,
          course: subject.subjectName,
          mark: subject.marks,
          grade: subject.grade
        }

        const rowHeight = getRowHeight(rowValues)
        doc.rect(doc.page.margins.left, currentY, contentWidth, rowHeight).stroke()

        columns.forEach((col) => {
          doc.font('Helvetica').fontSize(rowFontSize)
            .text(`${rowValues[col.key] ?? ''}`, col.x + columnPaddingX, currentY + columnPaddingY, {
              width: col.width - columnPaddingX * 2,
              align: col.align || 'left'
            })
          doc.moveTo(col.x + col.width, currentY)
            .lineTo(col.x + col.width, currentY + rowHeight)
            .stroke()
        })

        currentY += rowHeight
      })

      const tableBottom = currentY + 6
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`Overall Grade: ${marksheet.overallGrade || '-'}`, doc.page.margins.left, tableBottom)
      doc.font('Helvetica')
        .text(`Total Subjects: ${subjects.length}`, doc.page.margins.left + contentWidth / 2, tableBottom)

      const signatureY = doc.page.height - doc.page.margins.bottom - 60
      const slotWidth = contentWidth / 3
      const signatureSlots = [
        { label: 'Signature of Staff', image: staffSignature },
        { label: 'Signature of HOD', image: hodSignature },
        { label: 'Signature of Principal', image: principalSignature }
      ]

      signatureSlots.forEach((slot, index) => {
        const slotX = doc.page.margins.left + index * slotWidth
        const imageBuffer = decodeBase64Image(slot.image)
        if (imageBuffer) {
          doc.image(imageBuffer, slotX + 10, signatureY - 45, {
            fit: [slotWidth - 20, 40],
            align: 'center'
          })
        }

        doc.moveTo(slotX + 10, signatureY)
          .lineTo(slotX + slotWidth - 10, signatureY)
          .stroke()

        doc.fontSize(9).font('Helvetica')
          .text(slot.label, slotX + 10, signatureY + 4, {
            width: slotWidth - 20,
            align: 'center'
          })
      })

      doc.fontSize(8).fillColor('#555555')
        .text(`Generated on ${new Date().toLocaleString()}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20, {
          width: contentWidth,
          align: 'right'
        })
      doc.fillColor('black')

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
