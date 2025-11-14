import { connectToDatabase } from '../lib/mongo.js'
import { ImportSession, Student, Marksheet, User } from '../models.js'
import multer from 'multer'
import XLSX from 'xlsx'

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'))
    }
  }
})

// Grade calculation function
function calculateGrade(marks) {
  if (marks >= 90) return 'A+'
  if (marks >= 80) return 'A'
  if (marks >= 70) return 'B+'
  if (marks >= 60) return 'B'
  if (marks >= 50) return 'C'
  if (marks >= 40) return 'D'
  return 'F'
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in import-excel API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'POST') {
      const { action } = req.query

      if (action === 'upload') {
        // Handle file upload with multer
        upload.single('excelFile')(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ success: false, error: err.message })
          }

          if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' })
          }

          // Accept optional examinationName and examinationDate in form; they can also be present in the Excel
          const { staffId, examinationDate, examinationName, department, year: yearParam, semester } = req.body

          if (!staffId || !department || !yearParam) {
            return res.status(400).json({ success: false, error: 'staffId, department, and year are required' })
          }

          try {
            // Parse Excel file
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            if (jsonData.length === 0) {
              return res.status(400).json({ success: false, error: 'Excel file is empty' })
            }

            // Derive examination name/date for the session from req.body or first row
            const firstRow = jsonData[0] || {}
            const derivedExamName = examinationName || (firstRow.ExaminationName ? firstRow.ExaminationName.toString().trim() : '')
            const derivedExamDate = firstRow.ExaminationDate ? new Date(firstRow.ExaminationDate) : (examinationDate ? new Date(examinationDate) : null)
            if (!derivedExamDate) {
              return res.status(400).json({ success: false, error: 'Examination date is required either as a form field or in the Excel file (ExaminationDate column).' })
            }

            // Validate and process data
            const studentsData = []
            const errorMessages = []

            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i]
              const rowNum = i + 2 // Excel row number (1-indexed + header)

              // Required fields validation
              if (!row.Name || !row.RegNumber || !row.Section || !row.ParentPhone) {
                errorMessages.push(`Row ${rowNum}: Missing required fields (Name, RegNumber, Section, ParentPhone)`)
                continue
              }

              // Extract subject marks (all columns that aren't basic student info)
              const subjects = []
              const subjectFields = Object.keys(row).filter(key => 
                !['Name', 'RegNumber', 'Year', 'Section', 'ParentPhone', 'ExaminationName', 'ExaminationDate'].includes(key)
              )

              for (const subjectName of subjectFields) {
                const marks = parseFloat(row[subjectName])
                if (isNaN(marks) || marks < 0 || marks > 100) {
                  errorMessages.push(`Row ${rowNum}: Invalid marks for ${subjectName}: ${row[subjectName]}`)
                  continue
                }
                subjects.push({
                  subjectName,
                  marks,
                  grade: calculateGrade(marks)
                })
              }

              if (subjects.length === 0) {
                errorMessages.push(`Row ${rowNum}: No valid subject marks found`)
                continue
              }

              studentsData.push({
                name: row.Name.toString().trim(),
                regNumber: row.RegNumber.toString().trim(),
                year: yearParam,
                section: row.Section.toString().trim(),
                parentPhoneNumber: row.ParentPhone.toString().trim(),
                examinationName: row.ExaminationName ? row.ExaminationName.toString().trim() : derivedExamName,
                examinationDate: row.ExaminationDate ? new Date(row.ExaminationDate) : derivedExamDate,
                subjects
              })
            }

            if (studentsData.length === 0) {
              return res.status(400).json({ 
                success: false, 
                error: 'No valid student data found',
                errorMessages 
              })
            }

            // Create import session
            const importSession = new ImportSession({
              staffId,
              department,
              year: yearParam,
              semester: semester,
              examinationName: derivedExamName,
              examinationDate: derivedExamDate,
              studentsData,
              status: errorMessages.length === 0 ? 'pending' : 'error',
              errorMessages
            })

            await importSession.save()

            return res.status(200).json({ 
              success: true, 
              sessionId: importSession.sessionId,
              studentsCount: studentsData.length,
              errorMessages,
              hasErrors: errorMessages.length > 0
            })

          } catch (parseErr) {
            console.error('Excel parsing error:', parseErr)
            return res.status(400).json({ 
              success: false, 
              error: 'Failed to parse Excel file. Please check the format.' 
            })
          }
        })
        return // Important: return here since multer handles the response
      }

      if (action === 'confirm') {
        const { sessionId } = req.body

        if (!sessionId) {
          return res.status(400).json({ success: false, error: 'sessionId is required' })
        }

        const session = await ImportSession.findOne({ sessionId })
        if (!session) {
          return res.status(404).json({ success: false, error: 'Import session not found' })
        }

        if (session.status === 'processed') {
          return res.status(400).json({ success: false, error: 'Session already processed' })
        }

        const staff = await User.findById(session.staffId)
        if (!staff) {
          return res.status(404).json({ success: false, error: 'Staff not found' })
        }

        const createdMarksheets = []

        // Process each student
        for (const studentData of session.studentsData) {
          try {
            // Create or update student record
            let student = await Student.findOne({ regNumber: studentData.regNumber })
            if (!student) {
              student = new Student({
                name: studentData.name,
                regNumber: studentData.regNumber,
                year: studentData.year,
                section: studentData.section,
                department: session.department,
                parentPhoneNumber: studentData.parentPhoneNumber,
                examinationName: studentData.examinationName,
                examinationDate: studentData.examinationDate
              })
              await student.save()
            } else {
              // Update existing student data
              student.name = studentData.name
              student.year = studentData.year
              student.section = studentData.section
              student.parentPhoneNumber = studentData.parentPhoneNumber
              student.examinationName = studentData.examinationName
              student.examinationDate = studentData.examinationDate
              await student.save()
            }

            // Calculate overall grade
            const totalMarks = studentData.subjects.reduce((sum, sub) => sum + sub.marks, 0)
            const averageMarks = totalMarks / studentData.subjects.length
            const overallGrade = calculateGrade(averageMarks)

            // Create marksheet
            const marksheet = new Marksheet({
              studentId: student._id,
              studentDetails: {
                name: student.name,
                regNumber: student.regNumber,
                year: student.year,
                section: student.section,
                department: student.department,
                parentPhoneNumber: student.parentPhoneNumber,
                examinationName: student.examinationName,
                examinationDate: student.examinationDate
              },
              examinationName: student.examinationName,
              examinationDate: student.examinationDate,
              semester: session.semester,
              subjects: studentData.subjects,
              overallGrade,
              staffId: session.staffId,
              staffName: staff.name,
              staffSignature: staff.eSignature
            })

            await marksheet.save()
            createdMarksheets.push(marksheet)

          } catch (studentErr) {
            console.error(`Error processing student ${studentData.regNumber}:`, studentErr)
          }
        }

        // Update session status
        session.status = 'processed'
        await session.save()

        return res.status(200).json({ 
          success: true, 
          message: 'Import completed successfully',
          createdCount: createdMarksheets.length,
          marksheets: createdMarksheets
        })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'GET') {
      const { sessionId } = req.query

      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' })
      }

      const session = await ImportSession.findOne({ sessionId })
      if (!session) {
        return res.status(404).json({ success: false, error: 'Import session not found' })
      }

      return res.status(200).json({ success: true, session })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (err) {
    console.error('Import Excel API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
