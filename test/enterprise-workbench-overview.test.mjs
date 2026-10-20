import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = (await readFile(new URL('../packages/@scx/dsh-workbench-prototype/lib/client.js', import.meta.url), 'utf8'))
  .replace('function startApiBridge(ctx) {', 'exports.__testOverviewPanel = OverviewPanel;\nfunction startApiBridge(ctx) {')
let client
vm.runInNewContext(source, {
  window: {
    __ModuleLoader__: {
      load({ factory }) {
        client = factory(name => {
          if (name === 'react') return {
            createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
            Fragment: Symbol('Fragment')
          }
          throw new Error(`Unexpected module ${name}`)
        })
      }
    }
  }
})

describe('enterprise workbench page selection', () => {
  it('uses the host rendered active flag instead of a stale service snapshot', () => {
    expect(client.isWorkbenchPanelActive({ explicitActive: true, entryId: 'enterprise', activeId: null, marketOpen: false })).toBe(true)
    expect(client.isWorkbenchPanelActive({ explicitActive: false, entryId: 'enterprise', activeId: 'enterprise', marketOpen: false })).toBe(false)
    expect(client.isWorkbenchPanelActive({ explicitActive: true, entryId: 'enterprise', activeId: 'enterprise', marketOpen: true })).toBe(false)
  })

  it('falls back to the service snapshot when the host does not pass an active flag', () => {
    expect(client.isWorkbenchPanelActive({ entryId: 'enterprise', activeId: 'enterprise', marketOpen: false })).toBe(true)
    expect(client.isWorkbenchPanelActive({ entryId: 'enterprise', activeId: null, marketOpen: false })).toBe(false)
  })

  it('keeps the business overview as the non-website surface', () => {
    expect(client.shouldAttachEnterpriseWebsite({
      view: 'overview', showSettings: false, hasFrame: false, panelActive: true, hasUrl: true
    })).toBe(false)
  })

  it('attaches the existing enterprise website when its tab is selected', () => {
    expect(client.shouldAttachEnterpriseWebsite({
      view: 'website', showSettings: false, hasFrame: true, panelActive: true, hasUrl: true
    })).toBe(true)
  })

  it('renders the overview without claiming unconnected data and keeps the legacy website action', () => {
    const openWebsite = vi.fn()
    const openSettings = vi.fn()
    const tree = client.__testOverviewPanel({
      t: key => key,
      systemName: 'AI 智能平台系统',
      normalizedSiteUrl: 'http://121.40.84.3:4175/',
      onOpenWebsite: openWebsite,
      onOpenSettings: openSettings
    })
    const nodes = []
    const visit = node => {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!node || typeof node !== 'object') return
      nodes.push(node)
      visit(node.props?.children)
    }
    visit(tree)
    expect(nodes.some(node => node.props?.children?.includes?.('overviewNoMetrics'))).toBe(true)
    expect(nodes.some(node => node.props?.children?.includes?.('overviewConfigured · http://121.40.84.3:4175/'))).toBe(true)
    const websiteButton = nodes.find(node => node.type === 'button' && node.props.children.includes('overviewOpenWebsite'))
    const settingsButton = nodes.find(node => node.type === 'button' && node.props.children.includes('overviewConfigure'))
    websiteButton.props.onClick()
    settingsButton.props.onClick()
    expect(openWebsite).toHaveBeenCalledOnce()
    expect(openSettings).toHaveBeenCalledOnce()
  })

  it.each([
    { showSettings: true, hasFrame: true, panelActive: true, hasUrl: true },
    { showSettings: false, hasFrame: false, panelActive: true, hasUrl: true },
    { showSettings: false, hasFrame: true, panelActive: false, hasUrl: true },
    { showSettings: false, hasFrame: true, panelActive: true, hasUrl: false }
  ])('does not attach the website while settings, layout, or connection is unavailable', state => {
    expect(client.shouldAttachEnterpriseWebsite({ view: 'website', ...state })).toBe(false)
  })
})
