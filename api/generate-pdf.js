import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, User } from '../models.js'
import puppeteer from 'puppeteer'
import fs from 'fs'
import crypto from 'crypto'

// Reusable browser instance to speed up PDF generation
let browserInstance = null

// PDF cache to avoid regenerating identical PDFs
const pdfCache = new Map()
const CACHE_MAX_SIZE = 50
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Function to generate cache key
const getCacheKey = (marksheetId) => {
  return `pdf_${marksheetId}`
}

// Function to get or create browser instance
const getBrowser = async () => {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }
  
  const browserPath = findBrowserPath()
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                        process.env.CHROME_BIN || 
                        browserPath || 
                        puppeteer.executablePath()
  
  console.log('Launching browser:', executablePath)
  
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    executablePath,
  })
  
  return browserInstance
}

// Function to find available browser (Edge or Chrome) on Windows
const findBrowserPath = () => {
  const possiblePaths = [
    // Edge paths
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
    // Chrome paths
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    // Linux Chrome/Chromium paths
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ]
  
  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        return path
      }
    } catch (e) {
      continue
    }
  }
  
  console.log('No browser found in common locations')
  return null
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

// HTML template for marksheet
const generateMarksheetHTML = (marksheet, staffSignature, hodSignature, principalSignature) => {
  // Single column layout for subjects
  const subjectsHTML = []
  for (let i = 0; i < marksheet.subjects.length; i++) {
    const subject = marksheet.subjects[i]
    
    subjectsHTML.push(`
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${i + 1}</td>
        <td style="border: 1px solid #000; padding: 6px; font-size: 11px;">${subject.subjectName}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${subject.marks}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px;">${subject.grade}</td>
      </tr>
    `)
  }
  
  // Add empty rows to reach a minimum number of rows if needed
  const minRows = Math.max(10, marksheet.subjects.length)
  while (subjectsHTML.length < minRows) {
    subjectsHTML.push(`
      <tr>
        <td style="border: 1px solid #000; padding: 6px; height: 25px;"></td>
        <td style="border: 1px solid #000; padding: 6px;"></td>
        <td style="border: 1px solid #000; padding: 6px;"></td>
        <td style="border: 1px solid #000; padding: 6px;"></td>
      </tr>
    `)
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Marksheet - ${marksheet.studentDetails.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Arial', sans-serif; 
          line-height: 1.6; 
          color: #333;
          background: white;
        }
        .marksheet-container {
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 15mm;
          background: white;
          border: 2px solid #000;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        @page {
          size: A4;
          margin: 10mm;
        }

      </style>
    </head>
    <body>
      <div class="marksheet-container">
        <!-- Header -->
        <div class="header">
          <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <div class="logo" style="margin-right: 20px;">
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAMSElEQVR4nO2dCXRUVRqAv1dVSQhJSEISEkISlpCwJWwJ+xYIWxAQxAURF3aBUUdHx23Qmd7GbXT6jDMaHWfscRudGXucPi4oKtrkxJ0VcOFyOpBCIEASkhCSkISEJCQhq+Z/7w1NFokiJJCE5D3nnvfq3ffuvfe/7/737v/uewEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAYGbhbItPjuuaOJ66bw8PGmx0Gxz+kqBJE2KltZf/1L8THEJIOy/fBIS4/nFJNBaQ7hLhGdIb5dOudTuBmCXwG9pz2HKYNv+ikh0T2lHeL9TczV1+VbvCBCfu7VIEjFJmqZScrVe6WmnI+pD+1+w7GzIv2sCJPG/3QylcWyRJJIkOLLFFBeomd4keX8i0VgUiz4q+r4e7Pe0IyuN++ga0PsZzf5KJdhz7vOQs3y0QxqLJJGGwpt7kKylimkZjjx7ywJ5HojE4Fu6YIHGq/I6C0mmXNZOQznYP3z8f4a8F5psdWFhhCJs8x8/kARJWnafgywWWyCs2fe1KqFJu82qQCTL9T8VtBgBgF63NdSuGF7TkvCMYQ9AkqRlTnj7/7YpJMVJi8tgtO/7xhebP8MYtdpGCTb73x/1FejqgOjQK9Y7WgCSJC3OH/KyYRNC/aOLXJMngbRJHxU+/CHrt8Q5CWKn8vcKXQ1AdKDtu/7iJWnyBfu1pN8RSbplQ/bVyrtyG2WLam6R2vkmW7Z5k+x7gGjvz7Y7VxrJdF2RJE3L6EL7kfSH5TcgoFu6u/j9xTOl6erqPmWYBu0eID8xbf/8I8X9K6eBAA1Mdv6Bl0yfo6KL5Tex/mGEeUuKCFI9uf4wZBLBpkOVscnm7bdCidaJOknSNLnIfiT9asmNhWKjxeDJfD7+H9wthX9pP9vQtnhfx0gYRJ3SHJEkaXLhYHrpTKFYaDGCy7v2I0kSe1tKbSfNkxhU6Kn6DOvSBMZzAOgJmm6H9Hn6x4VvofXYY3O8qHc3JJP1c5I0H9nQb/JzzK8xJl5HeXZy1rTJ78lJJ582rZsFG7aHu3vWJW+F0Kzg01zm4n9+1a5PTcc6EC5fyNlOFPHX1k11EDnbs0v3tlYqsqKMsxZ9OmtjycZyrhO5I77kmQ3v7Z6fyOUj7QdPOijATm6wKHBQGg5gTWKBIzhJ0tI+YpcvVmrNZrJJJcn6ceTMMB0ciMW4z8UsOcB1q/YKjG6I7v7y9CMmY7mEOghmooChAfiv9mVnk5Ika3vE5T3Ura29vaOtyv3PwU9X7BVKOs3n8plcs/WONpvo/hfBhh8vxIDrp0/d7ic0fR42QZVhBdHBtu/acAKEZy9tV4Z0EpqvWTPiwxtEKe6lvdya8PkI1SVT8cNlm5fO7t77alNB7vEK8Eqf3I7lYmqyj/VNlnr2qGvPvLyrcrsL4D/p8i48n37M5AAAkGWp8HYfEPJlNfO3znmkQ2jzD45w7nphC9QH30kxOGgNaXLJ9oVFh53iHMBrMDwYhIpA9a9T8dMXRO/8oOIF3p/pz/CvkCRp6d8/7vut7YOJLVsWilFrM+b3aNUfvaUtzF8luNl3mj6DgHDbuBjzjOmhJvvZOo5NDqV8SbM2d5X6pM/H+HpaQ9CqPzpJe+/WuX+yeXvXcL/RnQTaKtKKO7qjj/rJAhKV+0t6PYo3aAb9Gxhq8498vWl5VtJGdZgip10H/7Gmck/6UMnd2o+XVaJPeS6X51fgafAroPP/unrSI7J3VAH5oGCQ6P4Xw18khVkXUke2d23mfodNfm+jdPf6ju4EOf60n2WeBS/D5CPs9K1VFeibwwwDpEfEI9Ka06lr9gqiNzA3L4/tszIPH3D4sAEtzW8acQHspEUCsL5hdEpYjq5x9YvYOTzrOWhfAPJNiMxrkz80zGNsjmQZyXR9UdPfaOz3sq6VJOlY35jXvNCqbBt8+lJ9Q2Dk5KNeKfTuXnDa9Bm4e0uXSevf9QnRwWapEbbJauefNWDKZnM72IwJyXFHNJNxHTkoTWaa4e8bKvf3I6TlyGWwrNZqO5Vj/q4Yu9pYgkdz6T3AmLBYFgoGwW+ZFhzqBgXEZZa3Px0Xdx6sq6YCYf3xKtKENU8oP7TSM9uNIpJxnnqPSekwiEWqHvh4qxHxhMs/NB8moWiRg5J33V2emAdIoOHNV8IGcsctajpMdNcR+XjWsKKN5toqBskzsYYVbzRnylohbIjNKD7+3QbPFAxCUOaLoQPsZq1+K3QNvfcnhA7Ms5k/69L9slEE1hMh7adY9xCRbTdFzYVqhCRYsiTtOijlVLo63z2KWA8v9lb4xI0kb3v9IQg6/WLYA5YppxHfLNb5sQmJTCJUi1CGwYAYvPm5n1IWWewwQKaOWKxNJI2JEuSz4kM04+Tk1cy1sZb1q8JN7efe+0P/d0v6bNvwo8YyUwLrioNjxOemJqNnbu4IJ4HUU0zVFuKhlyNrKb5s2mvx38KeiH6cN8T5oksyzCQKrHdpzpOacyZNKJNmvhL66id9r/nscnO4NwywU79GdkT9vdmBxxZPPumdfkw/oNxfm+bRpZRj+sbfjaGHn1593PhutNKpxD5v9UKrJWvf7H+85pU+46xhuyEiN3fkjIjWwr3LB8IkEjBpAvKOJPV0H6WfX8wce3CG5M4Yx85nywQovwtyJz5M+5V4bghlyiNeh0uKMl+4dcHs7VCLfqUghn0E+w6t/vfXZ6Ql2rLINh/LLhPHzP1o4ZDskjB3BN8XL6FnXJq20SDfRheCpYJboJm/dm6UXzjKViP9IE2nddJbu8APCxK7j1K9dG1vLNp4qQ/fH2WZqgkXFHMfqZ++RRyxchFRCddJDzabr3GpvpJWgtrfbqrGUarqJKUU82fQ/KO9l89pW3VmsqzoLHsRhl2Oa1O33PjFgRuMnuvnoLSsX+OU2LV3vqKtNFdMhOxaICPfeYzNkJeZWq1RZNniywCWyxcy/7PWal9Tv+BKT9dDKtgHGNS3xHhp6eY28yEajBW6rJNYYTvC25ofqHlCKqfNhwkqWk8OvdRn8oxVoXafpIJD4Nq1fe3eEOvpusZYUKUfkqT5mDfe5H7F8DkEZRuXpLS5N6e2xJvQKW5ImbWSqNBmC28FhCRt62+5AMN9IOj0kzS/TgshqQKpLli6YuCBuglfNL7gXKGixxP/DJZzSV4k7WU1s7YhvlS+dp2c7mDSJJI6xW+ZKxaBG2iAEy3TvbWrj7FKPa6dTCZJBSX7Y1JqppVlnNzYOFM6/m4ISTqyYIAz6F8J41X+6exjPZ8BNfjWJEBSNEqW2olh8VpXJqYaFxKdmIj89tNmnTJmurXv8SdVIaIHgmt2c1hZF+nwSkj0rpBcG8nSJKgHMhbfK9x0ic7fK7MniZZLz9AqOCHGGhhB0TuzVWoOAnMofWmFbPjKyWQbUDtLWCFOhLTr84w3d6UTJPkwe/V9gtEHoHafEE15/KU6YdgPLCPOSDvj0YJR7WN7vbn8wuq9gKSrJmMG3U+hzTA4HNKFiJ4Bw03OyqoJdNnFeSJn97fKrp/Cc9vqHUurB1bH6o50BRLZsFf1CP27FkmyhfL0m9NkJldt1YqrjXdXt5flSoykzP88dprkNn8pZv8eFyqf+uorOGJTr3u+WpL4q0E+7YdJ72XOQI2r9CcGSMaOhwnKaj6SmOKnYHhs2uDukCRNOze3jQq0e1usvo0EzL/HMwP9BMyf21W6NhwWRBD/6T+30gXKhMUAgd8FpDfGOKFhGuh4QJKlt41w3llh1EPS6D1ZvuZd5lxACLZt+B5vlSTNF2Es/3yJMQ1sPG8kFT45NV4oYreKP8TieFKJVcU/7weRfPx7HFeQJHoNHGOfxbLAzl+7AAm6DNKMv2n95azOqg8Q1sif/xfKtsUj8zO9gFg0Qn5LKDoqvNcH+PT9XQf69eKrzJiCyAdJvr76awJwdJlmJ7tj/e8vNv/x2Qz/xQV+OSiLvInub4tCJ9G9l+lI/pNT3zdKOCQAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBgVvN/wCJePGym9OT7AAAAABJRU5ErkJggg==" width="60" height="60" alt="College Logo" style="display: block;">
            </div>
            <div style="text-align: center;">
              <div style="font-size: 18px; font-weight: bold; color: #000; margin-bottom: 2px;">
                MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE
              </div>
              <div style="font-size: 12px; color: #333; margin-bottom: 2px;">
                (AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY.)
              </div>
              <div style="font-size: 11px; color: #333; margin-bottom: 8px;">
                363, ARCOT ROAD, KODAMBAKKAM, CHENNAI-600024
              </div>
              <div style="font-size: 14px; font-weight: bold; color: #000; border: 1px solid #000; padding: 4px 8px; display: inline-block;">
                OFFICE OF THE CONTROLLER OF EXAMINATIONS
              </div>
              <div style="font-size: 12px; font-weight: bold; color: #000; margin-top: 5px; text-transform: uppercase;">
                ${marksheet.examinationName || 'END SEMESTER EXAMINATIONS'} - ${new Date(marksheet.examinationDate).toLocaleString('default', { month: 'long' }).toUpperCase()} - ${new Date(marksheet.examinationDate).getFullYear()}
              </div>
            </div>
          </div>
        </div>

        <!-- Student Information -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background: #f0f0f0; width: 120px;">Register Number</td>
            <td style="border: 1px solid #000; padding: 6px; width: 200px;">${marksheet.studentDetails.regNumber}</td>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background: #f0f0f0; width: 100px;">Year/Semester</td>
            <td style="border: 1px solid #000; padding: 6px;">${marksheet.studentDetails.year}${marksheet.semester ? `/${marksheet.semester}` : ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background: #f0f0f0;">Student's Name</td>
            <td style="border: 1px solid #000; padding: 6px;" colspan="3">${marksheet.studentDetails.name}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background: #f0f0f0;">Degree & Branch</td>
            <td style="border: 1px solid #000; padding: 6px;" colspan="3">B.Tech ${expandDepartmentName(marksheet.studentDetails.department)}</td>
          </tr>
        </table>

        <!-- Marks Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background: #f0f0f0; width: 60px;">S.No</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: left; background: #f0f0f0;">Course</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background: #f0f0f0; width: 80px;">Mark</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; background: #f0f0f0; width: 80px;">Grade</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsHTML}
          </tbody>
        </table>

        <!-- Signatures -->
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr>
            <td style="border: 1px solid #000; padding: 40px 8px 8px 8px; text-align: center; width: 33.33%;">
            <td style="border: 1px solid #000; padding: 40px 8px 8px 8px; text-align: center; width: 33.33%;">
              ${staffSignature ? `<img src="${staffSignature}" alt="Staff Signature" style="height: 30px; margin-bottom: 5px;">` : ''}
              <div style="border-top: 1px solid #666; margin-top: 30px; padding-top: 5px;">
                <strong>Signature of the Staff</strong>
              </div>
            </td>
            <td style="border: 1px solid #000; padding: 40px 8px 8px 8px; text-align: center; width: 33.33%;">
              ${hodSignature ? `<img src="${hodSignature}" alt="HOD Signature" style="height: 30px; margin-bottom: 5px;">` : ''}
              <div style="border-top: 1px solid #666; margin-top: 30px; padding-top: 5px;">
                <strong>Signature of the Class Teacher</strong>
              </div>
            </td>
            <td style="border: 1px solid #000; padding: 40px 8px 8px 8px; text-align: center; width: 33.33%;">
              ${principalSignature ? `<img src="${principalSignature}" alt="Principal Signature" style="height: 30px; margin-bottom: 5px;">` : ''}
              <div style="border-top: 1px solid #666; margin-top: 30px; padding-top: 5px;">
                <strong>Signature of the HOD<br/>Date :</strong>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `
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

      // Get staff signature
      const staffData = marksheet.staffId
      const staffSignature = staffData?.eSignature || null

      // Get HOD signature
      const hodData = marksheet.hodId
      const hodSignature = hodData?.eSignature || null

      // Get principal signature (you might want to store this in database)
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null

      // Generate HTML
      const html = generateMarksheetHTML(marksheet, staffSignature, hodSignature, principalSignature)

      // Generate PDF using Puppeteer (reuse browser instance)
      let browser = null
      let page = null
      try {
        browser = await getBrowser()
        page = await browser.newPage()
        
        // Disable unnecessary features for faster rendering
        await page.setJavaScriptEnabled(false)
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 5000 })

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px',
          },
          preferCSSPageSize: false,
        })

        await page.close()

        // Cache the PDF
        if (pdfCache.size >= CACHE_MAX_SIZE) {
          // Remove oldest entry
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

        // Send PDF
        return res.status(200).send(pdfBuffer)

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        if (page) {
          await page.close().catch(() => {})
        }
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate PDF',
          details: pdfError.message
        })
      }
    }

    if (req.method === 'POST') {
      // Generate PDF and return base64 or URL for WhatsApp
      const { marksheetId, returnType = 'base64' } = req.body

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const marksheet = await Marksheet.findById(marksheetId).populate('hodId')
      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      const hodData = marksheet.hodId
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null
      const html = generateMarksheetHTML(marksheet, hodData, principalSignature)

      let browser = null
      let page = null
      try {
        browser = await getBrowser()
        page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'domcontentloaded' })

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        })

        await page.close()

        if (returnType === 'base64') {
          const base64Pdf = pdfBuffer.toString('base64')
          return res.status(200).json({ 
            success: true, 
            pdfBase64: base64Pdf,
            filename: `marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf`
          })
        } else {
          // For direct URL access, you might want to store the PDF temporarily
          // and return a URL to it
          return res.status(200).json({ 
            success: true, 
            message: 'Use GET method to download PDF directly' 
          })
        }

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        if (page) {
          await page.close().catch(() => {})
        }
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
