import type { Metadata } from 'next';
import { Roboto, Roboto_Mono, Geologica } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const roboto = Roboto({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Display font for the marketing landing (matches Figma design).
const geologica = Geologica({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'youboost — SMM Panel',
  description: 'Social media marketing services platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${robotoMono.variable} ${geologica.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
