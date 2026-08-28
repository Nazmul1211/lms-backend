# LMS Backend (Strapi)

Learning Management System (LMS) backend built with **Strapi (Node.js)** for the Junior Software Engineer Project Round.

## 🧱 Tech Stack
- **Framework:** Strapi (Headless CMS / Node.js)
- **Database:** SQLite (Local Development) / PostgreSQL (Production)
- **Deployment:** Railway

## 👥 User Roles & Permissions
1. **Admin:** Full control of the platform, user & role management, platform analytics, global content management.
2. **Content Manager:** Global course, lesson, quiz, and blog management (cannot manage users).
3. **Instructor:** Create & manage own courses, lessons, quizzes, and view enrolled student progress.
4. **Student:** Enroll in courses, sequential lesson viewing, complete lesson progress tracking, and auto-graded quizzes.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js >= 18.0.0 <= 22.x.x
- npm / yarn / pnpm

### Installation & Run
```bash
# Install dependencies
npm install

# Start in development mode (with auto-reload)
npm run develop
```

Admin dashboard will be available at: `http://localhost:1337/admin`  
API root endpoint: `http://localhost:1337/api`

---

## 📋 Completed Features
- [x] Initial Project Setup & Gitignore Configuration
- [ ] Role-Based Access Control (Admin, Content Manager, Instructor, Student)
- [ ] Course & Lesson Management API
- [ ] Course Enrollment API
- [ ] Lesson Progress Tracking & Percentage Calculation Engine
- [ ] Quiz Engine with Secure Server-Side Auto-Grading
- [ ] Blog API with Draft vs. Published State Filtering
- [ ] Admin Stats & User Role Management API
- [ ] Railway Production Deployment Configuration
# lms-backend
