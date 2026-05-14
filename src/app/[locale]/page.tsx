import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { LandingHero } from './landing-hero';
import { SkipToContent } from './SkipToContent';

const HERO_ANIM_COOKIE = 'sentry:lastHeroAnim';
const HERO_VARIANTS = ['alpha', 'beta', 'gamma'] as const;
type HeroVariant = (typeof HERO_VARIANTS)[number];

function pickHeroVariant(last: string | undefined, override: string | undefined): HeroVariant {
  const norm = (override ?? '').toLowerCase();
  if ((HERO_VARIANTS as readonly string[]).includes(norm)) {
    return norm as HeroVariant;
  }
  const idx = (HERO_VARIANTS as readonly string[]).indexOf(last ?? '');
  return HERO_VARIANTS[(idx + 1) % HERO_VARIANTS.length];
}

interface Props {
  searchParams: { heroAnim?: string };
}

export default async function HomePage({ searchParams }: Props) {
  const t = await getTranslations('common');
  const last = cookies().get(HERO_ANIM_COOKIE)?.value;
  const initialHeroAnim = pickHeroVariant(last, searchParams.heroAnim);
  return (
    <>
      <SkipToContent label={t('skipToContent')} />
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <LandingHero initialHeroAnim={initialHeroAnim} />
        <Footer />
      </div>
    </>
  );
}
