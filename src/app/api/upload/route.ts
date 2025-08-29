import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI client is available
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 512MB for OpenAI)
    const maxSize = 512 * 1024 * 1024 // 512MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 512MB limit' },
        { status: 400 }
      )
    }

    // Validate file type (OpenAI supports various formats)
    const allowedTypes = [
      'text/plain',
      'application/json',
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/markdown'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not supported. Supported types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      // Upload file to OpenAI Files API
      const openaiFile = await openai.files.create({
        file: file,
        purpose: 'assistants'
      })

      // Connect to MongoDB and save file information
      const client = await clientPromise
      const db = client.db('nextjs_app')
      const collection = db.collection('uploaded_files')

      // Save file metadata to MongoDB
      const fileRecord = {
        openai_file_id: openaiFile.id,
        filename: openaiFile.filename,
        original_filename: file.name,
        file_size: file.size,
        file_type: file.type,
        purpose: openaiFile.purpose,
        status: openaiFile.status,
        created_at: new Date(openaiFile.created_at * 1000), // Convert Unix timestamp
        uploaded_at: new Date(),
        bytes: openaiFile.bytes
      }

      const result = await collection.insertOne(fileRecord)

      return NextResponse.json({
        message: 'File uploaded successfully',
        file_id: openaiFile.id,
        filename: openaiFile.filename,
        mongo_id: result.insertedId,
        status: openaiFile.status,
        bytes: openaiFile.bytes
      }, { status: 201 })

    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError)
      
      // Handle specific OpenAI errors
      if (openaiError?.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
      
      if (openaiError?.status === 413) {
        return NextResponse.json(
          { error: 'File too large for OpenAI API' },
          { status: 413 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to upload file to OpenAI' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve uploaded files
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('nextjs_app')
    const collection = db.collection('uploaded_files')

    const files = await collection
      .find({})
      .sort({ uploaded_at: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json({
      files: files.map(file => ({
        id: file._id,
        openai_file_id: file.openai_file_id,
        filename: file.filename,
        original_filename: file.original_filename,
        file_size: file.file_size,
        file_type: file.file_type,
        status: file.status,
        uploaded_at: file.uploaded_at,
        bytes: file.bytes
      }))
    })

  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}
