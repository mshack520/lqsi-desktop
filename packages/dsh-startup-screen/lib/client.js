/**
 * dsh-startup-screen — 浏览器半侧（设置页「启动动画」）
 * ----------------------------------------------------------------------------
 * 以 dsh.client bundle 格式加载（手写 ModuleLoader bundle，无需构建）：
 * 在 DSH 设置里注册一个 `settings.section`，用来改启动动画的身份名称、
 * 权限等级、配色、速度、交互开关等等。
 *
 * 播放与设置数据由 LQ SI Electron 主进程管理；本插件只提供 DSH 内的设置页。
 * 注册 id 必须等于 loader entry 名
 * （dsh-startup-screen），否则 ModuleLoader 会报
 * "loaded without registering dsh-startup-screen"。
 */
window.__ModuleLoader__.load({
  id: 'dsh-startup-screen',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__ss_root{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__ss_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__ss_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_field{display:flex;flex-direction:column;gap:5px}',
      '.__ss_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__ss_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__ss_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__ss_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__ss_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:180px}',
      '.__ss_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__ss_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__ss_two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__ss_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__ss_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__ss_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_btn:disabled{opacity:.5;cursor:default}',
      '.__ss_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__ss_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__ss_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.__ss_preview{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ss_previewText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}'
    ].join('')
    var tagId = 'dsh-startup-screen/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-startup-screen'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__ss_hint' }, props.hint) : null
      )
    }

    function TextInput(props) {
      return h('input', {
        className: '__ss_input' + (props.mono ? ' __ss_inputMono' : ''),
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function PasswordInput(props) {
      return h('input', {
        className: '__ss_input',
        type: 'password',
        value: props.value || '',
        placeholder: props.placeholder || '',
        maxLength: 64,
        autoComplete: props.autoComplete || 'off',
        onChange: (e) => props.onChange(e.target.value),
        onKeyDown: props.onKeyDown
      })
    }

    function Select(props) {
      return h('select', {
        className: '__ss_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }

    function Check(props) {
      return h('label', { className: '__ss_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          disabled: !!props.disabled,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__ss_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__ss_hint' }, props.hint) : null
        )
      )
    }

    function ColorInput(props) {
      return h('input', {
        className: '__ss_swatch',
        type: 'color',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Range(props) {
      return h('div', { className: '__ss_row' },
        h('input', {
          type: 'range',
          min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 200px' },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__ss_status' }, props.display)
      )
    }

    /* ── 语音：读系统里可用的音色，女声排在前面 ─────────────────────────── */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred',
      'male', 'yunxi', 'yunjian', 'kangkang']

    function hits(name, list) {
      for (var i = 0; i < list.length; i++) if (name.indexOf(list[i]) !== -1) return true
      return false
    }
    /** 神经网络音色优先，其次女声，最后剔掉男声 —— 和运行时 splash.js 的打分口径一致 */
    function scoreVoice(name, lang, want) {
      var sc = 0
      if (hits(name, NATURAL_HINTS)) sc += 60
      if (hits(name, FEMALE_HINTS)) sc += 40
      if (hits(name, MALE_HINTS)) sc -= 45
      if (String(lang || '').indexOf(want) === 0) sc += 25
      return sc
    }

    function readVoices() {
      try {
        var s = window.speechSynthesis
        if (!s || typeof s.getVoices !== 'function') return []
        var list = s.getVoices() || []
        var want = 'en'
        var scored = list.map(function (v, i) {
          var name = String(v.name || '').toLowerCase()
          return {
            v: v,
            natural: hits(name, NATURAL_HINTS),
            female: hits(name, FEMALE_HINTS),
            sc: scoreVoice(name, String(v.lang || '').toLowerCase(), want),
            i: i
          }
        })
        scored.sort(function (a, b) {
          if (a.sc !== b.sc) return b.sc - a.sc
          return a.i - b.i
        })
        return scored.map(function (x) { return x.v })
      } catch (e) { return [] }
    }

    function speakSample(text, draft) {
      try {
        var s = window.speechSynthesis
        if (!s) return false
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(text || 'Access permission required.')
        var list = readVoices()
        var target = null
        for (var i = 0; i < list.length; i++) if (list[i].name === draft.voiceName) target = list[i]
        if (target) { u.voice = target; u.lang = target.lang }
        u.rate = Math.min(2, Math.max(0.5, Number(draft.voiceRate) || 1))
        u.pitch = Math.min(2, Math.max(0, Number(draft.voicePitch) || 1))
        u.volume = Math.min(1, Math.max(0, Number(draft.voiceVolume) || 0.9))
        if (draft.voiceLang === 'zh') { u.text = '需要访问许可，验证通过。'; u.lang = 'zh-CN' }
        s.speak(u)
        return true
      } catch (e) { return false }
    }

    function VoicePicker(props) {
      var [list, setList] = react.useState(readVoices)
      react.useEffect(function () {
        var s = window.speechSynthesis
        if (!s) return
        var on = function () { setList(readVoices()) }
        try { s.addEventListener('voiceschanged', on) } catch (e) {}
        var t = setTimeout(on, 400)
        return function () {
          try { s.removeEventListener('voiceschanged', on) } catch (e) {}
          clearTimeout(t)
        }
      }, [])
      var auto = window.__DSH_STARTUP_API__ && window.__DSH_STARTUP_API__.voice
      var opts = [['', '自动（优先神经网络女声）' + (auto ? ' → ' + auto : '')]].concat(
        list.map(function (v) {
          var name = String(v.name || '').toLowerCase()
          var mark = hits(name, NATURAL_HINTS) ? '★ ' : (hits(name, FEMALE_HINTS) ? '♀ ' : '')
          return [v.name, mark + v.name + ' · ' + (v.lang || '')]
        })
      )
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, '音色'),
        h('div', { className: '__ss_row' },
          h(Select, { value: props.value || '', options: opts, onChange: props.onChange }),
          h('button', {
            className: '__ss_btn',
            type: 'button',
            onClick: props.onPreview
          }, '试听')
        ),
        h('div', { className: '__ss_hint' },
          list.length
            ? '★ = 神经网络音色（念长句自然，推荐）；♀ = 女声但多为老式拼接合成，念长句会发塑料。'
              + '共 ' + list.length + ' 个，已按"神经网络 → 女声 → 排除男声"排好序。'
            : '这台机器暂时读不到系统音色（浏览器可能要等 voiceschanged，或系统没装英语语音包）。'
        )
      )
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    /* 主进程负责提供正式默认值；这里只用于绘制尚未解锁时的骨架状态。 */
    var FALLBACK = {
      enabled: true, mode: 'always', theme: 'light', speed: 1, requireInteraction: true,
      allowSkip: false, sound: false, voice: false, voiceCue: false,
      identity: 'LQ SI 用户', identityId: 'LQSI-001', accessLevel: '1',
      brand1: 'LQ SI', brand2: 'SMART INTELLIGENCE', brand3a: 'DSH', brand3b: 'DESKTOP',
      welcomeBox: 'LQ SI DESKTOP', footer: 'POWERED BY LQ SI',
      accent: '#d92d39', glitchA: '#d92d39', glitchB: '#3677d5'
    }
    function num(v, d) {
      var n = Number(v)
      return isFinite(n) ? n : d
    }

    /* 设置页版本标记。 */
    var FALLBACK_VERSION = '1.1.0'

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [defaults, setDefaults] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [version] = react.useState(FALLBACK_VERSION)
      var [settingsAuthorized, setSettingsAuthorized] = react.useState(false)
      var [unlockPassword, setUnlockPassword] = react.useState('')
      var [unlockBusy, setUnlockBusy] = react.useState(false)
      var [unlockError, setUnlockError] = react.useState('')
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      var [authSettings, setAuthSettings] = react.useState(null)
      var [authBusy, setAuthBusy] = react.useState(false)
      var [authMessage, setAuthMessage] = react.useState('')
      var [authMessageIsError, setAuthMessageIsError] = react.useState(false)
      var [autoLaunchSettings, setAutoLaunchSettings] = react.useState(null)
      var [autoLaunchBusy, setAutoLaunchBusy] = react.useState(false)
      var [currentPassword, setCurrentPassword] = react.useState('')
      var [newPassword, setNewPassword] = react.useState('')
      var [confirmPassword, setConfirmPassword] = react.useState('')

      function load() {
        setError(null)
        var api = window.dshDesktop
        if (!api || typeof api.getStartupAnimationSettings !== 'function') {
          setError('设置接口不可用，请重新启动 LQ SI。')
          return Promise.resolve()
        }
        return api.getStartupAnimationSettings()
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setDefaults(Object.assign({}, FALLBACK, j.defaults))
            setFile(j.file || '')
          })
          .catch((e) => setError('读取配置失败：' + settingsErrorText(e)))
      }

      function unlockSettings() {
        var api = window.dshDesktop
        if (!api || typeof api.authorizeStartupSettings !== 'function') {
          setUnlockError('设置验证服务不可用，请重新启动 LQ SI。')
          return
        }
        if (!unlockPassword) { setUnlockError('请输入当前启动口令。'); return }
        setUnlockBusy(true); setUnlockError('')
        api.authorizeStartupSettings(unlockPassword).then((result) => {
          setUnlockPassword('')
          if (!result || result.ok !== true) throw new Error((result && result.error) || '验证失败')
          setSettingsAuthorized(true)
          load()
          loadAuthSettings()
          loadAutoLaunchSettings()
        }).catch((e) => {
          setUnlockError(String(e && e.message ? e.message : e))
        }).then(() => setUnlockBusy(false))
      }

      function settingsErrorText(error) {
        var message = String(error && error.message ? error.message : error)
        if (message.indexOf('设置授权已过期') !== -1) {
          setSettingsAuthorized(false)
          setUnlockError(message)
        }
        return message
      }
      function loadAuthSettings() {
        var api = window.dshDesktop
        if (!api || typeof api.getStartupAuthSettings !== 'function') {
          setAuthMessage('口令设置仅在 LQ SI 桌面版中可用。')
          setAuthMessageIsError(true)
          return
        }
        api.getStartupAuthSettings().then((result) => {
          if (!result || result.ok !== true) throw new Error((result && result.error) || '读取失败')
          setAuthSettings({ autoLogin: result.autoLogin === true })
          setAuthMessage('')
        }).catch((e) => {
          setAuthMessage(settingsErrorText(e))
          setAuthMessageIsError(true)
        })
      }

      function loadAutoLaunchSettings() {
        var api = window.dshDesktop
        if (!api || typeof api.getAutoLaunchSettings !== 'function') return
        api.getAutoLaunchSettings().then((result) => {
          if (!result || result.ok !== true) throw new Error((result && result.error) || '读取失败')
          setAutoLaunchSettings({ enabled: result.enabled === true })
        }).catch((e) => {
          setAuthMessage(settingsErrorText(e))
          setAuthMessageIsError(true)
        })
      }

      react.useEffect(() => {}, [])

      function toggleAutoLaunch(enabled) {
        var api = window.dshDesktop
        if (!api || typeof api.setAutoLaunchEnabled !== 'function') return
        setAutoLaunchBusy(true); setAuthMessage(''); setAuthMessageIsError(false)
        api.setAutoLaunchEnabled(enabled).then((result) => {
          if (!result || result.ok !== true) throw new Error((result && result.error) || '保存失败')
          setAutoLaunchSettings({ enabled: result.enabled === true })
          setAuthMessage(enabled ? '已开启开机启动。' : '已关闭开机启动。')
        }).catch((e) => {
          setAuthMessage(settingsErrorText(e))
          setAuthMessageIsError(true)
        }).then(() => setAutoLaunchBusy(false))
      }

      function toggleAutoLogin(enabled) {
        var api = window.dshDesktop
        if (!api || typeof api.setStartupAutoLogin !== 'function') return
        setAuthBusy(true); setAuthMessage(''); setAuthMessageIsError(false)
        api.setStartupAutoLogin(enabled).then((result) => {
          if (!result || result.ok !== true) throw new Error((result && result.error) || '保存失败')
          setAuthSettings({ autoLogin: result.autoLogin === true })
          setAuthMessage(enabled ? '已开启自动验证。' : '已关闭自动验证。')
        }).catch((e) => {
          setAuthMessage(settingsErrorText(e))
          setAuthMessageIsError(true)
        }).then(() => setAuthBusy(false))
      }

      function changeStartupPassword() {
        var api = window.dshDesktop
        if (!api || typeof api.changeStartupPassword !== 'function') return
        if (!currentPassword || !newPassword || !confirmPassword) {
          setAuthMessage('请填写原始口令、新口令和确认口令。')
          setAuthMessageIsError(true)
          return
        }
        if (newPassword.length > 64) {
          setAuthMessage('新口令不能超过 64 个字符。')
          setAuthMessageIsError(true)
          return
        }
        if (newPassword !== confirmPassword) {
          setAuthMessage('两次输入的新口令不一致。')
          setAuthMessageIsError(true)
          return
        }
        setAuthBusy(true); setAuthMessage(''); setAuthMessageIsError(false)
        api.changeStartupPassword(currentPassword, newPassword).then((result) => {
          if (!result || result.ok !== true) throw new Error((result && result.error) || '修改失败')
          setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
          setAuthSettings({ autoLogin: result.autoLogin === true })
            setUnlockError('启动口令已修改，请使用新口令重新验证设置。')
            setSettingsAuthorized(false)
        }).catch((e) => {
          setAuthMessage(settingsErrorText(e))
          setAuthMessageIsError(true)
        }).then(() => setAuthBusy(false))
      }

      function set(key, value) {
        setNotice(null)
        setDraft((d) => Object.assign({}, d, { [key]: value }))
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        var api = window.dshDesktop
        if (!api || typeof api.updateStartupAnimationSettings !== 'function') {
          setError('设置接口不可用，请重新启动 LQ SI。'); setBusy(false); return
        }
        api.updateStartupAnimationSettings(draft)
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(j.config)
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看效果。')
          })
          .catch((e) => setError('保存失败：' + settingsErrorText(e)))
          .then(() => setBusy(false))
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        var api = window.dshDesktop
        if (!api || typeof api.resetStartupAnimationSettings !== 'function') {
          setError('设置接口不可用，请重新启动 LQ SI。'); setBusy(false); return
        }
        api.resetStartupAnimationSettings()
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(j.config)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + settingsErrorText(e)))
          .then(() => setBusy(false))
      }

      function preview() {
        var api = window.dshDesktop
        if (!api || typeof api.previewStartupAnimation !== 'function') {
          setError('预览接口不可用，请重新启动 LQ SI。')
          return
        }
        api.previewStartupAnimation().catch((e) => setError('预览失败：' + settingsErrorText(e)))
      }

      /* 版本号常驻顶部，不进骨架屏 —— 它不依赖配置接口，
         接口挂了也该看得见当前装的是哪一版。 */
      var versionLine = h('div', { className: '__ss_version' }, '版本 v' + (version || FALLBACK_VERSION))

      if (!settingsAuthorized) {
        return h('div', { className: '__ss_root' },
          versionLine,
          h('div', { className: '__ss_group' },
            h('div', { className: '__ss_groupTitle' }, '启动动画设置验证'),
            h('div', { className: '__ss_hint' }, '修改启动动画设置前，请输入当前启动口令。首次安装默认口令为 mshack；如果已经修改，请输入新口令。'),
            h(Field, { label: '当前启动口令' },
              h(PasswordInput, {
                value: unlockPassword,
                autoComplete: 'current-password',
                onChange: setUnlockPassword,
                onKeyDown: (event) => { if (event.key === 'Enter') unlockSettings() }
              })),
            h('div', { className: '__ss_actions' },
              h('button', { className: '__ss_btn __ss_btnPrimary', type: 'button', disabled: unlockBusy, onClick: unlockSettings }, unlockBusy ? '正在验证…' : '验证并进入设置'),
              unlockError ? h('span', { className: '__ss_err', role: 'status', 'aria-live': 'polite' }, unlockError) : null
            )
          )
        )
      }

      if (!draft) {
        return h('div', { className: '__ss_root' },
          versionLine,
          h('div', { className: '__ss_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__ss_actions' },
            h('button', { className: '__ss_btn', onClick: load }, '重试')
          ) : null
        )
      }

      return h('div', { className: '__ss_root' },
        versionLine,

        /* 启动验证 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '启动验证'),
          h('div', { className: '__ss_hint' }, 'LQ SI 启动动画和身份口令验证已固定开启，每次启动均需验证。'),
          h(Field, { label: '速度倍率', hint: '0.35 慢放 · 1 原速 · 3 快放；参考片时长约 27 秒，默认整套约 16 秒。' },
            h('div', { className: '__ss_row' },
              h('input', {
                type: 'range', min: 0.35, max: 3, step: 0.05,
                value: draft.speed,
                style: { flex: '1 1 240px' },
                onChange: (e) => set('speed', Number(e.target.value))
              }),
              h('span', { className: '__ss_status' }, Number(draft.speed).toFixed(2) + '×')
            )
          ),
          h('div', { className: '__ss_groupTitle', style: { marginTop: '14px' } }, '启动口令'),
          h(Check, {
            label: '开机启动 LQ SI',
            hint: '登录 Windows 后自动打开 LQ SI。',
            checked: !!(autoLaunchSettings && autoLaunchSettings.enabled),
            disabled: autoLaunchBusy || !autoLaunchSettings,
            onChange: toggleAutoLaunch
          }),
          h(Check, {
            label: '启动时自动输入口令',
            hint: '开启后将使用系统加密保存的口令自动完成身份验证。',
            checked: !!(authSettings && authSettings.autoLogin),
            disabled: authBusy || !authSettings,
            onChange: toggleAutoLogin
          }),
          h('div', { className: '__ss_two' },
            h(Field, { label: '原始口令' },
              h(PasswordInput, { value: currentPassword, autoComplete: 'current-password', onChange: setCurrentPassword })),
            h(Field, { label: '新口令' },
              h(PasswordInput, { value: newPassword, autoComplete: 'new-password', onChange: setNewPassword }))
          ),
          h(Field, { label: '确认新口令' },
            h(PasswordInput, { value: confirmPassword, autoComplete: 'new-password', onChange: setConfirmPassword })),
          h('div', { className: '__ss_row' },
            h('button', {
              className: '__ss_btn __ss_btnPrimary',
              type: 'button',
              disabled: authBusy,
              onClick: changeStartupPassword
            }, authBusy ? '正在保存…' : '修改启动口令'),
            authMessage ? h('span', {
              className: authMessageIsError ? '__ss_err' : '__ss_ok',
              role: 'status',
              'aria-live': 'polite'
            }, authMessage) : null
          )
        ),

        /* 身份 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '身份资料'),
          h(Field, {
            label: '身份名称',
            hint: '终幕「欢迎 xxx 访问 / WELCOME, XXX」里的 xxx，也出现在第二步的身份卡上。'
          }, h(TextInput, { value: draft.identity, placeholder: '例如：JOYCE MOORE', onChange: (v) => set('identity', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '身份编号', hint: '显示在第二步身份卡上，建议用数字（如 0087）。' },
              h(TextInput, { value: draft.identityId, mono: true, onChange: (v) => set('identityId', v) })),
            h(Field, { label: '权限等级' },
              h(TextInput, { value: draft.accessLevel, mono: true, onChange: (v) => set('accessLevel', v) }))
          )
        ),

        /* 交互 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '交互'),
          h(Check, {
            label: '需要人工确认',
            hint: '第 1、2 步停下来等按钮 / Enter / 空格；关闭则整段自动播放。',
            checked: draft.requireInteraction,
            onChange: (v) => set('requireInteraction', v)
          }),
          h('div', { className: '__ss_hint' }, '身份口令验证不可跳过；启动动画不播放英文旁白和音效。')
        ),

        /* 视觉 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '视觉'),
          h('div', { className: '__ss_hint' }, '启动动画自动跟随 DSH 当前的浅色或深色主题。'),
          h('div', { className: '__ss_two' },
            h(Field, { label: '强调色 · 橙' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.accent, onChange: (v) => set('accent', v) }),
                h('span', { className: '__ss_status' }, draft.accent)
              )
            ),
            h(Field, { label: '故障色 · 蓝' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.glitchB, onChange: (v) => set('glitchB', v) }),
                h('span', { className: '__ss_status' }, draft.glitchB)
              )
            )
          )
        ),

        /* 文案 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '文案'),
          h('div', { className: '__ss_two' },
            h(Field, { label: '左上 · 主标题' }, h(TextInput, { value: draft.brand1, onChange: (v) => set('brand1', v) })),
            h(Field, { label: '左上 · 产品行' },
              h('div', { className: '__ss_row' },
                h(TextInput, { value: draft.brand3a, onChange: (v) => set('brand3a', v) }),
                h('span', { className: '__ss_status' }, '+'),
                h(TextInput, { value: draft.brand3b, onChange: (v) => set('brand3b', v) })
              )
            )
          ),
          h(Field, { label: '左上 · 副标题' }, h(TextInput, { value: draft.brand2, maxLength: 40, onChange: (v) => set('brand2', v) })),
          h(Field, { label: '终幕 · 黑框' }, h(TextInput, { value: draft.welcomeBox, onChange: (v) => set('welcomeBox', v) })),
          h(Field, { label: '右下 · 页脚' }, h(TextInput, { value: draft.footer, mono: true, onChange: (v) => set('footer', v) }))
        ),

        /* 预览 + 操作 */
        h('div', { className: '__ss_preview' },
          h('div', { className: '__ss_previewText' },
            '预览会按当前「已保存」的配置重播一次。想先看新配置，先点保存再预览。',
            file ? h('div', { style: { marginTop: '4px', opacity: 0.75 } }, '配置文件：' + file) : null
          ),
          h('button', { className: '__ss_btn', onClick: preview }, '立即预览')
        ),

        h('div', { className: '__ss_actions' },
          h('button', {
            className: '__ss_btn __ss_btnPrimary',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__ss_ok' }, notice) : null,
          error ? h('span', { className: '__ss_err' }, error) : null
        )
      )
    }

    /* ── 插件：只提供设置页，动画由 LQ SI Electron 启动窗口播放 ────────── */
    var inject = ['slots', 'theme']
    var lastThemeSync = ''

    function syncTheme(snapshot) {
      if (!snapshot || !snapshot.active) return
      var preference = snapshot.preference
      if (preference !== 'light' && preference !== 'dark' && preference !== 'system') return
      if (preference === lastThemeSync) return
      lastThemeSync = preference
      try {
        var bridge = window.dshDesktop
        if (bridge && typeof bridge.setLinkedThemePreference === 'function') {
          Promise.resolve(bridge.setLinkedThemePreference(preference)).catch(function () {})
        }
      } catch (e) { /* Theme persistence must not interfere with the DSH UI. */ }
    }

    function apply(ctx) {
      if (ctx.theme && typeof ctx.theme.getTheme === 'function') syncTheme(ctx.theme.getTheme())
      if (typeof ctx.on === 'function') ctx.on('theme/change', syncTheme)
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'startup-screen', order: 26, label: '启动动画' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})


