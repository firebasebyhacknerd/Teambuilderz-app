
import { Html, Head, Main, NextScript } from 'next/document';

const themeInitializer = `(() => {
  const storageKey = 'tbz-theme';
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = 'system';

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      theme = stored;
    }
  } catch (error) {
    theme = 'system';
  }

  const resolved = theme === 'dark' || (theme === 'system' && systemPrefersDark) ? 'dark' : 'light';

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-color-mode', resolved);
})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

