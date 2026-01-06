import './globals.css';
import Navbar from './components/Navbar';

export const metadata = {
  title: 'Swing Booking',
  description: 'Plateforme de booking d’artistes – Swing Events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-slate-900">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
