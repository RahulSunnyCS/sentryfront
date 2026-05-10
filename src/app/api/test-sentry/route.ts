/**
 * Test endpoint to verify Sentry error tracking
 * 
 * DELETE THIS FILE after testing!
 * 
 * Usage: GET /api/test-sentry
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    // Capture a test message
    Sentry.captureMessage('Sentry test: Manual message capture', 'info');
    
    // Throw a test error
    throw new Error('🧪 This is a test error to verify Sentry integration is working!');
  } catch (error) {
    // Sentry will automatically capture this
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Test error sent to Sentry! Check your Sentry dashboard.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}
