import { Nav } from '@/components/nav';
import { MockModeBanner } from '@/components/mock-mode-banner';
import { LandingHero } from './landing-hero';
import { isMockMode } from '@/lib/config';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      {isMockMode && <div style={{ paddingTop: 56 }}><MockModeBanner /></div>}
      <div style={{ paddingTop: isMockMode ? 0 : 56 }}>
        <LandingHero />
      </div>
    </div>
  );
}
