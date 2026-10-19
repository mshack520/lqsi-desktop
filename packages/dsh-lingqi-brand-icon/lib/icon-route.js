/**
 * dsh-lingqi-brand-icon — LQ SI 品牌图标路由（纯宿主插件）
 *
 * GET /lingqi-brand/icon → 返回 LQ SI 应用图标（PNG），供 dsh-lingqi-brand 的
 * 客户端品牌位（侧栏 / 输入框上方）通过 <img src="/lingqi-brand/icon"> 显示。
 *
 * 图标路径不写死：从本进程启动入口动态推导 dsH 安装根目录（app_icon_256.png
 * 所在处），LQ SI/DSH 装在任意盘符、任意目录都能找到；推导失败或文件缺失时
 * 返回 404，客户端回退文字徽标。
 */
import { Service } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
const iconUrl = new URL('../assets/app_icon_256.png', import.meta.url)

class LingQiBrandIcon extends Service {
  static inject = ['webServer']

  constructor(ctx) {
    super(ctx, 'lingqiBrandIcon')
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'prefix',
          path: '/lingqi-brand',
          handler: (req, res) => {
            void this.handle(req, res)
          },
        }),
      'lingqi-brand-icon: icon route',
    )
  }

  async handle(req, res) {
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    } catch {}
    if (req.method !== 'GET' || (pathname !== '/lingqi-brand/icon' && pathname !== '/lingqi-brand/icon/')) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'not found' }))
      return
    }
    try {
      const data = await readFile(iconUrl)
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
      res.end(data)
    } catch {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'read failed' }))
    }
  }
}

export default LingQiBrandIcon
export { LingQiBrandIcon }
