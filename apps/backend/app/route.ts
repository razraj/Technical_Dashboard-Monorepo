import { NextResponse } from "next/server";

export async function GET() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Backend status</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
    .ok { color: #166534; }
  </style>
</head>
<body>
  <h1 class="ok">✅ All Services are Running</h1>
  <p>The backend server is running successfully.</p>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}
