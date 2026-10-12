import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

/**
 * Every IPv4 address this computer has on the local network.
 *
 * In development, Next.js only serves its scripts to the hostname it was
 * started on. A phone opening http://<this computer's IP>:3000 is a different
 * hostname, so without this list the page stays on "Loading the park…".
 * This affects `next dev` only; production builds ignore it.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
