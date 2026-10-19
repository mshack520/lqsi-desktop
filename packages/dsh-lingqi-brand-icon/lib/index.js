/**
 * dsh-lingqi-brand-icon — 包入口（re-export）
 *
 * 真正的实现位于 ./icon-route.js（见其文件头注释）。
 * 本文件保持 package.json main 的正常包语义；patch 热加载（profiles/web/cordis.patch.yml）
 * 则直指 ./icon-route.js —— 两个入口加载同一份实现，行为一致。
 */
export * from './icon-route.js'
export { default } from './icon-route.js'
