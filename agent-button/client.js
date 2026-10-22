window.__ModuleLoader__.load({
  id: 'oh-my-dsh-agent-button',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ── omo seat display data ────────────────────────────────────────────
    // The seat list AND the current seat come from the Host's `omoSeats`
    // projection (the omo seats are not agent presets), so a refresh or a
    // session switch re-syncs from the Host instead of local memory. These
    // entries only supply the curated icon and the Chinese one-liner; a seat
    // missing here falls back to the label the projection carries.
    const AGENTS = {
      orchestrator: { name: 'Orchestrator', icon: '◎', zh: '总管 · 规划 / 派发 / 整合', en: 'Orchestrator · plan, delegate, reconcile' },
      explorer: { name: 'Explorer', icon: '⌕', zh: '只读侦察 · 代码库 + 外部调研', en: 'Explorer · read-only recon and research' },
      fixer: { name: 'Fixer', icon: '✎', zh: '有界实现 · 多文件机械修改', en: 'Fixer · bounded implementation' },
      oracle: { name: 'Oracle', icon: '◈', zh: '战略顾问 · 架构 / 审查 / 调试', en: 'Oracle · architecture, review, debugging' },
      designer: { name: 'Designer', icon: '✿', zh: 'UI/UX 专家 · 视觉实现与打磨', en: 'Designer · UI/UX implementation' },
      council: { name: 'Council', icon: '⚖', zh: '多模型共识 · 综合裁决', en: 'Council · multi-model consensus' },
      councillor: { name: 'Councillor', icon: '⬡', zh: '议员席 · 只读独立评议', en: 'Councillor · read-only council seat' },
      observer: { name: 'Observer', icon: '◉', zh: '视觉分析 · 图像 / PDF / 图表', en: 'Observer · visual analysis' },
    };

    // ── the omoSeatModels Remote contribution (inlined) ───────────────────
    // Mirrors model-settings/lib/typert.client.js. Client plugins cannot
    // require sibling files through the ModuleLoader's table (only platform
    // seeds and registered modules resolve), so the contribution rides here.
    // The Host validates every argument and result with strict zod codecs;
    // the client registry only needs a create() factory per codec and never
    // invokes it, so the pass-through stub keeps the browser graph
    // dependency-free.
    const passthrough = () => ({ parse: (value) => value });
    const TYPERT_REMOTE = {
      package: 'oh-my-dsh',
      descriptors: ['getState', 'getCatalog', 'update'].map((method) => ({
        id: `oh-my-dsh#omoSeatModels/${method}`,
        service: 'omoSeatModels',
        namespace: 'omoSeatModels',
        method,
        implementation: method,
        invocation: { kind: 'direct' },
        cancellation: { parameter: 'signal' },
        parameters: [
          {
            name: 'request',
            wire: 'request',
            source: 'json',
            codec: { mode: 'strict', typeSymbol: `oh-my-dsh#omoSeatModels/${method}:request`, create: passthrough },
          },
        ],
        result: { mode: 'strict', typeSymbol: `oh-my-dsh#omoSeatModels/${method}:result`, create: passthrough },
      })),
    };

    const DICT = {
      zh: {
        lang: 'zh',
        chip: 'Agent',
        seat: 'omo 席位',
        tooltip: 'omo 席位 · 点击切换',
        outsideTooltip: 'omo 席位 · 当前会话不在 omo 平面',
        outside: '当前会话不在 omo 平面，点选任一席位进入',
        popupTitle: 'omo 席位',
        empty: '当前没有可用的 omo 席位',
        busy: '切换中…',
        refused: '切换被拒绝：',
        notApplied: '切换未被应用（席位运行时未装上），请改用 /preset ',
        hint: 'standard / cordis 等预设请用预设选择器',
        current: '当前',
        noSession: '没有可切换的会话',
        modelLine: '派工默认',
        inheritLabel: '跟随父会话',
        overrideBadge: '用户覆盖',
        defaultBadge: '席位默认',
        editButton: '模型',
        editTitle: '派工默认模型',
        choiceDefault: '席位默认',
        choiceDefaultDesc: '用席位定义里的默认；席位未配则跟随父会话',
        choiceInherit: '跟随父会话',
        choiceInheritDesc: '忽略席位默认，跟随当前会话的模型',
        choiceSpecify: '指定模型',
        choiceSpecifyDesc: '每次派这个席都用指定路由',
        providerLabel: 'Provider',
        modelLabel: '模型',
        providerPlaceholder: '例如 minimax-cn',
        modelPlaceholder: '例如 MiniMax-M3.1-Flash',
        modeCatalog: '从目录选择',
        modeManual: '手动输入',
        chooseProvider: '请选择 provider',
        chooseModel: '请选择模型',
        catalogNote: '目录来自当前宿主；未列出的路由可切到「手动输入」。',
        catalogEmpty: '当前宿主没有已注册的 provider',
        unregisteredSuffix: '（未注册）',
        unlistedSuffix: '（目录未列出）',
        catalogFailureSuffix: '（目录获取失败）',
        officialBlockedSuffix: ' · 官方工具未放行',
        routeRequired: '请填写完整的 provider 与 model（两者必须成对）',
        save: '保存',
        cancel: '取消',
        saving: '保存中…',
        failed: '保存失败：',
        conflict: '配置已在别处更改，请刷新弹层后重试',
        fixedNote: '只影响以后派出的 lane，不改变当前对话模型。',
        catalogLoading: '目录加载中…',
        catalogFailed: '目录加载失败（仍可手填）',
      },
      en: {
        lang: 'en',
        chip: 'Agent',
        seat: 'omo seat',
        tooltip: 'omo seat · click to switch',
        outsideTooltip: 'omo seat · this session is outside the omo plane',
        outside: 'This session is outside the omo plane — pick a seat to enter it',
        popupTitle: 'omo seats',
        empty: 'No omo seats available',
        busy: 'Switching…',
        refused: 'Switch refused: ',
        notApplied: 'Switch was not applied (the seat runtime did not mount); use /preset ',
        hint: 'For standard / cordis and other presets use the preset picker',
        current: 'current',
        noSession: 'No session to switch',
        modelLine: 'Dispatch default',
        inheritLabel: 'Follow parent session',
        overrideBadge: 'user override',
        defaultBadge: 'seat default',
        editButton: 'Model',
        editTitle: 'Dispatch default model',
        choiceDefault: 'Seat default',
        choiceDefaultDesc: 'Use the seat definition’s default; without one the lane inherits the parent route',
        choiceInherit: 'Follow parent session',
        choiceInheritDesc: 'Ignore the seat default and follow the session’s model',
        choiceSpecify: 'Specify model',
        choiceSpecifyDesc: 'Every dispatch of this seat uses the named route',
        providerLabel: 'Provider',
        modelLabel: 'Model',
        providerPlaceholder: 'e.g. minimax-cn',
        modelPlaceholder: 'e.g. MiniMax-M3.1-Flash',
        modeCatalog: 'Pick from catalog',
        modeManual: 'Type manually',
        chooseProvider: 'Choose a provider',
        chooseModel: 'Choose a model',
        catalogNote: 'Catalog from the current host; unlisted routes can be typed manually.',
        catalogEmpty: 'This host has no registered providers',
        unregisteredSuffix: ' (not registered)',
        unlistedSuffix: ' (not in catalog)',
        catalogFailureSuffix: ' (catalog failed)',
        officialBlockedSuffix: ' · official tool blocked',
        routeRequired: 'provider and model must both be filled (they travel as a pair)',
        save: 'Save',
        cancel: 'Cancel',
        saving: 'Saving…',
        failed: 'Save failed: ',
        conflict: 'The override changed elsewhere — reopen the panel and retry',
        fixedNote: 'Affects only future lane dispatches; the current conversation model is unchanged.',
        catalogLoading: 'Loading catalog…',
        catalogFailed: 'Catalog unavailable (hand-entry still works)',
      },
    };

    // Theme-driven stylesheet: only --dsw-alias-* tokens are referenced, so
    // light/dark and theme changes inherit automatically. Own controls only
    // (no host primitives imported), per the UI plugin rules.
    const CSS = `
.omo-ab-wrap { position: relative; display: inline-flex; }
.omo-ab-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; line-height: 1; cursor: pointer;
  max-width: 220px;
}
.omo-ab-chip:hover { background: var(--dsw-alias-bg-layer-2); }
.omo-ab-chip:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.omo-ab-chip[aria-expanded="true"] { border-color: var(--dsw-alias-border-l2); }
.omo-ab-chip .omo-ab-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.omo-ab-chevron { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.omo-ab-catch { position: fixed; inset: 0; z-index: 55; }
.omo-ab-popup {
  min-width: 250px; max-width: 320px; max-height: min(640px, 84vh);
  overflow-y: auto; padding: 6px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
}
.omo-ab-title { padding: 5px 8px 3px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.omo-ab-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 8px; border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; text-align: left; cursor: pointer;
}
.omo-ab-row:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.omo-ab-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.omo-ab-row[aria-selected="true"] { color: var(--dsw-alias-brand-primary); }
.omo-ab-row:disabled { cursor: default; }
.omo-ab-icon { width: 14px; text-align: center; flex: none; }
.omo-ab-rowbody { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.omo-ab-desc { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.omo-ab-badge { font-size: 10px; color: var(--dsw-alias-label-secondary); flex: none; }
.omo-ab-err { padding: 6px 8px 2px; font-size: 11px; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; }
.omo-ab-hint { padding: 5px 8px 3px; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.omo-ab-rowwrap { display: flex; align-items: flex-start; gap: 4px; }
.omo-ab-rowwrap .omo-ab-row { flex: 1; min-width: 0; }
.omo-ab-model { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.omo-ab-edit {
  flex: none; align-self: center; height: 24px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 11px; cursor: pointer;
}
.omo-ab-edit:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.omo-ab-edit:disabled { cursor: default; opacity: 0.5; }
.omo-ab-choice {
  display: flex; gap: 8px; align-items: flex-start; width: 100%;
  padding: 6px 8px; border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; text-align: left; cursor: pointer;
}
.omo-ab-choice:hover { background: var(--dsw-alias-bg-layer-2); }
.omo-ab-choice input { margin-top: 2px; flex: none; }
.omo-ab-choicedesc { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.omo-ab-field { display: flex; flex-direction: column; gap: 3px; padding: 2px 8px 6px 26px; }
.omo-ab-input {
  height: 26px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px;
}
.omo-ab-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 0; }
.omo-ab-actions { display: flex; gap: 8px; justify-content: flex-end; padding: 6px 8px 2px; }
.omo-ab-save {
  height: 26px; padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; cursor: pointer;
}
.omo-ab-save:disabled { cursor: default; opacity: 0.5; }
.omo-ab-modes { display: flex; gap: 6px; padding: 2px 8px 6px 26px; }
.omo-ab-mode {
  padding: 3px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 11px; cursor: pointer;
}
.omo-ab-mode[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l2);
}
.omo-ab-mode:disabled { cursor: default; opacity: 0.4; }
select.omo-ab-input { padding-right: 6px; cursor: pointer; }
select.omo-ab-input:disabled { cursor: default; opacity: 0.6; }
`;

    // ── shared store (chip ↔ popup live in different slots) ──────────────
    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => state,
        subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
        set: (patch) => { state = { ...state, ...patch }; for (const fn of listeners) fn(); },
      };
    }

    function useStore(store, selector) {
      const [value, setValue] = React.useState(() => selector(store.getSnapshot()));
      React.useEffect(() => store.subscribe(() => setValue(selector(store.getSnapshot()))), [store]);
      return value;
    }

    // ── chip (the composer's left group, beside the access-mode control) ──
    // Placement is the user's call: the control lives in the composer row,
    // where the session is actually being driven. It is registered exactly
    // once — the header slot is deliberately not used, so the control never
    // sits beside the official mode chip.
    function buildChip(ctx, t, store) {
      return function AgentChip() {
        const current = useStore(store, (s) => s.current);
        const open = useStore(store, (s) => s.open);
        const names = useStore(store, (s) => s.names);

        // In the omo plane means the Host's current seat resolves in the
        // roster it just served — shipped seats AND user seats, exactly the
        // test the popup applies. Keying this off the local click history
        // instead (the old behavior) left the chip showing the neutral label
        // for a user seat while the popup marked that same seat current.
        const inOmo = Boolean(current) && names[current] !== undefined;
        const meta = current ? AGENTS[current] : undefined;
        // This control speaks only for the omo plane: a session seated in an
        // official preset shows the neutral label, never that preset's id or
        // name. Mode state belongs to the official preset picker.
        const chipLabel = meta ? meta.name : (inOmo ? (names[current] ?? current) : t('seat'));

        return h('div', { className: 'omo-ab-wrap' },
          h('button', {
            type: 'button',
            className: 'omo-ab-chip',
            title: inOmo ? t('tooltip') : t('outsideTooltip'),
            'aria-haspopup': 'listbox',
            'aria-expanded': open,
            onClick: (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              store.set({
                open: !store.getSnapshot().open,
                anchor: { top: rect.top, bottom: rect.bottom, left: rect.left },
              });
            },
          },
            h('span', { className: 'omo-ab-icon' }, meta ? meta.icon : '◇'),
            h('span', { className: 'omo-ab-label' }, chipLabel),
            h('span', { className: 'omo-ab-chevron' }, '▾'),
          ),
        );
      };
    }

    // ── popup (registered in the frame-wide shell.overlay slot) ──────────
    // The row containers clip their children, so the popup lives in the
    // overlay layer and positions itself at the chip's measured anchor.
    function buildPopup(ctx, t, store, styleFallback) {
      return function AgentPopup() {
        const open = useStore(store, (s) => s.open);
        const anchor = useStore(store, (s) => s.anchor);
        const current = useStore(store, (s) => s.current);
        const modelsReady = useStore(store, (s) => s.modelsReady);
        const [roster, setRoster] = React.useState([]);
        const [sessionId, setSessionId] = React.useState(undefined);
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        // Seat dispatch-default model preferences, straight from the Host's
        // omoSeatModels Remote (seat-keyed, not session-keyed).
        const [models, setModels] = React.useState({});
        const [editing, setEditing] = React.useState(null);
        const [catalog, setCatalog] = React.useState(null);
        const [catalogState, setCatalogState] = React.useState('idle');
        const [editError, setEditError] = React.useState('');
        const [saving, setSaving] = React.useState(false);
        const [choice, setChoice] = React.useState('default');
        const [route, setRoute] = React.useState({ provider: '', model: '' });
        // How the "specify model" route is being edited: pick from the host's
        // catalog, or type the pair by hand. Hand entry stays reachable because
        // the override file is shared per DSH_HOME across profiles (a provider
        // registered in another profile is not in this catalog) and because
        // catalog membership is advisory, not the routable set.
        const [routeMode, setRouteMode] = React.useState('catalog');
        const sessionIdRef = React.useRef(undefined);
        const generation = React.useRef(0);

        /** Unwrap the Remote envelope ({ok, value/error}) around the business value. */
        const valueOf = (response) => {
          if (response && response.ok === false) return undefined;
          const value = response?.value ?? response;
          return value && value.protocolVersion === 1 ? value : undefined;
        };

        // Re-read the merged per-seat snapshot. Late responses are dropped by
        // generation so a slow read can never overwrite a fresher context
        // (design §5.2); a read failure just keeps the previous snapshot.
        const refreshModels = React.useCallback(async () => {
          const api = ctx.remote.omoSeatModels;
          if (!store.getSnapshot().modelsReady || !api) return;
          const gen = ++generation.current;
          try {
            const value = valueOf(await api.getState({ sessionId: sessionIdRef.current }));
            if (gen === generation.current && value) setModels(bySeat(value.seats));
          } catch { /* keep the previous snapshot */ }
        }, [store]);

        const loadCatalog = React.useCallback(async () => {
          const api = ctx.remote.omoSeatModels;
          if (!store.getSnapshot().modelsReady || !api) return;
          if (catalogState === 'loading' || catalogState === 'ready') return;
          setCatalogState('loading');
          try {
            const value = valueOf(await api.getCatalog({ sessionId: sessionIdRef.current }));
            if (value) { setCatalog(value); setCatalogState('ready'); }
            else setCatalogState('failed');
          } catch { setCatalogState('failed'); }
        }, [store, catalogState]);

        // Follow the session the main view currently shows (the same
        // main-view retention heuristic the shipped preset picker uses), and
        // read the omo seat plane from the Host's `omoSeats` projection — the
        // omo seats are not agent presets, so the preset registry no longer
        // knows about them.
        React.useEffect(() => {
          const sessions = ctx.get('sessions');
          if (!sessions) return undefined;
          const find = () => {
            const byId = sessions.list.getSnapshot().byId;
            for (const id of Object.keys(byId)) {
              const info = sessions.retainInfo(id).getSnapshot();
              if ((info.retainedBy?.mainView ?? 0) > 0) return byId[id];
            }
            return undefined;
          };
          const sync = () => {
            const session = find();
            setSessionId(session?.id);
            sessionIdRef.current = session?.id;
            // The projection carries the seat list AND the Host's current
            // seat for this session (folded from the official command and
            // preset-selection events). Reading it here — not the last
            // clicked value — is what re-syncs the chip after a refresh, a
            // session switch, or a `/preset` typed in the composer.
            const value = session?.projectionValues?.omoSeats;
            const roster = Array.isArray(value?.seats) ? value.seats : [];
            setRoster(roster);
            const names = {};
            for (const seat of roster) {
              if (typeof seat.id === 'string' && seat.label) names[seat.id] = seat.label;
            }
            store.set({ names, current: typeof value?.current === 'string' ? value.current : '' });
            void refreshModels();
          };
          sync();
          return sessions.list.subscribe(sync);
        }, [store, refreshModels]);

        // Refresh when the popup opens, lightly while it stays open, and on
        // window focus — the preferences can change under an open panel
        // (another window saved, the file was edited by hand).
        React.useEffect(() => { if (open) void refreshModels(); }, [open, refreshModels]);
        React.useEffect(() => {
          if (!open) return undefined;
          const timer = setInterval(() => { void refreshModels(); }, 5000);
          return () => clearInterval(timer);
        }, [open, refreshModels]);
        React.useEffect(() => {
          const onFocus = () => { if (store.getSnapshot().open) void refreshModels(); };
          window.addEventListener('focus', onFocus);
          return () => window.removeEventListener('focus', onFocus);
        }, [store, refreshModels]);

        // Escape closes the popup (and the editor first).
        React.useEffect(() => {
          if (!open) return undefined;
          const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (editing !== null) { setEditing(null); return; }
            store.set({ open: false });
          };
          window.addEventListener('keydown', onKey, true);
          return () => window.removeEventListener('keydown', onKey, true);
        }, [open, editing, store]);

        // The chip trusts the command's own answer: the Host applies the seat
        // synchronously inside the command, so a success answer means it landed.
        // The projection folds the command's own `command/run` event, so the
        // value read back from the Host agrees with this optimistic set — and
        // any later Host-side change (/preset in the composer, session switch)
        // arrives through the projection sync above.
        const select = async (id) => {
          if (!sessionId) { setError(t('noSession')); return; }
          setBusy(true);
          setError('');
          // Every seat in this roster is an omo seat, and omo seats are not
          // agent presets — the registry's select cannot resolve them. Run the
          // /preset command on the Host instead: it applies the seat through
          // the omo seat runtime.
          try {
            const result = await ctx.remote.commands.execute(sessionId, `/preset ${id}`, []);
            if (result && result.ok === false) {
              setError(t('refused') + (result.error?.message ?? ''));
              return;
            }
            // The command plane wraps the handler's answer one level deeper:
            // {ok:true, value:{commandId, result:{kind, text}}}.
            const execution = result?.value ?? result;
            const outcome = execution?.result ?? execution;
            if (outcome && outcome.kind === 'error') {
              setError(t('refused') + (outcome.text ?? ''));
              return;
            }
            store.set({ current: id, open: false });
          } catch (e) {
            setError(t('refused') + String(e?.message ?? e));
          } finally {
            setBusy(false);
          }
        };

        // ── the model editor ──────────────────────────────────────────────
        const openEditor = (seatId) => {
          const setting = models[seatId];
          setEditing(seatId);
          setEditError('');
          setCatalog(null);
          setCatalogState('idle');
          // Start from the catalog; a failed/empty catalog falls back to the
          // hand-entry form inside the render (the mode is derived there).
          setRouteMode('catalog');
          if (setting?.override === 'route' && setting.effectiveModel) {
            setChoice('specify');
            setRoute({ provider: setting.effectiveModel.provider, model: setting.effectiveModel.model });
          } else if (setting?.override === 'inherit') {
            setChoice('inherit');
            setRoute({ provider: '', model: '' });
          } else {
            setChoice('default');
            setRoute({ provider: '', model: '' });
          }
          void loadCatalog();
        };

        const saveModel = async () => {
          const setting = editing === null ? undefined : models[editing];
          setSaving(true);
          setEditError('');
          try {
            const api = ctx.remote.omoSeatModels;
            let request;
            if (choice === 'specify') {
              const provider = route.provider.trim();
              const model = route.model.trim();
              if (!provider || !model) { setEditError(t('routeRequired')); setSaving(false); return; }
              request = { seatId: editing, mode: 'set', route: { provider, model } };
            } else if (choice === 'inherit') {
              request = { seatId: editing, mode: 'inherit' };
            } else {
              request = { seatId: editing, mode: 'reset' };
            }
            if (setting?.overrideRevision !== undefined) request.expectedOverrideRevision = setting.overrideRevision;
            const value = valueOf(await api.update(request));
            if (value === undefined) {
              setEditError(t('failed') + 'remote unavailable');
              return;
            }
            if (value.status === 'ok') {
              // Trust the Host's fresh snapshot — never an optimistic display.
              setModels(bySeat(value.seats));
              setEditing(null);
              return;
            }
            setEditError(value.code === 'CONFLICT' ? t('conflict') : `${t('failed')}${value.code}: ${value.message}`);
          } catch (e) {
            setEditError(t('failed') + String(e?.message ?? e));
          } finally {
            setSaving(false);
          }
        };

        /** The row's dispatch-default line: route + where the preference comes from. */
        const modelLine = (seatId) => {
          const setting = models[seatId];
          if (!setting) return null;
          const badge = setting.source === 'user-override' || setting.source === 'forced-inherit'
            ? t('overrideBadge')
            : (setting.source === 'parent' ? '' : t('defaultBadge'));
          const routeText = setting.effectiveModel
            ? `${setting.effectiveModel.provider}/${setting.effectiveModel.model}`
            : t('inheritLabel');
          return `${t('modelLine')}：${routeText}${badge ? ` · ${badge}` : ''}`;
        };

        const styleEl = styleFallback ? h('style', null, CSS) : null;
        if (!open || !anchor) return styleEl;

        // Position: prefer below the anchor, flip above when the room below is
        // tight. The popup is placed to stay inside the viewport rather than
        // squeezed to the leftover room — a clipped option would be swallowed
        // by the full-screen catch layer and read as a dismissal.
        const POPUP_W = 320;
        const POPUP_H = editing === null ? Math.min(600, 260 + roster.length * 62) : 320;
        const roomBelow = window.innerHeight - anchor.bottom - 12;
        const placeAbove = roomBelow < POPUP_H && anchor.top > 200;
        const top = placeAbove
          ? Math.max(12, anchor.top - 6 - POPUP_H)
          : anchor.bottom + 6;
        const maxHeight = placeAbove
          ? Math.min(POPUP_H, window.innerHeight - 24)
          : Math.min(POPUP_H, window.innerHeight - top - 12);
        const overflowsRight = anchor.left + POPUP_W > window.innerWidth - 12;
        const horizontal = overflowsRight
          ? { right: Math.max(12, window.innerWidth - anchor.left - POPUP_W) }
          : { left: anchor.left };
        const position = { ...horizontal, top, maxHeight };

        const lang = t('lang');
        const inOmo = Boolean(current) && roster.some((preset) => preset.id === current);

        // The model editor replaces the roster inside the same anchored
        // panel: three mutually exclusive choices, then a route edited either
        // through the host's catalog (cascading selects) or by hand, then
        // save/cancel. Saving never switches the current seat and never runs
        // /preset.
        const editor = editing === null ? null : (() => {
          const setting = models[editing];
          const seatLabel = (roster.find((row) => row.id === editing)?.name) ?? (AGENTS[editing]?.name ?? editing);
          const definitionText = setting?.definitionModel
            ? `${setting.definitionModel.provider}/${setting.definitionModel.model}`
            : t('inheritLabel');
          const catalogPending = catalogState === 'loading' || catalogState === 'idle';
          const catalogReady = catalogState === 'ready' && catalog !== null;
          const catalogAvailable = catalogReady && Array.isArray(catalog.providers) && catalog.providers.length > 0;
          const catalogUnavailable = catalogState === 'failed' || (catalogReady && !catalogAvailable);
          // A failed or empty catalog forces the hand-entry form; the reason
          // stays visible instead of silently changing the controls.
          const effectiveMode = catalogUnavailable ? 'manual' : routeMode;
          const catalogReason = catalogState === 'failed'
            ? t('catalogFailed')
            : (catalogReady && !catalogAvailable ? t('catalogEmpty') : '');
          const providerChoices = providerOptions(catalog, route.provider);
          const modelChoices = modelOptions(catalog, route.provider, route.model);
          // A label wraps the radio and the text (a button may not contain an
          // input); clicking anywhere in the row selects the choice.
          const choiceRow = (id, title, desc) => h('label', {
            key: id,
            className: 'omo-ab-choice',
          },
            h('input', { type: 'radio', name: 'omo-model-choice', checked: choice === id, onChange: () => setChoice(id) }),
            h('span', { className: 'omo-ab-rowbody' },
              h('span', null, title),
              h('span', { className: 'omo-ab-choicedesc' }, desc),
            ),
          );
          const onProviderChange = (value) => {
            const provider = catalog?.providers?.find((row) => row !== null && row.id === value);
            const models = Array.isArray(provider?.models) ? provider.models : [];
            // One advertised model needs no second click; several leave the
            // model unselected so the save validation names the missing half.
            setRoute({ provider: value, model: models.length === 1 ? models[0].id : '' });
          };
          const modeButton = (mode, label, disabled) => h('button', {
            key: mode,
            type: 'button',
            className: 'omo-ab-mode',
            'aria-pressed': effectiveMode === mode,
            disabled,
            onClick: () => setRouteMode(mode),
          }, label);
          const catalogBody = h('div', { className: 'omo-ab-field' },
            h('span', { className: 'omo-ab-choicedesc' }, t('providerLabel')),
            h('select', {
              className: 'omo-ab-input',
              'aria-label': t('providerLabel'),
              value: route.provider,
              disabled: catalogPending,
              onChange: (e) => onProviderChange(e.target.value),
            },
              h('option', { value: '', disabled: true }, t('chooseProvider')),
              providerChoices.map((option) => h('option', {
                key: option.value,
                value: option.value,
                title: option.title,
              }, `${option.label}${option.synthetic ? t('unregisteredSuffix') : ''}${option.failure ? t('catalogFailureSuffix') : ''}`)),
            ),
            h('span', { className: 'omo-ab-choicedesc' }, t('modelLabel')),
            h('select', {
              className: 'omo-ab-input',
              'aria-label': t('modelLabel'),
              value: route.model,
              disabled: catalogPending,
              onChange: (e) => setRoute({ ...route, model: e.target.value }),
            },
              h('option', { value: '', disabled: true }, t('chooseModel')),
              modelChoices.map((option) => h('option', {
                key: option.value,
                value: option.value,
                title: option.title,
              }, `${option.label}${option.synthetic ? t('unlistedSuffix') : ''}${option.officialBlocked ? t('officialBlockedSuffix') : ''}`)),
            ),
            h('span', { className: 'omo-ab-choicedesc' }, catalogPending ? t('catalogLoading') : t('catalogNote')),
          );
          const manualBody = h('div', { className: 'omo-ab-field' },
            h('span', { className: 'omo-ab-choicedesc' }, t('providerLabel')),
            h('input', {
              className: 'omo-ab-input',
              value: route.provider,
              placeholder: t('providerPlaceholder'),
              onChange: (e) => setRoute({ ...route, provider: e.target.value }),
            }),
            h('span', { className: 'omo-ab-choicedesc' }, t('modelLabel')),
            h('input', {
              className: 'omo-ab-input',
              value: route.model,
              placeholder: t('modelPlaceholder'),
              onChange: (e) => setRoute({ ...route, model: e.target.value }),
            }),
            catalogReason !== '' && h('span', { className: 'omo-ab-choicedesc' }, catalogReason),
          );
          return h('div', { className: 'omo-ab-popup', style: { position: 'fixed', zIndex: 61, ...position } },
            h('div', { className: 'omo-ab-title' }, `${seatLabel} · ${t('editTitle')}`),
            choiceRow('default', t('choiceDefault'), `${t('choiceDefaultDesc')}（${definitionText}）`),
            choiceRow('inherit', t('choiceInherit'), t('choiceInheritDesc')),
            choiceRow('specify', t('choiceSpecify'), t('choiceSpecifyDesc')),
            choice === 'specify' && h('div', null,
              h('div', { className: 'omo-ab-modes' },
                modeButton('catalog', t('modeCatalog'), catalogUnavailable),
                modeButton('manual', t('modeManual'), false),
              ),
              effectiveMode === 'catalog' ? catalogBody : manualBody,
            ),
            h('div', { className: 'omo-ab-hint' }, t('fixedNote')),
            editError && h('div', { className: 'omo-ab-err', role: 'alert' }, editError),
            h('div', { className: 'omo-ab-actions' },
              h('button', { type: 'button', className: 'omo-ab-edit', onClick: () => setEditing(null), disabled: saving }, t('cancel')),
              h('button', { type: 'button', className: 'omo-ab-save', onClick: () => { void saveModel(); }, disabled: saving }, saving ? t('saving') : t('save')),
            ),
          );
        })();

        return h(React.Fragment, null,
          styleEl,
          h('div', {
            className: 'omo-ab-catch',
            'aria-hidden': true,
            onMouseDown: () => store.set({ open: false }),
          }),
          editor !== null ? editor : h('div', { className: 'omo-ab-popup', style: { position: 'fixed', zIndex: 60, ...position }, role: 'listbox' },
            h('div', { className: 'omo-ab-title' }, t('popupTitle')),
            !inOmo && h('div', { className: 'omo-ab-hint' }, t('outside')),
            roster.length === 0 && h('div', { className: 'omo-ab-hint' }, t('empty')),
            roster.map((preset) => {
              const info = AGENTS[preset.id] ?? {};
              const isCurrent = preset.id === current;
              return h('div', { key: preset.id, className: 'omo-ab-rowwrap' },
                h('button', {
                  type: 'button',
                  role: 'option',
                  className: 'omo-ab-row',
                  'aria-selected': isCurrent,
                  disabled: busy || isCurrent,
                  onClick: () => select(preset.id),
                },
                  h('span', { className: 'omo-ab-icon' }, info.icon ?? '◇'),
                  h('span', { className: 'omo-ab-rowbody' },
                    h('span', null, preset.name ?? info.name ?? preset.id),
                    h('span', { className: 'omo-ab-desc' }, info[lang] ?? preset.description ?? ''),
                    modelsReady && h('span', { className: 'omo-ab-model' }, modelLine(preset.id)),
                  ),
                  isCurrent && h('span', { className: 'omo-ab-badge' }, t('current')),
                ),
                // The edit control sits BESIDE the option, never nested in it;
                // it stays available even while the seat's select is disabled.
                modelsReady && h('button', {
                  type: 'button',
                  className: 'omo-ab-edit',
                  title: t('editTitle'),
                  disabled: busy,
                  onClick: () => openEditor(preset.id),
                }, t('editButton')),
              );
            }),
            busy && h('div', { className: 'omo-ab-hint' }, t('busy')),
            error && h('div', { className: 'omo-ab-err', role: 'alert' }, error),
            h('div', { className: 'omo-ab-hint' }, t('hint')),
          ),
        );
      };
    }

    /** Index a getState snapshot's seats by id. */
    function bySeat(seats) {
      const map = {};
      for (const seat of Array.isArray(seats) ? seats : []) {
        if (seat && typeof seat.seatId === 'string') map[seat.seatId] = seat;
      }
      return map;
    }

    /**
     * Provider choices for the model editor: catalog order, plus a synthetic
     * first entry when the current value is not advertised by this host. The
     * override file is shared per DSH_HOME across profiles, so a route
     * registered elsewhere must stay visible (and saveable) here.
     */
    function providerOptions(catalog, currentProvider) {
      const options = [];
      const providers = Array.isArray(catalog?.providers) ? catalog.providers : [];
      for (const provider of providers) {
        if (provider === null || typeof provider !== 'object' || typeof provider.id !== 'string' || provider.id.length === 0) continue;
        options.push({
          value: provider.id,
          label: provider.id,
          synthetic: false,
          failure: typeof provider.failure === 'string',
          ...(typeof provider.name === 'string' && provider.name.length > 0 && provider.name !== provider.id ? { title: provider.name } : {}),
        });
      }
      if (typeof currentProvider === 'string' && currentProvider.length > 0 && !options.some((option) => option.value === currentProvider)) {
        options.unshift({ value: currentProvider, label: currentProvider, synthetic: true, failure: false });
      }
      return options;
    }

    /**
     * Model choices for one provider under the same synthetic rule. The
     * official-subagent flag is advisory context from the host (it never
     * gates saving or omo dispatch) and rides as `officialBlocked`.
     */
    function modelOptions(catalog, provider, currentModel) {
      const options = [];
      const providerRow = Array.isArray(catalog?.providers)
        ? catalog.providers.find((row) => row !== null && typeof row === 'object' && row.id === provider)
        : undefined;
      const models = Array.isArray(providerRow?.models) ? providerRow.models : [];
      for (const model of models) {
        if (model === null || typeof model !== 'object' || typeof model.id !== 'string' || model.id.length === 0) continue;
        options.push({
          value: model.id,
          label: model.id,
          synthetic: false,
          officialBlocked: model.officialSubagentAllowed === false,
          ...(typeof model.name === 'string' && model.name.length > 0 && model.name !== model.id ? { title: model.name } : {}),
        });
      }
      if (typeof currentModel === 'string' && currentModel.length > 0 && !options.some((option) => option.value === currentModel)) {
        options.unshift({ value: currentModel, label: currentModel, synthetic: true, officialBlocked: false });
      }
      return options;
    }

    return {
      inject: ['slots', 'sessions', 'locale', 'remote', 'remote.commands'],
      // Offline verification seam: pure option builders are exercised by
      // verify/agent-button-client.test.mjs without a DOM or React runtime.
      __test: { providerOptions, modelOptions },
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('agentButton', DICT), 'omo-ab: dictionaries');

        // Styles: prefer the package-owned stylesheet builtin (cleaned up with
        // the Client run); when it is unavailable, the overlay popup renders
        // the same rules as a component-local <style> element.
        const styleFallback = typeof styles === 'undefined';
        if (!styleFallback) {
          ctx.effect(() => styles.insert(CSS), 'omo-ab: styles');
        }

        const t = ctx.locale.bind('agentButton');
        const store = createStore({ open: false, anchor: null, current: '', names: {}, modelsReady: false });

        // Phase 1: mount our omoSeatModels Remote contribution. The UI only
        // reads remote.omoSeatModels after modelsReady flips, so the mount can
        // complete asynchronously without the chip waiting on it; a failed
        // mount leaves the seat switch (the commands path) fully usable and
        // simply hides the model controls.
        ctx.effect(() => {
          let disposed = false;
          let disposeMount;
          void (async () => {
            try {
              const mounted = await ctx.remote.$mount(TYPERT_REMOTE);
              if (disposed) { if (typeof mounted === 'function') mounted(); return; }
              disposeMount = mounted;
              store.set({ modelsReady: true });
            } catch { /* the seat-model panel stays hidden; seat switching is unaffected */ }
          })();
          return () => { disposed = true; if (typeof disposeMount === 'function') disposeMount(); };
        }, 'omo-ab: omoSeatModels remote');

        // Chip: the composer's left group, beside the access-mode control —
        // the position the user pointed at. Registered exactly once: the
        // header slot is deliberately unused, so the seat control never sits
        // beside the official mode chip.
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
          {
            name: 'conversation.input.left',
            id: 'oh-my-dsh-agent-button',
            order: 5,
            label: () => t('tooltip'),
          },
          buildChip(ctx, t, store),
        ));

        // Popup: the frame-wide overlay layer, which sits above every column
        // and outside their scroll containers (the row slots clip children).
        ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'oh-my-dsh-agent-button-popup',
            order: 5,
            label: () => t('popupTitle'),
          },
          buildPopup(ctx, t, store, styleFallback),
        ));
      },
    };
  },
});
