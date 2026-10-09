# DevOps Implementation & Readiness Portal

[![Live Portal](https://img.shields.io/badge/AWS%20S3-Live%20Portal-orange?style=for-the-badge&logo=amazons3)](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com)
[![Tests](https://img.shields.io/badge/Tests-887%20Passed-brightgreen?style=for-the-badge&logo=vitest)](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript)](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com)
[![Cognito](https://img.shields.io/badge/AWS%20Cognito-Auth%20%26%20RBAC-red?style=for-the-badge&logo=amazoncognito)](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com)

> An enterprise/government-grade DevOps Implementation & Readiness Portal designed to render a complete DevOps adoption roadmap, operational checklist, and implementation tracker into a navigable, trackable, and verifiable operational system.

---

## 🌐 Live Deployment

- **Production Portal URL:** [http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com)
- **Central Cloud Store Endpoint:** [http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com/data/portal-state.json](http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com/data/portal-state.json)

---

## 🚀 Key Capabilities & Features

### 1. Role-Based Access Control (AWS Cognito)
- **Self-Learners / Guests:** Can browse the complete guide corpus, check off personal progress, and write local notes without needing an account.
- **Verified Team Members:** Managed user accounts created by administrators. Can acknowledge completed checklist items, update tracker row statuses, and attach implementation notes.
- **Administrators:** Full CRUD permissions across all sections:
  - Add, edit, delete, and restore Guide practices.
  - Add, edit, delete, and restore Implementation Order checklist items.
  - Add, edit, delete, and restore Production Readiness criteria.
  - Manage Implementation Tracker rows (all 11 columns, including verification gates and deadlines).
  - Admin Verification Dashboard: review completed user acknowledgements, approve verifications, and sign off items.
  - Cognito User Management: create user accounts, reset passwords, update roles, and manage credentials.

### 2. Central Cloud Store Service (AWS S3)
- Shared state repository hosted at `/data/portal-state.json`.
- **Auto-Hydration on Page Load:** Every user and visitor automatically synchronizes with the central cloud store when opening the portal.
- **1-Click Publish & Sync:** Administrators can publish state updates directly to the S3 bucket from the UI or via CLI (`npm run sync-cloud`).

### 3. Comprehensive Portal Navigation

| Route | View | Description |
|---|---|---|
| `/` | **Overview** | DevOps objectives, core operating principles, and section index |
| `/guide/:category` | **Guide Categories** | 6 deep-dive categories with practices, rationale, tools, and cross-linked tracker metadata |
| `/checklist/implementation-order` | **Implementation Order** | 4 adoption phases with interactive progress indicators |
| `/checklist/production-readiness` | **Readiness Gate** | 16-point production readiness criteria gate |
| `/notes` | **Notes & Decisions** | Shared notes, open issues, and useful reference links |
| `/tracker` | **Implementation Tracker** | Full 24-row, 11-column table with multi-criteria filtering and sorting |
| `/admin` | **Admin Dashboard** | Sign-off verification panel, metrics, and Cognito user management |

### 4. Enterprise Tools & Usability
- **Global Instant Search (`Ctrl` / `Cmd` + `K`):** Full-text fuzzy search across all practices, checklist items, and tracker rows.
- **State Export & Import:** Export state as versioned JSON or download tracker as spreadsheet-ready CSV.
- **Theme Support:** High-contrast light and dark modes with persistent user preference.
- **Accessibility:** Zero automated axe-core violations across all 11 routes and interactive modal states.

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
- Node.js 20+
- npm 10+
- AWS CLI configured (for cloud sync and S3 deployments)

### Installation

```bash
# Clone the repository
git clone https://github.com/Binod231/DevOps-Guide-Checklist.git
cd DevOps-Guide-Checklist

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run local development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts Vite development server at `localhost:5173` |
| `npm run build` | Validates TypeScript and generates production bundle in `dist/` |
| `npm run test` | Runs the full Vitest test suite (887 tests, 31 test files) |
| `npm run typecheck` | Strict TypeScript type checking without emitting files |
| `npm run sync-cloud` | Pushes central state `/data/portal-state.json` to AWS S3 |
| `npm run deploy` | Builds the production bundle and deploys to AWS S3 website bucket |

---

## 🔐 Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# AWS Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCOUNT_ID=your-aws-account-id

# AWS Cognito Authentication
VITE_COGNITO_USER_POOL_ID=your-cognito-user-pool-id
VITE_COGNITO_CLIENT_ID=your-cognito-app-client-id

# Admin Credentials (Default / Local Fallback)
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=your-secure-admin-password

# AWS S3 Hosting & Storage
VITE_S3_BUCKET_NAME=devops-guide-portal-848175179383
VITE_S3_WEBSITE_URL=http://devops-guide-portal-848175179383.s3-website-us-east-1.amazonaws.com
```

---

## 🏗️ Architecture & Technology Stack

- **Frontend Core:** React 18, TypeScript, Vite 8
- **Styling:** Tailwind CSS 4, CSS Design Tokens
- **Routing:** React Router 7
- **Authentication:** AWS Cognito User Pools with local secure fallback
- **State Management & Persistence:** Context API + LocalStorage + AWS S3 Cloud Store
- **Testing:** Vitest, React Testing Library, jsdom, axe-core
- **Hosting:** AWS S3 Website Hosting

---

## 🛡️ Security & Privacy
- Sensitive credentials and keys are strictly managed via environment variables and `.gitignore`.
- Root administrator passwords are encrypted/masked and never exposed in the UI.
- Pre-built content JSON models live under `src/content/generated/` and are tracked directly in source control for reliable, standalone builds without external dependencies.
