import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET() {
  const filePath = path.join(process.cwd(), '..', 'scripts', 'datenschleuder_agent.tar.gz')

  try {
    const fileBuffer = await readFile(filePath)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="datenschleuder_agent.tar.gz"',
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Agent package not found' }, { status: 404 })
  }
}
