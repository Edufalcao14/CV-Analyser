/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse is a CommonJS dep that uses Node built-ins; keep it server-external
  // so Next doesn't try to bundle it for the client.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
