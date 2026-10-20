window.__ModuleLoader__.load({
  id: 'dsh-desktop-onboarding',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const { useCallback, useEffect, useRef, useState } = React
    const { Button, Modal } = require('@deepseek-ai/dsh-client-ui-primitives')

    const NS = 'desktop-onboarding'
    // Settings section the "configure a model" action opens.
    const MODELS_SECTION_ID = 'models'

    // DSH Desktop whale mark (same artwork as the sidebar brand seat), drawn
    // in currentColor so it follows the header text color in both themes.
    const BRAND_MARK_VIEWBOX = { x: 42, y: 218, width: 898, height: 564 }
    const BRAND_MARK_PATH = 'M478.318 218C605.318 218 683.318 287 687.318 404L691.318 472C693.318 525 697.319 556 726.318 574C746.318 587 774.318 585 790.318 562C799.318 550 802.318 539 792.318 534C747.319 513 727.318 472 738.318 428C739.652 420 742.652 418.667 747.318 424C774.318 450 815.318 460 831.318 501C855.318 457 898.318 456 930.318 436C936.318 431.333 939.318 433.333 939.318 442C938.318 496 903.318 535 850.318 547C841.318 570 833.318 592 819.318 622C773.318 723 661.318 782 491.318 782H294.318C161.319 782 74.3183 714 53.3184 592C41.3184 526 38.3184 433 50.3184 375C70.3184 277 113.82 218 234.32 218H478.318ZM571.82 350.5C469.82 333.5 277.82 329.5 164.82 350.5C138.82 355.5 114.318 379 110.318 404C100.318 451 102.318 551 124.318 596C155.318 660 214.319 697 315.318 705C324.318 678 346.319 662 376.318 662C404.318 662 427.318 678 435.318 705C493.318 699 526.318 680 562.318 652C621.318 606 633.749 527.103 633.749 424C633.749 385.144 604.82 355.5 571.82 350.5ZM179.32 264C167.722 264 158.32 273.402 158.32 285C158.32 296.598 167.722 306 179.32 306C190.918 306 200.32 296.598 200.32 285C200.32 273.402 190.918 264 179.32 264ZM245.551 264C233.953 264 224.551 273.402 224.551 285C224.551 296.598 233.953 306 245.551 306C257.149 306 266.551 296.598 266.551 285C266.551 273.402 257.149 264 245.551 264ZM311.782 264C300.184 264 290.782 273.402 290.782 285C290.782 296.598 300.184 306 311.782 306C323.38 306 332.782 296.598 332.782 285C332.782 273.402 323.38 264 311.782 264Z'

    const STYLE_ID = 'dsh-desktop-onboarding-style'
    // Same dialog chrome as the stock welcome notice it replaces: a bounded
    // card whose body scrolls while the brand row and actions stay put.
    const STYLE = `
      .dshDeskOnbDialog{width:min(600px,100%);padding:0}
      .dshDeskOnbContent{box-sizing:border-box;display:flex;flex-direction:column;max-height:calc(100vh - 48px);padding:24px 28px}
      .dshDeskOnbHeader{flex:none;display:flex;align-items:center;gap:10px}
      .dshDeskOnbBrandMark{display:inline-flex;align-items:center;color:var(--dsw-alias-label-primary)}
      .dshDeskOnbBrandName{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:22px}
      .dshDeskOnbBrandBy{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px}
      .dshDeskOnbHeading{flex:none;color:var(--dsw-alias-label-primary);outline:none;margin:16px 0 0;font-size:20px;font-weight:500;line-height:28px}
      .dshDeskOnbBody{flex:1;min-height:0;margin-top:12px;overflow-y:auto}
      .dshDeskOnbParagraph{margin:0 0 10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
      .dshDeskOnbSubheading{margin:14px 0 6px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:20px}
      .dshDeskOnbLinkList{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
      .dshDeskOnbLinkChip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 10px;border:1px solid var(--dsw-alias-border-secondary);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;text-decoration:none;transition:background .15s ease,border-color .15s ease}
      .dshDeskOnbLinkChip:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-primary,var(--dsw-alias-border-secondary))}
      .dshDeskOnbLinkChip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dshDeskOnbLinkIcon{flex:none;display:inline-flex;color:var(--dsw-alias-label-secondary)}
      @media (prefers-reduced-motion:reduce){.dshDeskOnbLinkChip{transition:none}}
      .dshDeskOnbHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}
      .dshDeskOnbActions{flex:none;display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
      @media (width<=560px){.dshDeskOnbContent{padding:20px}}
    `

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.dataset.plugin = 'dsh-desktop-onboarding'
      style.textContent = STYLE
      document.head.appendChild(style)
    }

    // ---------- locale dictionaries ----------

    const en = {
      brandName: 'LQ SI',
      brandBy: 'by：深秋的蝎子',
      step0Title: 'Introducing LQ SI · Lingqi Intelligent Agent',
      declarationBody: 'From office documents to code development, from data insights to business decisions, more capabilities await your discovery. AI empowers real enterprise work, with five built-in system workbenches including ERP and MES. Welcome to LQ SI, the Lingqi Intelligent Agent.',
      configureModel: 'Configure a model',
      later: 'Maybe later',
      saveFailed: 'Could not save your acknowledgment. Please try again.'
    }

    const zh = {
      brandName: 'LQ SI',
      brandBy: 'by：深秋的蝎子',
      step0Title: 'LQ SI 灵启智能体',
      declarationBody: '从办公文档到代码开发，从数据洞察到业务决策，更多能力等待您亲自解锁。AI 赋能企业落地，内置 ERP、MES 等五大系统连接工作台。欢迎使用灵启智能体。',
      configureModel: '去配置模型',
      later: '稍后再说',
      saveFailed: '未能保存确认，请重试。'
    }

    // ---------- components ----------

    function BrandHeader({ t }) {
      const height = 18
      return React.createElement(
        'div',
        { className: 'dshDeskOnbHeader' },
        React.createElement(
          'span',
          { className: 'dshDeskOnbBrandMark', 'aria-hidden': 'true' },
          React.createElement(
            'svg',
            {
              width: height * BRAND_MARK_VIEWBOX.width / BRAND_MARK_VIEWBOX.height,
              height,
              viewBox: BRAND_MARK_VIEWBOX.x + ' ' + BRAND_MARK_VIEWBOX.y + ' ' + BRAND_MARK_VIEWBOX.width + ' ' + BRAND_MARK_VIEWBOX.height,
              fill: 'none'
            },
            React.createElement('path', { d: BRAND_MARK_PATH, fill: 'currentColor' })
          )
        ),
        React.createElement('span', { className: 'dshDeskOnbBrandName' }, t('brandName')),
        React.createElement('span', { className: 'dshDeskOnbBrandBy' }, t('brandBy'))
      )
    }

    // The first-run LQ SI introduction requested by the product owner.
    function NoticeBody({ t }) {
      const paragraphs = t('declarationBody').split('\n\n')
      return React.createElement(
        'div',
        { className: 'dshDeskOnbBody' },
        paragraphs.map((paragraph, idx) =>
          React.createElement('p', { key: idx, className: 'dshDeskOnbParagraph' }, paragraph)
        )
      )
    }

    // The notice is blocking: implicit dismissal (Escape, backdrop) is ignored
    // so the user leaves through one of the two explicit actions.
    const ignoreImplicitDismiss = () => {}

    function onboardingDecision(value) {
      const acknowledged = typeof value?.wizardVersion === 'string' && value.wizardVersion.length > 0
      return value?.eligible === true && !acknowledged ? 'show' : 'complete'
    }

    // ---------- the first-run notice ----------

    function DesktopOnboardingNotice(props) {
      const { complete, openSection, t } = props
      const wizardScope = props.controller.scope
      const [decision, setDecision] = useState('loading')
      const [saving, setSaving] = useState(false)
      const [saveError, setSaveError] = useState(false)
      const titleRef = useRef(null)
      const finishedRef = useRef(false)

      // Persist the acknowledgement, then hand the onboarding slot back. The
      // optional follow-up runs after the slot is released (e.g. opening the
      // models settings section).
      const finish = useCallback(async (followUp) => {
        if (finishedRef.current) return
        finishedRef.current = true
        setSaving(true)
        setSaveError(false)
        try {
          const response = await fetch('/api/desktop-onboarding/acknowledge', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
          if (!response.ok || (await response.json()).acknowledged !== true) throw new Error('Acknowledgment was not saved')
          complete()
          if (followUp) followUp()
        } catch {
          finishedRef.current = false
          setSaving(false)
          setSaveError(true)
        }
      }, [complete])

      useEffect(() => {
        const read = () => {
          const snap = wizardScope.getSnapshot()
          // Wait for the Host section so returning users never see a flash.
          if (snap.mode !== 'memory' && snap.status === 'loading') return
          const value = snap.value ?? {}
          setDecision(onboardingDecision(value))
        }
        let unsubscribe
        try {
          unsubscribe = wizardScope.subscribe(read)
          read()
        } catch {
          // Scope errors are non-fatal: a failing scope must not block boot.
        }
        return () => { if (unsubscribe) unsubscribe() }
      }, [wizardScope])

      // Ineligible installs and every prior acknowledgement skip straight on.
      useEffect(() => {
        if (decision === 'complete' && !finishedRef.current) {
          finishedRef.current = true
          complete()
        }
      }, [decision, complete])

      const visible = decision === 'show'

      // Keep the application behind the dialog inert, like the stock notice.
      useEffect(() => {
        if (!visible) return
        const appRoot = document.getElementById('root')
        if (appRoot === null) return
        const previous = appRoot.inert
        appRoot.inert = true
        return () => { appRoot.inert = previous }
      }, [visible])

      useEffect(() => {
        if (visible) titleRef.current?.focus()
      }, [visible])

      if (!visible) return null

      return React.createElement(
        Modal,
        {
          open: true,
          title: t('step0Title'),
          onClose: ignoreImplicitDismiss,
          headless: true,
          className: 'dshDeskOnbDialog'
        },
        React.createElement(
          'div',
          { className: 'dshDeskOnbContent' },
          React.createElement(BrandHeader, { t }),
          React.createElement(
            'h2',
            { ref: titleRef, className: 'dshDeskOnbHeading', tabIndex: -1 },
            t('step0Title')
          ),
          React.createElement(NoticeBody, { t }),
          saveError ? React.createElement('p', { role: 'alert', className: 'dshDeskOnbHint' }, t('saveFailed')) : null,
          React.createElement(
            'div',
            { className: 'dshDeskOnbActions' },
            React.createElement(
              Button,
              { variant: 'outline', disabled: saving, onClick: () => finish() },
              t('later')
            ),
            React.createElement(
              Button,
              {
                variant: 'primary',
                disabled: saving,
                onClick: () => finish(() => {
                  if (typeof openSection === 'function') openSection(MODELS_SECTION_ID)
                })
              },
              t('configureModel')
            )
          )
        )
      )
    }

    // ---------- composition ----------

    function apply(ctx) {
      ctx.inject(['slots', 'locale', 'configForms'], (scope) => {
        installStyles()
        const t = scope.locale.bind(NS)

        const wizardScope = scope.configForms.get('dsh-desktop-onboarding')

        scope.locale.register(NS, { zh, en })

        const controller = { scope: wizardScope }

        // The stock welcome-notice / official-DeepSeek onboarding entries are
        // removed upstream by the settings-models patch (the desktop notice owns
        // first-run), so this notice registers under its own id — no shadowing.
        scope.slots.inject('settings.onboarding', () => scope.slots.register({
          name: 'settings.onboarding',
          id: 'dsh-desktop-onboarding',
          order: 0,
          inject: () => ({ controller, t })
        }, DesktopOnboardingNotice))
      })
    }

    const inject = []

    exports.apply = apply
    exports.inject = inject
    exports.onboardingDecision = onboardingDecision
    return module.exports
  }
})
