import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Generate answer using OpenAI with fallback
    let answer = ''
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for FrameLink Support. Provide clear, concise, and helpful answers to user questions.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      })
      
      answer = completion.choices[0]?.message?.content || 'Sorry, I could not generate an answer at this time.'
    } catch (openaiError: any) {
      console.error('OpenAI API error details:', {
        message: openaiError?.message,
        status: openaiError?.status,
        code: openaiError?.code,
        type: openaiError?.type,
        apiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
        fullError: openaiError
      })
      
      // If it's still a quota issue, inform the user
      if (openaiError?.status === 429 || openaiError?.code === 'insufficient_quota') {
        answer = 'I apologize, but our AI service is currently experiencing high demand. Please try again in a few minutes, or contact our support team for immediate assistance.'
      } else {
        // Fallback responses for common questions
        answer = generateFallbackAnswer(question)
      }
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

    // Generate today's date
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db('nextjs_app')
    const collection = db.collection('contacts')

    // Insert the document
    const result = await collection.insertOne({
      username: username || null,
      question,
      answer,
      date: today,
      createdAt: new Date(),
    })

    return NextResponse.json(
      { message: 'Contact information saved successfully', answer, id: result.insertedId },
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
