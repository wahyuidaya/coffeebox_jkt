/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  // Menu, bukti pembayaran, dan QRIS disimpan di /public/uploads
  // dan diakses langsung sebagai static file oleh Next.js.
};

export default nextConfig;