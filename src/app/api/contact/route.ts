import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

// Assistant ID - will be created if doesn't exist
let assistantId: string | null = null

export async function POST(request: NextRequest) {
  try {
    const { username, question } = await request.json()

    // Validate required fields
    if (!question) {
      return NextResponse.json(
        { error: 'Question field is required' },
        { status: 400 }
      )
    }

    // Generate answer using OpenAI Assistants API with file_search
    let answer = ''
    let citations: any[] = []
    
    try {
      if (!openai) {
        throw new Error('OpenAI client not initialized')
      }

      // Get all uploaded file IDs from MongoDB
      const client = await clientPromise
      const db = client.db('nextjs_app')
      const filesCollection = db.collection('uploaded_files')
      
      const uploadedFiles = await filesCollection
        .find({})
        .toArray()
      
      const fileIds = uploadedFiles.map(file => file.openai_file_id)
      
      console.log('Found uploaded files:', uploadedFiles.length)
      console.log('File IDs:', fileIds)

      // Get or create assistant with file_search enabled
      const assistant = await getOrCreateAssistant()

      // Create a thread with file attachments
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: question,
            attachments: fileIds.length > 0 ? fileIds.map(fileId => ({
              file_id: fileId,
              tools: [{ type: 'file_search' }]
            })) : []
          }
        ]
      })

      // Create a streaming response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Start the assistant run with streaming
            const run = await openai.beta.threads.runs.create(thread.id, {
              assistant_id: assistant.id,
              stream: true
            })

            let fullAnswer = ''
            let streamCitations: any[] = []

            // Handle the streaming events
            for await (const event of run) {
              if (event.event === 'thread.message.delta') {
                const delta = event.data.delta
                if (delta.content && delta.content[0] && delta.content[0].type === 'text') {
                  const textDelta = delta.content[0].text?.value || ''
                  fullAnswer += textDelta
                  
                  // Send the delta to the client
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'delta', 
                    content: textDelta 
                  })}\n\n`))
                }
              } else if (event.event === 'thread.message.completed') {
                // Extract final citations
                const message = event.data
                if (message.content[0] && message.content[0].type === 'text') {
                  const textContent = message.content[0].text
                  if (textContent.annotations) {
                    streamCitations = textContent.annotations.map((annotation: any) => ({
                      type: annotation.type,
                      text: annotation.text,
                      file_citation: annotation.file_citation
                    }))
                  }
                }
              } else if (event.event === 'thread.run.completed') {
                // Send final message with citations
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'complete', 
                  citations: streamCitations 
                })}\n\n`))
                
                // Store in database asynchronously
                try {
                  const today = new Date().toISOString().split('T')[0]
                  const client = await clientPromise
                  const db = client.db('nextjs_app')
                  const collection = db.collection('contacts')
                  
                  await collection.insertOne({
                    username: username || null,
                    question,
                    answer: fullAnswer,
                    citations: streamCitations,
                    date: today,
                    createdAt: new Date(),
                  })
                } catch (dbError) {
                  console.error('Database error:', dbError)
                }
                
                break
              } else if (event.event === 'thread.run.failed') {
                throw new Error('Assistant run failed')
              }
            }
          } catch (streamError) {
            console.error('Streaming error:', streamError)
            // Send fallback answer
            const fallbackAnswer = generateFallbackAnswer(question)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'fallback', 
              content: fallbackAnswer 
            })}\n\n`))
            
            // Store fallback in database asynchronously
            try {
              const today = new Date().toISOString().split('T')[0]
              const client = await clientPromise
              const db = client.db('nextjs_app')
              const collection = db.collection('contacts')
              
              await collection.insertOne({
                username: username || null,
                question,
                answer: fallbackAnswer,
                citations: [],
                date: today,
                createdAt: new Date(),
              })
            } catch (dbError) {
              console.error('Database error:', dbError)
            }
          }
          
          controller.close()
        }
      })

      // Return streaming response
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
      
    } catch (openaiError: any) {
      console.error('OpenAI API error details:', {
        message: openaiError?.message,
        status: openaiError?.status,
        code: openaiError?.code,
        type: openaiError?.type,
        apiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
        fullError: openaiError
      })
      
      // Return fallback response for OpenAI errors
      const fallbackAnswer = generateFallbackAnswer(question)
      
      // Store fallback in database
      try {
        const today = new Date().toISOString().split('T')[0]
        const client = await clientPromise
        const db = client.db('nextjs_app')
        const collection = db.collection('contacts')
        
        await collection.insertOne({
          username: username || null,
          question,
          answer: fallbackAnswer,
          citations: [],
          date: today,
          createdAt: new Date(),
        })
      } catch (dbError) {
        console.error('Database error:', dbError)
      }
      
      return NextResponse.json(
        { message: 'Contact information saved successfully', answer: fallbackAnswer, citations: [] },
        { status: 201 }
      )
    }

    // Helper function to get or create assistant
    async function getOrCreateAssistant() {
      if (assistantId && openai) {
        try {
          return await openai.beta.assistants.retrieve(assistantId)
        } catch (error) {
          // Assistant doesn't exist, create new one
          assistantId = null
        }
      }

      if (!assistantId && openai) {
        const assistant = await openai.beta.assistants.create({
          name: 'FrameLink Support Assistant',
          instructions: 'You are a helpful assistant for FrameLink Support. When users attach files, search through them to find the most relevant information. Focus on providing concise, accurate answers with citations to the most important source content. Prioritize quality over quantity in your responses.',
          model: 'gpt-4o-mini',
          tools: [{ 
            type: 'file_search',
            file_search: {
              max_num_results: 5,
              ranking_options: {
                ranker: 'auto',
                score_threshold: 0.0
              }
            }
          }]
        })
        assistantId = assistant.id
        return assistant
      }

      throw new Error('Could not create or retrieve assistant')
    }

    function generateFallbackAnswer(question: string): string {
      const lowerQuestion = question.toLowerCase()
      
      if (lowerQuestion.includes('password') || lowerQuestion.includes('reset')) {
        return 'To reset your password:\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your email for reset instructions\n5. Follow the link to create a new password\n\nIf you continue having issues, please contact our support team.'
      }
      
      if (lowerQuestion.includes('account') || lowerQuestion.includes('profile')) {
        return 'For account-related questions:\n• You can update your profile information in Account Settings\n• To change your email, go to Profile > Edit Profile\n• For billing questions, visit the Billing section\n• To delete your account, contact support\n\nNeed more help? Our support team is here to assist you.'
      }
      
      if (lowerQuestion.includes('feature') || lowerQuestion.includes('how to') || lowerQuestion.includes('use')) {
        return 'FrameLink offers several key features:\n• Easy project management and collaboration\n• Real-time updates and notifications\n• Secure file sharing and storage\n• Integration with popular tools\n• 24/7 customer support\n\nFor detailed tutorials, check our Help Center or contact support for personalized assistance.'
      }
      
      if (lowerQuestion.includes('support') || lowerQuestion.includes('help') || lowerQuestion.includes('contact')) {
        return 'Our support team is here to help!\n\n📧 Email: support@framelink.com\n📞 Phone: 1-800-FRAMELINK\n💬 Live Chat: Available 24/7 on our website\n📚 Help Center: help.framelink.com\n\nWe typically respond within 2-4 hours during business days.'
      }
      
      if (lowerQuestion.includes('pricing') || lowerQuestion.includes('plan') || lowerQuestion.includes('cost')) {
        return 'FrameLink Pricing Plans:\n\n🆓 Free Plan: Basic features for individuals\n💼 Pro Plan: $9.99/month - Advanced features for professionals\n🏢 Team Plan: $19.99/month - Collaboration tools for teams\n🏭 Enterprise: Custom pricing for large organizations\n\nAll plans include 24/7 support and a 30-day free trial!'
      }
      
      return `Thank you for your question: "${question}"\n\nI'd be happy to help you with that! While our AI assistant is temporarily unavailable, our support team can provide detailed assistance.\n\n📧 Contact us at: support@framelink.com\n💬 Live chat available on our website\n📞 Call us at: 1-800-FRAMELINK\n\nWe'll get back to you within 2-4 hours during business days.`
    }
  } catch (error) {
    console.error('Error saving contact information:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
