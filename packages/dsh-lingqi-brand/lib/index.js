/**
 * dsh-lingqi-brand — LQ SI 品牌插件（宿主半）
 *
 * 纯客户端 UI 插件：
 *   - sidebar.brand.mark / sidebar.brand.name  → 左上角 LQ SI 图标与字标
 *   - conversation.hero.brand.mark             → 输入框上方 LQ SI 图标
 *   - locale 新语言「LQ SI 中文」（fallback zh）→ hero 标题统一为 LQ SI
 *
 * 宿主半无需任何服务，仅作为插件挂载点存在。
 * 品牌图标路由由 dsh-lingqi-brand-icon 提供（见其 README）。
 */
const plugin = {
  name: 'lingqi-brand',
  apply() {},
}

export default plugin
export { plugin }
