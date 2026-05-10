import { Nav } from '@/components/nav';
import { LandingHero } from './landing-hero';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <LandingHero />
      </div>
    </div>
  );
}
