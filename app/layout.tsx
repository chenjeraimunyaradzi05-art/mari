import React from 'react'
import '../src/app/globals.css'
import Header from '../src/components/common/Header'
import Footer from '../src/components/common/Footer'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />

        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  )
}
