import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      next: { revalidate: 10 },
    });
    
    const backendHealthy = response.ok;
    
    return NextResponse.json({
      status: backendHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        web: 'healthy',
        api: backendHealthy ? 'healthy' : 'unhealthy',
      },
    }, { status: backendHealthy ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        web: 'healthy',
        api: 'unreachable',
      },
    }, { status: 503 });
  }
}
