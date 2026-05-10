#!/usr/bin/env node
/**
 * Test script to verify feature flags are working correctly
 * 
 * Usage:
 *   node scripts/test-features.js
 *   
 * Or with custom FEATURES:
 *   FEATURES='{"stripe":false}' node scripts/test-features.js
 */

// Load environment variables
require('dotenv').config();

// Parse FEATURES (same logic as src/lib/features.ts)
const defaultFeatures = {
  performanceScanning: true,
  accessibilityScanning: true,
  seoScanning: true,
  scanDiff: true,
  pdfExport: true,
  stripe: true,
  auth: true,
  tierGating: true,
};

let customFeatures = {};
try {
  if (process.env.FEATURES) {
    customFeatures = JSON.parse(process.env.FEATURES);
  }
} catch (error) {
  console.error('❌ Invalid FEATURES env variable:', error.message);
  process.exit(1);
}

const features = {
  performanceScanning: customFeatures.performanceScanning ?? defaultFeatures.performanceScanning,
  accessibilityScanning: customFeatures.accessibilityScanning ?? defaultFeatures.accessibilityScanning,
  seoScanning: customFeatures.seoScanning ?? defaultFeatures.seoScanning,
  scanDiff: customFeatures.scanDiff ?? defaultFeatures.scanDiff,
  pdfExport: customFeatures.pdfExport ?? defaultFeatures.pdfExport,
  stripe: customFeatures.stripe ?? defaultFeatures.stripe,
  auth: customFeatures.auth ?? defaultFeatures.auth,
  tierGating: customFeatures.tierGating ?? defaultFeatures.tierGating,
};

// Display results
console.log('\n═══════════════════════════════════════════════════════');
console.log('  VibeSafe Feature Flags Test');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 Environment Variable:');
if (process.env.FEATURES) {
  console.log(`   FEATURES='${process.env.FEATURES}'`);
} else {
  console.log('   FEATURES not set (all features enabled by default)');
}

console.log('\n✨ Feature Status:\n');

const statusIcon = (enabled) => enabled ? '✅' : '❌';

Object.entries(features).forEach(([name, enabled]) => {
  const padding = ' '.repeat(25 - name.length);
  console.log(`   ${statusIcon(enabled)} ${name}${padding}${enabled ? 'ENABLED' : 'DISABLED'}`);
});

console.log('\n───────────────────────────────────────────────────────\n');

// Count enabled features
const enabledCount = Object.values(features).filter(Boolean).length;
const totalCount = Object.keys(features).length;

console.log(`📊 Summary: ${enabledCount}/${totalCount} features enabled\n`);

// Exit with appropriate code
const allEnabled = enabledCount === totalCount;
if (allEnabled) {
  console.log('✅ All features are enabled!\n');
} else {
  console.log(`⚠️  ${totalCount - enabledCount} feature(s) disabled\n`);
}
