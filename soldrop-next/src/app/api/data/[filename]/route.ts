import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: { filename: string } }) {
  const { filename } = params;

  if (!filename) {
    return new NextResponse('Filename is required', { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'data', filename as string);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // Set Content-Type based on file extension
    if (filename.endsWith('.json')) {
      return new NextResponse(fileContent, { headers: { 'Content-Type': 'application/json' } });
    } else {
      return new NextResponse(fileContent, { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error);
    return new NextResponse('Error reading file', { status: 500 });
  }
}
