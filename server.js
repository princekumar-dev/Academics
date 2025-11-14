import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToDatabase } from './lib/mongo.js';
import mongoose from 'mongoose';
import { startScheduledDispatchService } from './lib/scheduledDispatchService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Use environment PORT or default to 3001

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://academics-su1d.onrender.com',
  'https://academics-kxqc.onrender.com', // Old URL for backward compatibility
  // Add your Vercel domain here after deployment
  // 'https://your-app.vercel.app',
  // 'https://your-custom-domain.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      // Check if origin matches Vercel pattern (*.vercel.app)
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Lightweight timing middleware to log slow requests (helps diagnose slow deployed API)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Log only slower requests to avoid noise
    if (ms > 500) {
      console.warn(`Slow request: ${req.method} ${req.originalUrl} - ${ms}ms`);
    }
  });
  next();
});

// Health check
app.get('/', (req, res) => {
  res.send('Backend API Server is running!');
});

// API routes
import authHandler from './api/auth.js';
import usersHandler from './api/users.js';
import marksheetsHandler from './api/marksheets.js';
import importExcelHandler from './api/import-excel.js';
import whatsappDispatchHandler from './api/whatsapp-dispatch.js';
import generatePdfHandler from './api/generate-pdf.js';
import notificationsRouter from './api/notifications.js';
import examinationsHandler from './api/examinations.js';
import exportReportsHandler from './api/export-reports.js';
import scheduledDispatchHandler from './api/scheduled-dispatch.js';
import subscriptionCheckHandler from './api/subscription-check.js';

// Debug endpoint to verify server is updated
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'MSEC Academics Server is running!', 
    timestamp: new Date().toISOString(),
    academicsSystem: true,
    version: '2.0.0'
  });
});

// Health endpoint: quick DB connection state and server timestamp
app.get('/api/health', (req, res) => {
  const dbState = mongoose?.connection?.readyState ?? 0; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  res.json({ ok: true, timestamp: new Date().toISOString(), dbState });
});

// Twilio config test endpoint
app.get('/api/twilio-status', (req, res) => {
  const hasAccountSid = !!process.env.TWILIO_ACCOUNT_SID
  const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN
  const hasWhatsAppNumber = !!process.env.TWILIO_WHATSAPP_NUMBER
  const accountSidPreview = process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...' : 'Not set'
  
  res.json({
    configured: hasAccountSid && hasAuthToken && hasWhatsAppNumber,
    hasAccountSid,
    hasAuthToken,
    hasWhatsAppNumber,
    accountSidPreview,
    whatsAppNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'Not set'
  })
});

app.all('/api/auth', authHandler);
app.all('/api/users', usersHandler);
app.all('/api/marksheets', marksheetsHandler);
app.all('/api/import-excel', importExcelHandler);
app.all('/api/whatsapp-dispatch', whatsappDispatchHandler);
app.all('/api/generate-pdf', generatePdfHandler);
app.use('/api/notifications', notificationsRouter);
app.all('/api/examinations', examinationsHandler);
app.all('/api/export-reports', exportReportsHandler);
app.all('/api/scheduled-dispatch', scheduledDispatchHandler);
app.all('/api/subscription-check', subscriptionCheckHandler);

// Connect to MongoDB and start server
connectToDatabase()
  .then(() => {
    console.log(`📊 MongoDB connected successfully`);
    
    // Start scheduled dispatch service
    startScheduledDispatchService();
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.error('\n⚠️  TROUBLESHOOTING STEPS:');
    console.error('   1. Check your MongoDB Atlas IP whitelist settings');
    console.error('   2. Go to: https://cloud.mongodb.com/');
    console.error('   3. Navigate to: Network Access → IP Access List');
    console.error('   4. Add your current IP or use 0.0.0.0/0 for testing');
    console.error('   5. Verify your connection string in .env file');
    console.error('\n   Server will start anyway, but database operations will fail.\n');
  });

// Start server regardless of MongoDB connection
app.listen(PORT, () => {
  console.log(`🚀 MSEC Academics API Server listening on http://localhost:${PORT}`);
  console.log(`🎓 Academic management endpoints ready`);
  console.log(`📊 Marksheet generation enabled`);
  console.log(`📱 WhatsApp dispatch configured`);
  console.log(`⏰ Scheduled dispatch service enabled`);
});
