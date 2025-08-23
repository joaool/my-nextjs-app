import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const { username, subject, question } = await request.json()

    // Validate required fields
    if (!subject || !question) {
      return NextResponse.json(
        { error: 'All fields (subject, question) are required' },
        { status: 400 }
      )
    }

    // Generate today's date
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db('nextjs_app')
    const collection = db.collection('contacts')

    // Insert the document
    const result = await collection.insertOne({
      username: username || null,
      subject,
      question,
      date: today,
      createdAt: new Date(),
    })

    return NextResponse.json(
      { message: 'Contact information saved successfully', id: result.insertedId },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error saving contact information:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
