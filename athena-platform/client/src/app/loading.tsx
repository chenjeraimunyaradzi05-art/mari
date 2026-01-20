export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        {/* Logo Animation */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Loading Text */}
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">
          Loading ATHENA...
        </p>
      </div>
    </div>
  );
}
