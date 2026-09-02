/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA is served via public/manifest.webmanifest + public/sw.js (registered client-side).
  // Kept dependency-free on purpose so the pilot stays easy to maintain.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};
export default nextConfig;
