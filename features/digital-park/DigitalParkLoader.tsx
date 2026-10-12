'use client';

import dynamic from 'next/dynamic';
import './digital-park.css';

/**
 * Next.js entry point. Three.js needs `window`, so the park is loaded on the
 * client only; this wrapper shows a small loading state while the chunk arrives.
 */
const DigitalPark = dynamic(() => import('./DigitalPark'), {
  ssr: false,
  loading: () => (
    <div className="dp-loading" role="status">
      Loading the park…
    </div>
  ),
});

export default function DigitalParkLoader({ className }: { className?: string }) {
  return <DigitalPark className={className} />;
}
