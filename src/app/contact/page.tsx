'use client'

import React, { useState, Suspense, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Custom CSS for enhanced scrollbar - always visible elevator
const scrollbarStyles = `
  .custom-scrollbar {
    scrollbar-width: thick;
    scrollbar-color: #3b82f6 #f1f5f9;
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 16px;
    background: #f1f5f9;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 8px;
    border: 2px solid #e2e8f0;
    margin: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: 8px;
    border: 3px solid #f1f5f9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    min-height: 40px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transform: scale(1.05);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:active {
    background: linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%);
  }
  
  .custom-scrollbar::-webkit-scrollbar-corner {
    background: #f1f5f9;
  }
  
  .dark .custom-scrollbar {
    scrollbar-color: #60a5fa #374151;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar {
    background: #374151;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-track {
    background: #374151;
    border-color: #4b5563;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
    border-color: #374151;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-corner {
    background: #374151;
  }
`

interface ConversationItem {
  id: string
  question: string
  answer: string
  citations: any[]
  timestamp: Date
}

function ContactForm() {
  const searchParams = useSearchParams()
  const username = searchParams.get('username') || ''
  const [formData, setFormData] = useState({
    question: ''
  })
  const [conversation, setConversation] = useState<ConversationItem[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentCitations, setCurrentCitations] = useState<any[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const conversationContainerRef = useRef<HTMLDivElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (conversationContainerRef.current) {
      // Force scroll to bottom immediately to show latest content
      const container = conversationContainerRef.current
      setTimeout(() => {
        container.scrollTop = container.scrollHeight
      }, 0)
    }
  }, [conversation, currentAnswer])

  // Additional effect to ensure scroll on streaming updates
  useEffect(() => {
    if (conversationContainerRef.current && (isSubmitting || currentAnswer)) {
      const container = conversationContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [isSubmitting, currentAnswer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.question.trim()) return
    
    const questionToSubmit = formData.question
    const conversationId = Date.now().toString()
    
    setIsSubmitting(true)
    setMessage('')
    setCurrentAnswer('')
    setCurrentCitations([])
    setCurrentQuestion(questionToSubmit)
    setFormData({ question: '' }) // Clear form immediately

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: questionToSubmit, username }),
      })

      if (response.ok) {
        console.log('Response is OK, checking for streaming...')
        
        if (response.body) {
          console.log('Response has body, starting stream...')
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let streamedAnswer = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('Stream completed')
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              console.log('Received chunk:', chunk)
              
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  try {
                    const jsonStr = line.slice(6).trim()
                    if (jsonStr) {
                      const data = JSON.parse(jsonStr)
                      console.log('Parsed data:', data)
                      
                      if (data.type === 'delta') {
                        streamedAnswer += data.content
                        setCurrentAnswer(streamedAnswer)
                      } else if (data.type === 'complete') {
                        console.log('Stream complete, adding to conversation')
                        setCurrentCitations(data.citations || [])
                        setConversation(prev => [...prev, {
                          id: conversationId,
                          question: questionToSubmit,
                          answer: streamedAnswer,
                          citations: data.citations || [],
                          timestamp: new Date()
                        }])
                        setCurrentAnswer('')
                        setCurrentCitations([])
                        setCurrentQuestion('')
                        setMessage('Your question has been answered!')
                      } else if (data.type === 'fallback') {
                        console.log('Fallback response received')
                        setConversation(prev => [...prev, {
                          id: conversationId,
                          question: questionToSubmit,
                          answer: data.content,
                          citations: [],
                          timestamp: new Date()
                        }])
                        setCurrentAnswer('')
                        setCurrentQuestion('')
                        setMessage('Your question has been answered!')
                      }
                    }
                  } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError, 'Line:', line)
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('Stream reading error:', streamError)
            throw streamError
          }
        } else {
          console.log('No response body, trying JSON response')
          const jsonResponse = await response.json()
          console.log('JSON response:', jsonResponse)
          
          if (jsonResponse.answer) {
            setConversation(prev => [...prev, {
              id: conversationId,
              question: questionToSubmit,
              answer: jsonResponse.answer,
              citations: jsonResponse.citations || [],
              timestamp: new Date()
            }])
            setCurrentQuestion('')
            setMessage('Your question has been answered!')
          }
        }
      } else {
        console.error('Response not ok:', response.status, response.statusText)
        // Try to read response as JSON for error details
        try {
          const errorData = await response.json()
          console.error('Error response:', errorData)
          setMessage(`Error: ${errorData.error || 'Unknown error'}`)
        } catch {
          setMessage(`Error: ${response.status} ${response.statusText}`)
        }
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setMessage(`Network error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
      
      // Add a fallback response for testing
      setConversation(prev => [...prev, {
        id: conversationId,
        question: questionToSubmit,
        answer: "I'm having trouble connecting to the AI service right now. This is a fallback response to confirm the interface is working. Please check the browser console for technical details.",
        citations: [],
        timestamp: new Date()
      }])
      setCurrentQuestion('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <main className="flex flex-col p-4" style={{ height: '1024px', maxHeight: '1024px' }}>
        <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center mb-2">
            <img 
              src="/framelink-icon.png.png" 
              alt="FrameLink" 
              className="w-10 h-10 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            FrameLink Support - Centro Médico de Algés
          </h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex-1 flex flex-col">
          {username && (
            <div className="text-center mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Welcome {username}!
              </h2>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question
              </label>
              <div className="flex gap-4">
                <textarea
                  id="question"
                  name="question"
                  value={formData.question}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your question"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-6 rounded-md transition-colors h-fit"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="conversation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Conversation
              </label>
              <div 
                ref={conversationContainerRef}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 overflow-y-scroll custom-scrollbar"
                style={{
                  height: '600px',
                  maxHeight: '600px',
                  scrollbarColor: '#3b82f6 #f1f5f9'
                }}
              >
                {conversation.length === 0 && !isSubmitting && !currentAnswer && !currentQuestion ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                    Ask a question above and the conversation will appear here.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Display conversation history */}
                    {conversation.map((item) => (
                      <div key={item.id} className="space-y-3">
                        {/* Question */}
                        <div className="flex justify-end">
                          <div className="max-w-3xl bg-blue-600 text-white p-3 rounded-lg rounded-br-none">
                            <div className="text-sm font-medium mb-1">You</div>
                            <div className="whitespace-pre-wrap">{item.question}</div>
                          </div>
                        </div>
                        
                        {/* Answer */}
                        <div className="flex justify-start">
                          <div className="max-w-3xl bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 p-3 rounded-lg rounded-bl-none">
                            <div className="text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">FrameLink Assistant</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.answer}</div>
                            
                            {/* Citations for this answer */}
                            {item.citations.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources:</h4>
                                <div className="space-y-1">
                                  {item.citations.map((citation, index) => (
                                    <div key={index} className="text-xs text-gray-500 dark:text-gray-400">
                                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">
                                        [{index + 1}]
                                      </span>
                                      {citation.file_citation && (
                                        <span className="ml-2">
                                          {citation.cached_metadata?.display_name || citation.file_citation.file_id} - {citation.text}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Current streaming answer */}
                    {(isSubmitting || currentAnswer) && (
                      <div className="space-y-3">
                        {/* Current question being processed */}
                        {isSubmitting && (
                          <div className="flex justify-end">
                            <div className="max-w-3xl bg-blue-600 text-white p-3 rounded-lg rounded-br-none">
                              <div className="text-sm font-medium mb-1">You</div>
                              <div className="whitespace-pre-wrap">{currentQuestion}</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Streaming answer */}
                        <div className="flex justify-start">
                          <div className="max-w-3xl bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 p-3 rounded-lg rounded-bl-none">
                            <div className="text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">FrameLink Assistant</div>
                            {isSubmitting && !currentAnswer ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Generating answer...</span>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {currentAnswer}
                                {isSubmitting && <span className="animate-pulse">|</span>}
                              </div>
                            )}
                            
                            {/* Current citations */}
                            {currentCitations.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources:</h4>
                                <div className="space-y-1">
                                  {currentCitations.map((citation, index) => (
                                    <div key={index} className="text-xs text-gray-500 dark:text-gray-400">
                                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">
                                        [{index + 1}]
                                      </span>
                                      {citation.file_citation && (
                                        <span className="ml-2">
                                          {citation.cached_metadata?.display_name || citation.file_citation.file_id} - {citation.text}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Auto-scroll anchor */}
                    <div ref={conversationEndRef} />
                  </div>
                )}
              </div>
            </div>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md flex items-center justify-between ${
              message.includes('successfully') 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
            }`}>
              <span>{message}</span>
              <Link
                href="/"
                className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Back to Home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  )
}

export default function Contact() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <ContactForm />
    </Suspense>
  )
}
