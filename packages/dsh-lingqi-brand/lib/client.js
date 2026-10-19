window.__ModuleLoader__.load({
	id: "dsh-lingqi-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;
		//#region LqAimfgMark —— LQ SI 图标（加载失败回退简写徽标）
		// The new app icon already includes its own margins and rounded red tile.
		const MARK_SCALE = 1;
		function LingQiMark(props) {
			const size = Math.round((props.size || 24) * MARK_SCALE);
			const [failed, setFailed] = React.useState(false);
			if (failed) {
				return h("span", {
					className: props.className,
					style: {
						width: size,
						height: size,
						flex: "none",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: Math.round(size * 0.3),
						background: "var(--dsw-alias-brand-primary, #D9232A)",
						color: "#ffffff",
						fontSize: Math.round(size * 0.56),
						fontWeight: 700,
						lineHeight: 1,
						fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
						userSelect: "none",
					},
				}, "LQ");
			}
			return h("img", {
				className: props.className,
				src: "/lingqi-brand/icon",
				alt: "LQ SI",
				draggable: false,
				onError: () => setFailed(true),
				style: {
					width: size,
					height: size,
					flex: "none",
					display: "inline-block",
					borderRadius: Math.round(size * 0.22),
					objectFit: "cover",
					userSelect: "none",
				},
			});
		}
		//#endregion
		//#region LqAimfgName —— 侧栏品牌字标
		function LingQiName() {
			return h("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 0,
					height: 24,
					minWidth: 0,
				},
			},
				h("span", {
					style: {
						fontSize: 15,
						fontWeight: 700,
						lineHeight: "24px",
						letterSpacing: "0.015em",
						fontFamily: '"Segoe UI", Arial, system-ui, sans-serif',
					},
				}, "LQ SI"),
			);
		}
		//#endregion
		//#region plugin —— Slot 替换 + LQ SI 品牌语言
		const inject = ["slots", "locale"];
		function apply(ctx) {
			const slots = ctx.slots;
			// 左上角品牌（single slot：动态注册条目替换官方注册）
			// priority:-1（2026-09-20）：dsh 0.1.5-rc.1 起官方 dsh-client-ui-brand-official
			// 以默认 priority 0 抢注 sidebar.brand.*，同优先级注册会抛错导致整个插件加载
			// 失败（主页回落 HARNESS）。slots 渲染按 priority 升序取最低者，-1 稳定遮蔽官方注册。
			slots.inject("sidebar.brand.mark", function* () {
				yield slots.register({ name: "sidebar.brand.mark", priority: -1 }, LingQiMark);
			});
			slots.inject("sidebar.brand.name", function* () {
				yield slots.register({ name: "sidebar.brand.name", priority: -1 }, LingQiName);
			});
			// 输入框上方 hero 图标（props: {size, className}，className 沿用原布局 class）
			slots.inject("conversation.hero.brand.mark", function* () {
				yield slots.register({ name: "conversation.hero.brand.mark", priority: -1 }, LingQiMark);
			});
			// Give the Chinese home-page headline and preview badge the enterprise brand copy.
			ctx.effect(
				() => {
					const removeLanguage = ctx.locale.addLanguage({ id: "zh-lq", label: "灵启 · 智达未来 定制版", fallback: "zh" });
					const removeDictionary = ctx.locale.register("conversation", "zh-lq", {
						"hero.headline": "灵启 · 智达未来",
						"hero.preview": "定制版",
					});
					ctx.locale.setLocale("zh-lq");
					return () => {
						removeDictionary();
						removeLanguage();
					};
				},
				"lingqi-brand: hero language",
			);
		}
		//#endregion
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
