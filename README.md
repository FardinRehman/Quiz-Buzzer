# QuickBuzz — Real-Time Fastest Finger First Platform

QuickBuzz is a high-performance, real-time Fastest Finger First buzzer platform engineered for classroom quizzes, college tech fests, inter-university competitions, and live trivia shows.

It features an **authoritative atomic compare-and-set buzzer engine** that strictly serializes concurrent millisecond-level requests, guaranteeing that exactly one contestant is accepted as the winner while all subsequent clicks are locked out and logged with precise latency measurements.

---

## Key Highlights

- **Atomic First-Come-First-Served Engine**: Sub-millisecond server race resolution preventing duplicate winners or race condition overwrites.
- **Zero-Latency Real-Time Push**: Real-time synchronization via Server-Sent Events (SSE) and Firebase Realtime Database.
- **Role-Based Security**: Authoritative single Quizmaster Admin and isolated Student accounts with active/disabled statuses.
- **Projector Mode**: High-contrast, giant-typography audience view for classroom and hall projectors.
- **Tactile Visual & Audio States**: 6 distinct buzzer states (Waiting, Ready, Won, Too Late, Closed, Offline) with zero-dependency Web Audio synthesizers and victory confetti.
- **Student Roster & CSV Import/Export**: Bulk student onboarding and comprehensive round-by-round CSV results export.
- **Production Firebase Artifacts**: Complete `database.rules.json`, `firebase.json`, Cloud Functions (`functions/src/index.ts`), and automated concurrency test suite.

---

## Contestant Quick Join & Admin Credentials

### Contestants (Students):
- **No registration or password required!**
- Contestants simply type their **Name** and the **Session PIN** (e.g. `BUZZ99`) into the main screen to enter the arena and buzz immediately.
- Optional Student ID / USN field is supported for academic scorekeeping.

### Quizmaster Admin:
- **Email**: `fardinrit@gmail.com`
- **Password**: `Fardin@RIT07`
- Click the discreet **Host Portal** link at the very bottom of the page to access the Quizmaster Control Center.

*Default Active Quiz PIN*: `BUZZ99`

---

## 1. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **Firebase CLI** (optional for cloud deployment): `npm install -g firebase-tools`

---

## 2. Quick Local Start (Zero External Configuration Required)

QuickBuzz includes a standalone authoritative real-time server with atomic concurrency locks and file persistence out of the box.

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack dev server
npm run dev
```

Open your browser to: `http://localhost:3000`

---

## 3. Running Automated Concurrency Tests

QuickBuzz includes an automated concurrency test suite that creates 20 simultaneous student accounts and fires 20 simultaneous buzz requests at the exact same millisecond:

```bash
# In a separate terminal while server is running:
npm run test
```

Expected output:
```text
  Firing 20 simultaneous POST requests with Promise.all()...
  Accepted winners: 1
  Rejected (too late): 19
  ✔ ATOMIC RACE GUARANTEE PASSED!
  🎉 ALL 8 AUTOMATED TESTS PASSED WITH 100% SUCCESS!
```

---

## 4. Production Firebase Setup & Deployment Guide

To deploy QuickBuzz to your own Google Cloud & Firebase project:

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g., `quickbuzz-production`).
3. (Optional) Disable Google Analytics for minimal setup.

### Step 2: Enable Firebase Authentication
1. In the left navigation, click **Authentication** -> **Get Started**.
2. Under the **Sign-in method** tab, enable **Email/Password**.

### Step 3: Create Realtime Database
1. In the left navigation, click **Realtime Database** -> **Create Database**.
2. Select your preferred geographic region (e.g., `us-central1`).
3. Choose **Start in locked mode**.

### Step 4: Configure Cloud Functions
1. Upgrade your Firebase project to the **Blaze (Pay as you go)** plan (required for Cloud Functions).
2. Install Cloud Functions dependencies:
   ```bash
   cd functions
   npm install
   cd ..
   ```

### Step 5: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your public Firebase web configuration values in `.env` (these are safe to expose in frontend code):
```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="quickbuzz-production.firebaseapp.com"
VITE_FIREBASE_DATABASE_URL="https://quickbuzz-production-default-rtdb.firebaseio.com"
VITE_FIREBASE_PROJECT_ID="quickbuzz-production"
VITE_FIREBASE_STORAGE_BUCKET="quickbuzz-production.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
```

### Step 6: Deploy Database Security Rules
Deploy `database.rules.json` using Firebase CLI:
```bash
firebase deploy --only database
```

### Step 7: Deploy Cloud Functions
```bash
firebase deploy --only functions
```

### Step 8: Build and Deploy Frontend to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

---

## 5. Firebase Security Architecture

- **`database.rules.json`**:
  - `auth != null` is enforced on all quiz nodes.
  - Winner fields (`winnerUid`, `winnerStudentId`, `winnerNameSnapshot`, `winnerAcceptedAt`) are strictly write-protected from client writes.
  - Students cannot elevate their own permissions or alter account statuses.
  - Student write attempts are mediated through trusted server functions.
- **Cloud Functions (`functions/src/index.ts`)**:
  - Executes `roundRef.transaction()` atomic compare-and-set operations.
  - Checks ID token validity and confirms active student role.
  - Rejects attempts if the round is closed or if `winnerUid` is already populated.
- **Admin Isolation**:
  - The single authorized admin account is sealed with server-controlled role checks.

---

## 6. Live Deployment: Vercel (Frontend) + Render (Backend)

Because QuickBuzz relies on long-lived Server-Sent Events (SSE) and in-memory atomic locks for millisecond race resolution, the recommended production setup separates the stateless frontend (on Vercel's global CDN) and the stateful real-time backend (on Render/Railway/Fly.io):

### Step 1: Deploy Backend to Render (Free)
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and click **New +** -> **Web Service**.
3. Select your GitHub repository.
4. Render will automatically detect [`render.yaml`](file:///c:/Users/fardi/Desktop/quickbuzz---real-time-fastest-finger-first-platform/render.yaml) or you can configure:
   - **Environment**: Node
   - **Build Command**: `npm install --legacy-peer-deps && npm run build`
   - **Start Command**: `npm start`
5. Once deployed, copy your Render service URL (e.g. `https://quickbuzz-backend.onrender.com`).

### Step 2: Deploy Frontend to Vercel
1. Sign in to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. Vercel will automatically detect Vite and [`vercel.json`](file:///c:/Users/fardi/Desktop/quickbuzz---real-time-fastest-finger-first-platform/vercel.json).
4. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://your-render-service.onrender.com` (your backend URL from Step 1)
5. Click **Deploy**!

---

## 7. Testing Multiple Devices Simultaneously

To test QuickBuzz with real phones and laptops in the same room or WiFi:
1. Find your computer's local IP address (`ipconfig` or `ifconfig`), e.g., `192.168.1.45`.
2. Open `http://192.168.1.45:3000` on your phone browser.
3. Enter your Name and Session PIN (e.g. `BUZZ99`) to join as a contestant.
4. On your laptop, log in as **Quizmaster Admin** (`fardinrit@gmail.com` / `Fardin@RIT07`).
5. Open a round from the laptop host dashboard, and watch the phone buzzer unlock and activate instantly!
