import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h2 className="text-6xl font-bold mb-4">404</h2>
        <h3 className="text-2xl font-semibold mb-4">Page Not Found</h3>
        <p className="text-gray-600 mb-6">
          Could not find the requested resource.
        </p>
        <Link
          href="/"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
