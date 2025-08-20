# Contact Form Setup Instructions

## Quick Setup Guide

### 1. Install Dependencies
```bash
npm install mongodb mongoose
```

### 2. Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   ```

2. Edit `.env.local` and add your MongoDB connection string:
   ```
   MONGODB_URI=your_mongodb_connection_string_here
   ```

### 3. MongoDB Options

#### Option A: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Get your connection string
4. Replace `username`, `password`, and `cluster` in the connection string

#### Option B: Local MongoDB
1. Install MongoDB locally
2. Use: `MONGODB_URI=mongodb://localhost:27017/nextjs_app`

### 4. Test the Application
```bash
npm run dev
```

Navigate to `http://localhost:3000/contact` to test the form.

## Features
- ✅ Contact form with subject, question, and date fields
- ✅ Form validation and error handling
- ✅ MongoDB integration
- ✅ Responsive design
- ✅ Success/error feedback

## Database Schema
Data is stored in the `contacts` collection with:
- `subject` (string)
- `question` (string)
- `date` (string)
- `createdAt` (timestamp)
