#!/usr/bin/env node

/**
 * Interactive Feature Configuration Helper
 * 
 * Run: node scripts/configure-features.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

console.log('🎛️  VibeSafe Feature Configuration\n');

// Read current .env
let currentEnv = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      currentEnv[match[1].trim()] = match[2].trim();
    }
  });
}

// Feature definitions
const features = {
  llm: {
    name: '🤖 LLM Enrichment (Recommended)',
    description: 'AI-powered explanations and fix prompts',
    cost: '~$0.001/scan',
    env: {
      'LLM_ENRICHMENT_ENABLED': 'true',
      'ANTHROPIC_API_KEY': '<your-api-key>',
    },
    instructions: [
      'Get API key from: https://console.anthropic.com',
      'Free trial: $5 credit',
      'Replace <your-api-key> with your actual key',
    ],
  },
  sentry: {
    name: '🔍 Sentry Error Tracking (Recommended)',
    description: 'Automatic error tracking and monitoring',
    cost: 'Free (5k errors/month)',
    env: {
      'SENTRY_ENABLED': 'true',
      'SENTRY_DSN': '<your-dsn>',
      'NEXT_PUBLIC_SENTRY_ENABLED': 'true',
      'NEXT_PUBLIC_SENTRY_DSN': '<your-dsn>',
    },
    instructions: [
      'Create account at: https://sentry.io',
      'Create Next.js project',
      'Copy DSN from Project Settings → Client Keys',
      'Replace <your-dsn> with your actual DSN',
    ],
  },
  stripe: {
    name: '💳 Stripe Payments',
    description: 'Enable paid tiers and monetization',
    cost: '2.9% + $0.30 per transaction',
    env: {
      'STRIPE_ENABLED': 'true',
      'STRIPE_SECRET_KEY': '<your-secret-key>',
      'NEXT_PUBLIC_STRIPE_ENABLED': 'true',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': '<your-publishable-key>',
      'STRIPE_PRICE_ID_ONE_SHOT': '<price-id>',
      'STRIPE_PRICE_ID_PRO_MONTHLY': '<price-id>',
      'STRIPE_PRICE_ID_STUDIO_MONTHLY': '<price-id>',
    },
    instructions: [
      'Create account at: https://dashboard.stripe.com',
      'Create 3 products: One-Shot ($29), Pro ($49/mo), Studio ($199/mo)',
      'Get API keys from: Developers → API Keys',
      'Copy Price IDs from each product',
    ],
  },
  auth: {
    name: '🔐 NextAuth (User Accounts)',
    description: 'GitHub/Google OAuth login',
    cost: 'Free',
    env: {
      'AUTH_ENABLED': 'true',
      'AUTH_PROVIDER': 'nextauth',
      'NEXTAUTH_SECRET': '<generate-with-openssl>',
      'NEXT_PUBLIC_AUTH_ENABLED': 'true',
      'NEXT_PUBLIC_AUTH_PROVIDER': 'nextauth',
      'GITHUB_ID': '<your-github-oauth-id>',
      'GITHUB_SECRET': '<your-github-oauth-secret>',
    },
    instructions: [
      'Generate secret: openssl rand -base64 32',
      'GitHub OAuth: Settings → Developer settings → OAuth Apps',
      'Callback URL: http://localhost:3001/api/auth/callback/github',
      'Run: npx prisma migrate dev --name add_nextauth_tables',
    ],
  },
  pdf: {
    name: '📄 PDF Export',
    description: 'Generate downloadable PDF reports',
    cost: '$0.015/GB storage',
    env: {
      'PDF_EXPORT_ENABLED': 'true',
      'NEXT_PUBLIC_PDF_EXPORT_ENABLED': 'true',
      'CLOUDFLARE_R2_ACCOUNT_ID': '<account-id>',
      'CLOUDFLARE_R2_ACCESS_KEY_ID': '<access-key>',
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY': '<secret-key>',
      'CLOUDFLARE_R2_BUCKET_NAME': 'vibesafe-pdfs',
    },
    instructions: [
      'Create Cloudflare account: https://dash.cloudflare.com',
      'R2 → Create bucket → Name: vibesafe-pdfs',
      'Manage R2 API Tokens → Create token',
      'Copy Account ID, Access Key, and Secret',
    ],
  },
  tierGating: {
    name: '🎚️ Tier-Based Gating',
    description: 'Limit free users to 5 findings',
    cost: 'Free',
    env: {
      'TIER_GATING_ENABLED': 'true',
      'NEXT_PUBLIC_TIER_GATING_ENABLED': 'true',
    },
    instructions: [
      'Requires Stripe + Auth to be enabled',
      'Free users see only top 5 findings',
      'Shows upgrade prompts',
    ],
  },
};

// Display menu
console.log('📋 Available Features:\n');
Object.entries(features).forEach(([key, feature], index) => {
  const enabled = Object.keys(feature.env).some(envKey => currentEnv[envKey] === 'true');
  const status = enabled ? '✅' : '⬜';
  console.log(`${index + 1}. ${status} ${feature.name}`);
  console.log(`   ${feature.description}`);
  console.log(`   Cost: ${feature.cost}\n`);
});

console.log('\n📚 Quick Setup Instructions:\n');
console.log('For detailed setup, see: CONFIGURE_FEATURES.md\n');

console.log('🎯 Recommended for Production:');
console.log('  1. ✅ LLM Enrichment (better reports)');
console.log('  2. ✅ Sentry (error tracking)\n');

console.log('💰 For Monetization:');
console.log('  3. ⚠️  Stripe (payments)');
console.log('  4. ⚠️  NextAuth (user accounts)');
console.log('  5. ⚠️  Tier Gating (with Stripe)\n');

console.log('📄 Current Status:\n');
console.log('Check enabled features:');
console.log('  curl http://localhost:3001/api/health\n');

console.log('📝 To enable a feature:');
console.log('  1. Open .env file');
console.log('  2. Add the environment variables from CONFIGURE_FEATURES.md');
console.log('  3. Restart: npm run dev\n');

console.log('💡 Pro Tip: Start with LLM Enrichment only!');
console.log('   Cost: ~$0.001/scan, makes reports 10x better\n');
