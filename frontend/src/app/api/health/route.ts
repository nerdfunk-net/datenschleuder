import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check - could be expanded to check backend connectivity
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'datenschleuder-frontend',
      version: process.env.npm_package_version || 'unknown'
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        service: 'datenschleuder-frontend'
      },
      { status: 500 }
    )
  }
}
