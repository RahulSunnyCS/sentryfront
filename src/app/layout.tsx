import './globals.css';
import { Noto_Sans_Malayalam } from 'next/font/google';

const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam', 'latin'],
  display: 'swap',
  variable: '--font-malayalam',
});

const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={notoMalayalam.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
