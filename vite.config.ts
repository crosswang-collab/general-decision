import react from '@vitejs/plugin-react'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * 本機把 api/*.ts 掛成 /api/* 路由。
 * 這樣 `npm run dev` / `vite preview` 不用 `vercel dev`（那個要先登入）就能整支跑起來。
 * 上線時這段不會執行，Vercel 直接用 api/ 目錄。
 */
function localApi(): Plugin {
  const mount = (server: ViteDevServer) => {
    server.middlewares.use(async (req: Connect.IncomingMessage, res, next: Connect.NextFunction) => {
      const url = req.url ?? ''
      if (!url.startsWith('/api/')) return next()
      const name = url.split('?')[0]!.replace('/api/', '')
      try {
        const mod = await server.ssrLoadModule(`/api/${name}.ts`)
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const body = chunks.length ? Buffer.concat(chunks) : undefined
        const request = new Request(`http://localhost${url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        })
        // 與 Vercel 的 dispatch 對齊：具名 HTTP method export 優先，其次 default.fetch。
        // 不接受函式型的 default —— 那正是上線會掛住的形狀，本機也不該讓它過。
        const entry = (mod[req.method ?? 'GET'] ?? mod.default?.fetch) as
          | ((r: Request) => Promise<Response>)
          | undefined
        if (!entry) throw new Error(`api/${name} 沒有可用的入口（具名 method export 或 default.fetch）`)
        const out: Response = await entry(request)
        res.statusCode = out.status
        out.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await out.arrayBuffer()))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'local_api', message: String(e) }))
      }
    })
  }
  return {
    name: 'decide-local-api',
    configureServer: mount,
    configurePreviewServer: mount as unknown as Plugin['configurePreviewServer'],
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    globals: true,
  },
})
