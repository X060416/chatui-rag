export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getAllIndexJsonFiles(baseDir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(baseDir);
  list.forEach((file) => {
    const filePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllIndexJsonFiles(filePath));
    } else if (file === 'index.json') {
      results.push(filePath);
    }
  });
  return results;
}

export async function GET(req: NextRequest) {
  const baseDir = path.join(process.cwd(), 'data', 'chats');
  const indexFiles = getAllIndexJsonFiles(baseDir);
  let allFiles: any[] = [];
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  for (const indexFile of indexFiles) {
    try {
      const json = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      const folder = path.relative(baseDir, path.dirname(indexFile));
      for (const session of json) {
        if (Array.isArray(session.files)) {
          if (!sessionId || session.id === sessionId) {
            session.files.forEach((f: any) => {
              allFiles.push({
                ...f,
                sessionId: session.id,
                sessionTitle: session.title,
                folder,
              });
            });
          }
        }
      }
    } catch {}
  }
  return NextResponse.json(allFiles);
}