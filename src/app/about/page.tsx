import Link from 'next/link'

export default function About() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          About This App
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            This is a sample Next.js application built with modern web technologies.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3 text-blue-800 dark:text-blue-300">
                🚀 Technologies Used
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li>• Next.js 15.4.6</li>
                <li>• React 18</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• ESLint</li>
              </ul>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3 text-green-800 dark:text-green-300">
                ✨ Features
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li>• App Router</li>
                <li>• TypeScript Support</li>
                <li>• Responsive Design</li>
                <li>• Dark Mode Support</li>
                <li>• Modern UI Components</li>
              </ul>
            </div>
          </div>
        </div>
        
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  )
}
