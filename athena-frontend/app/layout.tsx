import '../styles/globals.css'
import { Header } from '../components/common/Header'
import { Footer } from '../components/common/Footer'

export const metadata = {
  title: 'ATHENA - Women\'s Career & Economic Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-blush-50 text-midnight-900">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
