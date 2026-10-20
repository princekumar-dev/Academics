<div align="center">

<img src="public/images/mseclogo.png" alt="MSEC logo" width="120">

# MSEC Academics

### Marksheet & Academic Management System — import, approve, dispatch

**Excel marks in → signed PDFs and WhatsApp dispatch out, with a full approval pipeline**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwindcss&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Evolution API](https://img.shields.io/badge/WhatsApp-Evolution_API-25D366?logo=whatsapp&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Vitest-729B1B?logo=vitest&logoColor=white)

</div>

---

## 📖 Overview

**MSEC Academics** is the academic management platform for **Meenakshi Sundararajan Engineering
College (MSEC)**. It takes staff from raw Excel marks to dispatched marksheet PDFs in one audited
flow — **import → generate → verify → request → HOD approval → WhatsApp dispatch** — and adds
day-to-day academic operations on top: **leave management, staff approvals and a student
dashboard**.

Role-based access keeps every department isolated, WhatsApp delivery runs through
**Evolution API**, and push notifications keep parents and staff updated without email noise.

## ✨ Features

### 📝 Marksheets
- **Excel bulk import** (ExcelJS / xlsx) with import sessions and validation
- **Automated marksheet generation** — per-student records with subjects, grades and totals
- **PDF generation with digital signatures** (PDFKit) including staff, HOD and principal signatures
- **Status pipeline** — draft → verified → dispatch requested → approved/rejected → dispatched

### ✅ Approval Workflow
- Staff verify and request dispatch; **HOD approves, rejects or reschedules**
- Department-wide overview with approval statistics

### 📲 WhatsApp Dispatch via Evolution API
- Individual and **bulk dispatch** of marksheet notifications to parents
- Configurable instance (`EVOLUTION_INSTANCE_NAME`) with delivery-status tracking
- **Web push notifications** (VAPID + service worker) as a second channel

### 🏖️ Leave Management
- Students/staff raise leave requests; approvers review in **Leave Approvals**
- **Late acknowledgment** flow for backdated submissions

### 👥 Staff Approvals & Student Portal
- **Staff approval requests** workflow with its own audit model
- **Student dashboard** with results and records views

### 📊 Analytics & Reporting
- Home dashboard with live statistics, department overview, exportable reports
- Records history and searchable marksheet details

### 💅 UX
- Glass-morphism UI, skeleton loaders, toasts with undo, contextual help, empty states
- **PWA**: installable manifest + service worker, pull-to-refresh on mobile

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Lucide icons |
| Backend | Express server (`server.js`) + **Vercel serverless functions** (`api/`) |
| Database | MongoDB (Mongoose) — 6 models |
| Documents | PDFKit (marksheets), ExcelJS/xlsx (import), jszip, sharp, qrcode |
| Messaging | Evolution API (WhatsApp), Web Push (VAPID), node-cron scheduling |
| Quality | Vitest + Testing Library, ESLint, Prettier, vite-plugin-compression (brotli/gzip) |

## 🔌 API Surface (`api/`)

`auth` · `users` · `staff-approval` · `examinations` · `import-excel` · `marksheets` ·
`generate-pdf` · `whatsapp-dispatch` · `leaves` · `notifications` · `subscription-check` ·
`utils/resultUtils`

## 🗄️ Database Models (`models.js`)

`User` · `Student` · `Marksheet` · `ImportSession` · `LeaveRequest` · `StaffApprovalRequest`

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+**
- A **MongoDB** database (local or Atlas)

### Install

```bash
git clone https://github.com/princekumar-dev/Academics.git
cd Academics
npm install
```

### Environment

Create a `.env` (or `.env.local`) with at least:

```env
# Database (any of the three names is recognised)
MONGODB_URI=mongodb+srv://...

# Express
PORT=3001
PUBLIC_BASE_URL=http://localhost:3000

# WhatsApp — Evolution API
EVOLUTION_API_URL=https://your-evolution-instance.example.com
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE_NAME=msec_academics

# Web push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# PDF
PRINCIPAL_SIGNATURE_URL=...

# Student logins
DEFAULT_STUDENT_PASSWORD=...
```

### Run

```bash
npm run seed-users       # optional starter accounts
npm run dev:full         # Express API (:3001) + Vite dev server (:3000)

# or separately:
npm run server           # Express API
npm run dev              # Vite frontend
```

### Test

```bash
npm run test:run         # Vitest suite
npm run test:coverage
```

## ☁️ Deployment

- **Frontend + serverless API** — Vercel (`vercel.json`; the committed `dist/` build ships with
  pre-compressed **brotli/gzip** assets via `vite-plugin-compression`)
- **Express server** — Render (the CORS allow-list in `server.js` already includes the
  `academics-*.onrender.com` service URLs)
- One-off maintenance scripts live in [`scripts/`](scripts/) (index checks, dispatch resets,
  migrations, performance tests)

## 📁 Project Structure

```
Academics/
├── api/                    # Vercel serverless endpoints (auth, marksheets, dispatch, leaves…)
├── lib/                    # mongo.js, evolutionApiService.js, notifications, subscriptions
├── src/
│   ├── pages/              # Home, ImportMarks, Marksheets, DispatchRequests, ApprovalRequests,
│   │                       # Leave, LeaveApprovals, StudentDashboard, Reports, Records…
│   ├── components/         # Header, BottomNav, toasts, skeletons, settings…
│   └── hooks/              # usePushNotifications, usePullToRefresh
├── scripts/                # DB maintenance, dispatch tests, performance tests
├── public/                 # PWA manifest, service worker, icons
├── dist/                   # Production build (brotli/gzip pre-compressed)
├── models.js               # Mongoose schemas
├── server.js               # Express server (dev + Render)
└── seed-academic-users.js  # Starter accounts
```

## 📄 License

No license file has been declared yet — all rights reserved by the author unless stated otherwise.

## 👤 Author

**Prince Kumar** — [@princekumar-dev](https://github.com/princekumar-dev)

Built for the **MSEC** community — Chennai, Tamil Nadu, India.

---

<div align="center">
<sub><b>MSEC Academics</b> — from Excel to dispatched, signed, delivered.</sub>
</div>
