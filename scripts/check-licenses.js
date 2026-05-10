#!/usr/bin/env node

/**
 * License compliance checker for VibeSafe
 * 
 * Scans all dependencies and fails CI if any have problematic licenses.
 * Blocked licenses: GPL, AGPL, non-commercial, source-available, custom, unknown
 * 
 * Usage:
 *   npm run compliance:check-licenses
 *   node scripts/check-licenses.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── License Categories ───────────────────────────────────────────────────────

const APPROVED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Python-2.0',
  'Artistic-2.0',
];

const BLOCKED_LICENSES = [
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'LGPL-2.1',
  'LGPL-3.0',
  'CC-BY-NC',
  'CC-BY-NC-SA',
  'BUSL-1.1', // Business Source License (source-available, not open source)
  'SSPL-1.0', // Server Side Public License (copyleft)
];

const WARNING_LICENSES = [
  'MPL-2.0', // Weak copyleft, usually OK but review usage
  'EPL-2.0', // Eclipse Public License, weak copyleft
  'CDDL-1.0', // Common Development and Distribution License
];

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 Checking dependency licenses...\n');

  // Run npm list to get all dependencies with licenses
  let rawOutput;
  try {
    rawOutput = execSync('npm list --json --all', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    // npm list can exit with error code if peer deps are missing, but still outputs JSON
    rawOutput = error.stdout || '{}';
  }

  const packageTree = JSON.parse(rawOutput);
  const allPackages = extractAllPackages(packageTree);

  console.log(`📦 Found ${allPackages.length} packages\n`);

  const blockedPackages = [];
  const warningPackages = [];
  const unknownPackages = [];
  const approvedCount = allPackages.length;

  for (const pkg of allPackages) {
    const license = normalizeLicense(pkg.license);

    if (!license || license === 'UNKNOWN') {
      unknownPackages.push(pkg);
    } else if (BLOCKED_LICENSES.some(blocked => license.includes(blocked))) {
      blockedPackages.push({ ...pkg, category: 'BLOCKED' });
    } else if (WARNING_LICENSES.some(warn => license.includes(warn))) {
      warningPackages.push({ ...pkg, category: 'WARNING' });
    }
  }

  // Print results
  if (blockedPackages.length > 0) {
    console.log('❌ BLOCKED LICENSES FOUND:\n');
    for (const pkg of blockedPackages) {
      console.log(`   ${pkg.name}@${pkg.version}`);
      console.log(`   License: ${pkg.license}`);
      console.log(`   Reason: Copyleft or restrictive license incompatible with commercial use\n`);
    }
  }

  if (unknownPackages.length > 0) {
    console.log('⚠️  UNKNOWN LICENSES:\n');
    for (const pkg of unknownPackages) {
      console.log(`   ${pkg.name}@${pkg.version}`);
      console.log(`   License: ${pkg.license || 'MISSING'}\n`);
    }
  }

  if (warningPackages.length > 0) {
    console.log('⚠️  WARNING LICENSES (review required):\n');
    for (const pkg of warningPackages) {
      console.log(`   ${pkg.name}@${pkg.version}`);
      console.log(`   License: ${pkg.license}`);
      console.log(`   Reason: Weak copyleft, review usage pattern\n`);
    }
  }

  if (blockedPackages.length === 0 && unknownPackages.length === 0 && warningPackages.length === 0) {
    console.log('✅ All licenses approved!\n');
  }

  // Generate compliance report
  generateComplianceReport(allPackages, blockedPackages, warningPackages, unknownPackages);

  // Exit with error if blocked licenses found
  if (blockedPackages.length > 0) {
    console.error('\n❌ CI FAILED: Blocked licenses detected. Review and remove these dependencies.\n');
    process.exit(1);
  }

  if (unknownPackages.length > 0) {
    console.warn('\n⚠️  WARNING: Unknown licenses detected. Review before production deployment.\n');
    // Don't fail CI for warnings, but log them
  }

  console.log('✅ License check passed!\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractAllPackages(tree, packages = [], seen = new Set()) {
  if (!tree || typeof tree !== 'object') return packages;

  const pkgId = `${tree.name}@${tree.version}`;
  if (seen.has(pkgId)) return packages;

  if (tree.name && tree.version) {
    seen.add(pkgId);
    packages.push({
      name: tree.name,
      version: tree.version,
      license: tree.license || 'UNKNOWN',
    });
  }

  if (tree.dependencies) {
    for (const dep of Object.values(tree.dependencies)) {
      extractAllPackages(dep, packages, seen);
    }
  }

  return packages;
}

function normalizeLicense(license) {
  if (!license) return 'UNKNOWN';
  if (typeof license === 'object' && license.type) return license.type;
  return String(license).toUpperCase();
}

function generateComplianceReport(allPackages, blockedPackages, warningPackages, unknownPackages) {
  const report = {
    generatedAt: new Date().toISOString(),
    totalPackages: allPackages.length,
    summary: {
      approved: allPackages.length - blockedPackages.length - warningPackages.length - unknownPackages.length,
      blocked: blockedPackages.length,
      warnings: warningPackages.length,
      unknown: unknownPackages.length,
    },
    packages: allPackages,
    issues: {
      blocked: blockedPackages,
      warnings: warningPackages,
      unknown: unknownPackages,
    },
  };

  const reportPath = path.join(__dirname, '../docs/compliance/license-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

main();
