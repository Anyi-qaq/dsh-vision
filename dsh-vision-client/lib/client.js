// dsh-vision-client — browser half (prebuilt client bundle).
// Registers:
//   1. an "upload image" button in the composer tool row
//      (conversation.input.left, id "vision-upload") that stages the picked
//      image in a browser cache first and only calls the host /dsh-vision
//      channel (analyze / status) on demand, when the user clicks the
//      explicit "开始识别" action; the vision result appears in a floating
//      card;
//   2. a configuration card in Settings → Plugins → Plugin configuration
//      (settings.plugin.item, id "vision").
// Both bind the host's "dsh-vision" settings namespace (baseUrl / model /
// videoModel) and the DSH_VISION_API_KEY credential.
window.__ModuleLoader__.load({
  id: 'dsh-vision-ui',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var React = require('react');
    var webReact = require('@deepseek-ai/dsh-client-web-react');
    var primitives = require('@deepseek-ai/dsh-client-ui-primitives');

    var VISION_NS = 'dsh-vision';
    var CRED_REF = 'DSH_VISION_API_KEY';
    var RPC_CHANNEL = '/dsh-vision';

    // ---------- styles ----------
    var styles = {
      label: { display: 'block', marginBottom: '10px', maxWidth: '520px' },
      labelText: { display: 'block', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '4px' },
      input: {
        boxSizing: 'border-box',
        width: '100%',
        height: '34px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        padding: '0 10px',
        fontSize: '13px',
        fontFamily: 'inherit',
        outline: 'none',
      },
      row: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
      button: {
        height: '32px',
        padding: '0 14px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        fontFamily: 'inherit',
        cursor: 'pointer',
      },
      primary: {
        background: 'var(--dsw-alias-state-business-primary)',
        borderColor: 'var(--dsw-alias-state-business-primary)',
        color: 'var(--dsw-alias-bg-layer-0, #fff)',
      },
      hint: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '10px' },
      badge: { fontSize: '12px', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)' },
      badgeOn: { color: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)' },
      error: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)', marginTop: '8px' },
      saved: { fontSize: '12px', color: 'var(--dsw-alias-state-success-primary)', marginTop: '8px' },
      title: { margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      // composer tool-row upload button (mirrors the shipped 28x28 round chrome)
      uploadBtn: {
        width: '28px',
        height: '28px',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '999px',
        border: 'none',
        background: 'var(--dsw-specific-selector)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        padding: 0,
      },
      uploadBtnHover: { background: 'var(--dsw-alias-interactive-bg-hover-solid)' },
      uploadBtnDisabled: { opacity: '.5', cursor: 'default' },
      card: {
        position: 'absolute',
        left: '12px',
        bottom: 'calc(100% + 10px)',
        zIndex: 40,
        width: 'min(460px, calc(100vw - 48px))',
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l2-darkmode-thin)',
        background: 'var(--dsw-specific-input-major)',
        boxShadow: 'var(--dsw-shadow-lv2)',
        borderRadius: '12px',
        padding: '12px 14px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        lineHeight: '20px',
        textAlign: 'left',
      },
      cardHead: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
      cardTitle: { fontSize: '13px', fontWeight: 600, flex: 'none' },
      cardModel: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      cardClose: {
        flex: 'none',
        width: '22px',
        height: '22px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        fontSize: '14px',
        lineHeight: '1',
        padding: 0,
      },
      cardBody: { display: 'flex', gap: '10px', alignItems: 'flex-start', maxHeight: '240px', overflow: 'auto' },
      cardThumb: { flex: 'none', width: '88px', height: '88px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2)' },
      cardText: { flex: '1', minWidth: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', lineHeight: '20px' },
      cardActions: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' },
      cardAction: {
        height: '28px',
        padding: '0 12px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '12px',
        fontFamily: 'inherit',
        cursor: 'pointer',
      },
      cardActionPrimary: {
        background: 'var(--dsw-alias-state-business-primary)',
        borderColor: 'var(--dsw-alias-state-business-primary)',
        color: 'var(--dsw-alias-bg-layer-0, #fff)',
      },
      busyText: { display: 'flex', alignItems: 'center', gap: '8px' },
      spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        border: '2px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4))',
        borderTopColor: 'var(--dsw-alias-state-business-primary)',
        animation: 'dshVisionSpin .8s linear infinite',
        flex: 'none',
      },
      // collapsible plugin card (mirrors the shipped PluginCard chrome)
      pcard: {
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-3)',
        borderRadius: '12px',
        marginBottom: '10px',
        maxWidth: '640px',
        transition: 'border-color .16s, background .16s',
      },
      pcardOpen: {
        background: 'var(--dsw-alias-bg-layer-2)',
        borderColor: 'var(--dsw-alias-label-dimmed)',
      },
      pcardHeader: {
        appearance: 'none',
        width: '100%',
        font: 'inherit',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        background: 'transparent',
        border: '0',
        borderRadius: '12px',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        display: 'flex',
      },
      pcardHeadText: { flexDirection: 'column', flex: '1', gap: '4px', minWidth: '0', display: 'flex' },
      pcardName: { color: 'var(--dsw-alias-label-primary)', fontSize: '15px', fontWeight: 600, lineHeight: 1.4 },
      pcardDescription: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '13px', lineHeight: 1.5 },
      pcardBody: { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', paddingBottom: '8px' },
    };

    // keyframes for the busy spinner (rendered once with the card)
    var SPIN_CSS = '@keyframes dshVisionSpin{to{transform:rotate(360deg)}}';

    // hover + chevron rotation for the collapsible plugin card (inline styles
    // cannot express :hover or transitions on transform)
    var CARD_CSS = '.dshVisionCard:hover{border-color:var(--dsw-alias-label-dimmed)}' +
      '.dshVisionCardChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}' +
      '.dshVisionCardChevronOpen{transform:rotate(180deg)}';

    function Field(props) {
      return React.createElement(
        'label',
        { style: styles.label },
        React.createElement('span', { style: styles.labelText }, props.label),
        React.createElement('input', {
          type: 'text',
          value: props.value,
          placeholder: props.placeholder || '',
          spellCheck: false,
          disabled: props.disabled === true,
          style: styles.input,
          onChange: function (event) { props.onChange(event.target.value); },
        }),
      );
    }

    // ---------- form ----------
    function VisionForm(props) {
      var controller = props.controller;
      var useSnapshot = props.useSnapshot;
      var api = props.api;
      if (controller === undefined || useSnapshot === undefined || api === undefined) {
        return React.createElement('div', { style: styles.hint }, 'Vision settings are unavailable in this session.');
      }
      return React.createElement(VisionFormInner, {
        controller: controller,
        useSnapshot: useSnapshot,
        api: api,
        compact: props.compact === true,
      });
    }

    function VisionFormInner(props) {
      var controller = props.controller;
      var useSnapshot = props.useSnapshot;
      var api = props.api;
      var compact = props.compact;
      var state = useSnapshot(function (snapshot) { return snapshot; });
      var current = state !== null && typeof state === 'object' && state.value !== null && typeof state.value === 'object' ? state.value : {};

      var baseUrl = current.baseUrl || '';
      var model = current.model || '';
      var videoModel = current.videoModel || '';
      var writable = state.writable === true && state.mode !== 'memory';

      var ReactState = React.useState;
      var draftBase = ReactState(baseUrl);
      var draftModel = ReactState(model);
      var draftVideo = ReactState(videoModel);
      var draftKey = ReactState('');
      var keyConfigured = ReactState(false);
      var saving = ReactState(false);
      var saved = ReactState(false);
      var error = ReactState(null);

      var setDraftBase = draftBase[1];
      var setDraftModel = draftModel[1];
      var setDraftVideo = draftVideo[1];
      var setDraftKey = draftKey[1];
      var setKeyConfigured = keyConfigured[1];
      var setSaving = saving[1];
      var setSaved = saved[1];
      var setError = error[1];
      var draftBaseValue = draftBase[0];
      var draftModelValue = draftModel[0];
      var draftVideoValue = draftVideo[0];
      var draftKeyValue = draftKey[0];
      var savingValue = saving[0];
      var savedValue = saved[0];
      var errorValue = error[0];

      // Refresh the namespace on mount and when the store status changes.
      React.useEffect(function () {
        controller.load();
      }, [controller, state.status]);

      // Pull latest values from the store into the draft.
      React.useEffect(function () {
        setDraftBase(current.baseUrl || '');
        setDraftModel(current.model || '');
        setDraftVideo(current.videoModel || '');
      }, [state.value]);

      // Track whether the API key is configured.
      React.useEffect(function () {
        var alive = true;
        api.credentials.describe({ refs: [CRED_REF] }).then(function (response) {
          if (!alive) return;
          var view = response !== null && response.result !== undefined && response.result.ok === true
            ? response.result.value.credentials[CRED_REF]
            : undefined;
          setKeyConfigured(view !== undefined && view.configured === true);
        }).catch(function () { /* leave as-is */ });
        return function () { alive = false; };
      }, [api, state.status]);

      function onSave() {
        setSaving(true);
        setSaved(false);
        setError(null);
        var jobs = [];
        if (draftBaseValue !== baseUrl) jobs.push(controller.set('baseUrl', draftBaseValue));
        if (draftModelValue !== model) jobs.push(controller.set('model', draftModelValue));
        if (draftVideoValue !== videoModel) jobs.push(controller.set('videoModel', draftVideoValue));
        if (draftKeyValue !== '') jobs.push(api.credentials.set({ ref: CRED_REF, value: draftKeyValue }));
        Promise.all(jobs).then(function () {
          if (draftKeyValue !== '') {
            setDraftKey('');
            return api.credentials.describe({ refs: [CRED_REF] }).then(function (response) {
              var view = response !== null && response.result !== undefined && response.result.ok === true
                ? response.result.value.credentials[CRED_REF]
                : undefined;
              setKeyConfigured(view !== undefined && view.configured === true);
            });
          }
          return undefined;
        }).then(function () {
          setSaving(false);
          setSaved(true);
          controller.load();
        }).catch(function (reason) {
          setSaving(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        });
      }

      function onReset() {
        setSaving(true);
        setSaved(false);
        setError(null);
        Promise.all([
          controller.unset('baseUrl'),
          controller.unset('model'),
          controller.unset('videoModel'),
          api.credentials.unset({ ref: CRED_REF }),
        ]).then(function () {
          setSaving(false);
          setSaved(true);
          setKeyConfigured(false);
          controller.load();
        }).catch(function (reason) {
          setSaving(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        });
      }

      var keyBadge = React.createElement(
        'span',
        { style: Object.assign({}, styles.badge, keyConfigured[0] === true ? styles.badgeOn : null) },
        keyConfigured[0] === true ? 'API key: configured' : 'API key: not set',
      );

      return React.createElement(
        'div',
        null,
        React.createElement(Field, { label: 'API base URL', value: draftBaseValue, placeholder: 'https://api.openai.com/v1', disabled: !writable, onChange: setDraftBase }),
        React.createElement(Field, { label: 'Default image model', value: draftModelValue, placeholder: 'gpt-4o-mini', disabled: !writable, onChange: setDraftModel }),
        React.createElement(Field, { label: 'Default video model', value: draftVideoValue, placeholder: '(empty = use image model)', disabled: !writable, onChange: setDraftVideo }),
        React.createElement(Field, { label: 'API key (stored in the credentials service)', value: draftKeyValue, placeholder: 'sk-…', disabled: !writable, onChange: setDraftKey }),
        React.createElement('div', { style: styles.row },
          React.createElement('button', {
            style: Object.assign({}, styles.button, styles.primary),
            disabled: !writable || savingValue,
            onClick: onSave,
          }, savingValue ? 'Saving…' : 'Save'),
          compact !== true ? React.createElement('button', {
            style: styles.button,
            disabled: !writable || savingValue,
            onClick: onReset,
          }, 'Reset') : null,
          keyBadge,
        ),
        savedValue === true ? React.createElement('div', { style: styles.saved }, 'Saved.') : null,
        errorValue !== null ? React.createElement('div', { style: styles.error }, errorValue) : null,
        writable ? null : React.createElement('div', { style: styles.hint }, 'Settings are read-only on this connection.'),
      );
    }

    // ---------- plugin configuration card (collapsible, like the shipped cards) ----------
    function VisionPluginCard(props) {
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var title = 'Vision (识图 / 视频)';
      var cardClass = 'dshVisionCard' + (open ? ' dshVisionCardOpen' : '');
      return React.createElement(
        'div',
        { className: cardClass, style: Object.assign({}, styles.pcard, open ? styles.pcardOpen : null) },
        React.createElement('style', null, CARD_CSS),
        React.createElement('button', {
          type: 'button',
          style: styles.pcardHeader,
          'aria-expanded': open,
          'aria-label': (open ? '收起设置: ' : '展开设置: ') + title,
          onClick: function () { setOpen(!open); },
        },
          React.createElement('span', { style: styles.pcardHeadText },
            React.createElement('span', { style: styles.pcardName }, title),
            React.createElement('span', { style: styles.pcardDescription }, 'OpenAI-compatible vision configuration for vision_image and vision_video.'),
          ),
          React.createElement(primitives.IconChevronDownOutline14, { className: 'dshVisionCardChevron' + (open ? ' dshVisionCardChevronOpen' : '') }),
        ),
        open ? React.createElement('div', { style: styles.pcardBody },
          React.createElement(VisionForm, { controller: props.controller, useSnapshot: props.useSnapshot, api: props.api, compact: true }),
        ) : null,
      );
    }

    // ---------- composer upload button ----------
    function UploadImageIcon() {
      return React.createElement('svg', {
        viewBox: '0 0 16 16',
        width: '14',
        height: '14',
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
        React.createElement('rect', { x: '1.5', y: '2.5', width: '13', height: '11', rx: '2' }),
        React.createElement('circle', { cx: '5.5', cy: '6', r: '1.4' }),
        React.createElement('path', { d: 'M1.5 11l3.6-3.4a1 1 0 0 1 1.4 0L11 12' }),
        React.createElement('path', { d: 'M9 9.5l1.6-1.5a1 1 0 0 1 1.4 0L14 10' }),
      );
    }

    // ---------- staged image cache ----------
    // Uploaded images are staged here first and only recognized on demand:
    // picking a file stores its data URL in the cache, and the vision call
    // happens only when the user clicks the explicit "开始识别" action. The
    // cache survives component remounts; small images also survive a page
    // reload through sessionStorage (larger ones stay memory-only).
    var STAGE_KEY = 'dsh-vision.stage.v1';
    var stageItem = null; // { id, name, size, dataUrl, at } | null

    function loadStage() {
      if (stageItem !== null) return stageItem;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage !== undefined) {
          var raw = window.sessionStorage.getItem(STAGE_KEY);
          if (raw !== null && raw !== '') {
            var parsed = JSON.parse(raw);
            if (parsed !== null && typeof parsed === 'object' && typeof parsed.dataUrl === 'string' && parsed.dataUrl !== '') {
              stageItem = parsed;
            }
          }
        }
      } catch (error) { /* ignore */ }
      return stageItem;
    }

    function persistStage() {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage !== undefined) {
          if (stageItem === null) window.sessionStorage.removeItem(STAGE_KEY);
          else if (stageItem.dataUrl.length <= 3500000) window.sessionStorage.setItem(STAGE_KEY, JSON.stringify(stageItem));
          else window.sessionStorage.removeItem(STAGE_KEY); // too large for sessionStorage; memory-only
        }
      } catch (error) { /* ignore quota / privacy-mode errors */ }
    }

    function stageIntoCache(item) {
      stageItem = item;
      persistStage();
    }

    function clearStageCache() {
      stageItem = null;
      persistStage();
    }

    function formatBytes(n) {
      if (typeof n !== 'number' || !(n > 0)) return '';
      if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
      if (n >= 1024) return Math.round(n / 1024) + ' KB';
      return n + ' B';
    }

    function VisionUploadButton(props) {
      var rpc = props.rpc;
      var inputActions = props.inputActions;
      var input = props.input;

      var ReactState = React.useState;
      var available = ReactState(null); // null = probing; true/false = verdict
      var status = ReactState(null); // { configured, model } from the host
      var staged = ReactState(null); // cached image: { id, name, size, dataUrl, at }
      var busy = ReactState(false);
      var busyLabel = ReactState('');
      var result = ReactState(null); // { content, model, thumb }
      var error = ReactState(null);
      var copied = ReactState(false);
      var panelOpen = ReactState(false);
      var fileInput = React.useRef(null);

      var setAvailable = available[1];
      var setStatus = status[1];
      var setStaged = staged[1];
      var setBusy = busy[1];
      var setBusyLabel = busyLabel[1];
      var setResult = result[1];
      var setError = error[1];
      var setCopied = copied[1];
      var setPanelOpen = panelOpen[1];
      var availableValue = available[0];
      var statusValue = status[0];
      var stagedValue = staged[0];
      var busyValue = busy[0];
      var busyLabelValue = busyLabel[0];
      var resultValue = result[0];
      var errorValue = error[0];
      var copiedValue = copied[0];
      var panelOpenValue = panelOpen[0];

      // Probe the host channel once. While the host side has not been
      // restarted with the channel registered, the button stays hidden.
      React.useEffect(function () {
        if (rpc === undefined || rpc.call === undefined) {
          setAvailable(false);
          return;
        }
        var alive = true;
        rpc.call(RPC_CHANNEL, 'status', {}).then(function (response) {
          if (!alive) return;
          if (response !== null && response.ok === true) {
            setAvailable(true);
            if (response.value !== null && typeof response.value === 'object') setStatus(response.value);
          } else {
            setAvailable(false);
          }
        }).catch(function () {
          if (alive) setAvailable(false);
        });
        return function () { alive = false; };
      }, [rpc]);

      // Restore the cached staged image when the button (re)mounts.
      React.useEffect(function () {
        var cached = loadStage();
        if (cached !== null) setStaged(cached);
      }, []);

      if (availableValue === false) return null;

      function onPick(event) {
        var file = event.target !== null && event.target.files !== null && event.target.files.length > 0 ? event.target.files[0] : undefined;
        if (event.target !== null) event.target.value = '';
        if (file === undefined) return;
        if (typeof file.type !== 'string' || file.type.indexOf('image/') !== 0) {
          setResult(null);
          setError('请选择图片文件（PNG / JPG / WebP / GIF 等）。');
          setPanelOpen(true);
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          setResult(null);
          setError('图片超过 15 MB，请压缩后再试。');
          setPanelOpen(true);
          return;
        }
        setResult(null);
        setError(null);
        setCopied(false);
        setBusy(true);
        setBusyLabel('正在读取图片并暂存到缓存…');
        setPanelOpen(true);
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = typeof reader.result === 'string' ? reader.result : '';
          setBusy(false);
          if (dataUrl === '') {
            setError('无法读取图片文件。');
            return;
          }
          // Stage first, recognize on demand: no vision call happens here.
          var item = {
            id: 'img-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            name: typeof file.name === 'string' ? file.name : '',
            size: file.size,
            dataUrl: dataUrl,
            at: Date.now(),
          };
          stageIntoCache(item);
          setStaged(item);
          setResult(null);
          setError(null);
          setCopied(false);
        };
        reader.onerror = function () {
          setBusy(false);
          setError('无法读取图片文件。');
        };
        reader.readAsDataURL(file);
      }

      // On-demand recognition: only a click here (开始识别 / 重新识别 / 重试)
      // invokes the host vision call. The prompt is taken from the current
      // composer draft at call time.
      function runAnalyze() {
        if (stagedValue === null || rpc === undefined || typeof rpc.call !== 'function') return;
        var draft = input !== null && typeof input === 'object' && typeof input.draft === 'string' ? input.draft : '';
        var prompt = draft.trim() !== '' ? draft.trim() : '请详细描述这张图片的内容。';
        var dataUrl = stagedValue.dataUrl;
        setBusy(true);
        setBusyLabel('正在调用识图模式识别图片…');
        setError(null);
        setCopied(false);
        rpc.call(RPC_CHANNEL, 'analyze', { dataUrl: dataUrl, prompt: prompt }).then(function (response) {
          setBusy(false);
          if (response !== null && response.ok === true && response.value !== null && typeof response.value === 'object') {
            var value = response.value;
            setResult({
              content: typeof value.content === 'string' ? value.content : '',
              model: typeof value.model === 'string' ? value.model : '',
              thumb: dataUrl,
            });
          } else {
            var message = 'Vision 识别失败。';
            if (response !== null && response.error !== null && typeof response.error === 'object') {
              message = String(response.error.message !== undefined && response.error.message !== '' ? response.error.message : (response.error.code || message));
            }
            setError(message);
          }
        }).catch(function (reason) {
          setBusy(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        });
      }

      function onRemove() {
        clearStageCache();
        setStaged(null);
        setResult(null);
        setError(null);
        setCopied(false);
        setBusy(false);
        setPanelOpen(false);
      }

      function onPickNew() {
        if (fileInput.current !== null) fileInput.current.click();
      }

      function onCopy() {
        if (resultValue === null || resultValue.content === '') return;
        if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(resultValue.content).then(function () {
            setCopied(true);
          }).catch(function () { /* ignore */ });
        }
      }

      function onInsertDraft() {
        if (resultValue === null || inputActions === undefined || typeof inputActions.setDraft !== 'function') return;
        var current = typeof input.draft === 'string' ? input.draft : '';
        var separator = current.trim() === '' ? '' : '\n\n';
        inputActions.setDraft(current + separator + '[Vision 识图结果]\n' + resultValue.content);
        setResult(null);
      }

      var buttonStyle = Object.assign({}, styles.uploadBtn, busyValue ? styles.uploadBtnDisabled : null);
      var hintText = '上传图片暂存到缓存，按需调用 dsh-vision 识别' + (statusValue !== null && statusValue.configured !== true ? '（未配置 API Key）' : '');
      var button = React.createElement('button', {
        type: 'button',
        style: buttonStyle,
        'aria-label': hintText,
        title: hintText,
        disabled: busyValue,
        onClick: function () {
          // Reopen the panel with the cached staged image when one exists
          // and the panel is closed; otherwise pick a new file.
          if (panelOpenValue || stagedValue === null) {
            if (fileInput.current !== null) fileInput.current.click();
          } else {
            setPanelOpen(true);
          }
        },
      }, React.createElement(UploadImageIcon, null));

      var panel = null;
      if (panelOpenValue && (busyValue || stagedValue !== null || resultValue !== null || errorValue !== null)) {
        var head = React.createElement('div', { style: styles.cardHead },
          React.createElement('span', { style: styles.cardTitle }, 'Vision 识图'),
          React.createElement('span', { style: styles.cardModel }, resultValue !== null && resultValue.model !== '' ? 'model: ' + resultValue.model : (busyValue ? '识别中…' : (stagedValue !== null ? '已暂存 · 未识别' : ''))),
          React.createElement('button', {
            type: 'button',
            style: styles.cardClose,
            'aria-label': '收起',
            title: '收起',
            onClick: function () { setPanelOpen(false); },
          }, '×'),
        );
        var body;
        if (busyValue) {
          body = React.createElement('div', { style: styles.busyText },
            React.createElement('span', { style: styles.spinner }),
            React.createElement('span', null, busyLabelValue !== '' ? busyLabelValue : '处理中…'),
          );
        } else if (errorValue !== null) {
          var errorActions = React.createElement('div', { style: styles.cardActions },
            stagedValue !== null ? React.createElement('button', {
              type: 'button',
              style: Object.assign({}, styles.cardAction, styles.cardActionPrimary),
              onClick: runAnalyze,
            }, '重试识别') : null,
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onPickNew,
            }, '换一张'),
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onRemove,
            }, '移除'),
          );
          body = React.createElement('div', null,
            React.createElement('div', { style: styles.error }, errorValue),
            errorActions,
          );
        } else if (resultValue !== null && stagedValue !== null) {
          var actions = React.createElement('div', { style: styles.cardActions },
            React.createElement('button', {
              type: 'button',
              style: Object.assign({}, styles.cardAction, styles.cardActionPrimary),
              onClick: runAnalyze,
            }, '重新识别'),
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onCopy,
            }, copiedValue ? '已复制' : '复制结果'),
            inputActions !== undefined && typeof inputActions.setDraft === 'function' ? React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onInsertDraft,
            }, '插入草稿') : null,
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onPickNew,
            }, '换一张'),
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onRemove,
            }, '移除'),
          );
          body = React.createElement('div', null,
            React.createElement('div', { style: styles.cardBody },
              resultValue.thumb !== '' ? React.createElement('img', { src: resultValue.thumb, alt: '', style: styles.cardThumb }) : null,
              React.createElement('div', { style: styles.cardText }, resultValue.content),
            ),
            actions,
          );
        } else if (stagedValue !== null) {
          var sizeText = formatBytes(stagedValue.size);
          var metaText = (stagedValue.name !== '' ? stagedValue.name : '图片') + (sizeText !== '' ? ' · ' + sizeText : '');
          var stageActions = React.createElement('div', { style: styles.cardActions },
            React.createElement('button', {
              type: 'button',
              style: Object.assign({}, styles.cardAction, styles.cardActionPrimary),
              onClick: runAnalyze,
            }, '开始识别'),
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onPickNew,
            }, '换一张'),
            React.createElement('button', {
              type: 'button',
              style: styles.cardAction,
              onClick: onRemove,
            }, '移除'),
          );
          body = React.createElement('div', null,
            React.createElement('div', { style: styles.cardBody },
              React.createElement('img', { src: stagedValue.dataUrl, alt: '', style: styles.cardThumb }),
              React.createElement('div', { style: styles.cardText }, metaText),
            ),
            React.createElement('div', { style: styles.hint }, '图片已暂存到缓存，尚未调用识图模式。点击「开始识别」按需识别；识别时会用当前输入框草稿作为提问（为空则默认描述图片）。'),
            stageActions,
          );
        } else {
          body = null;
        }
        panel = React.createElement('div', { style: styles.card },
          React.createElement('style', null, SPIN_CSS),
          head,
          body,
        );
      }

      return React.createElement('div', { style: { position: 'relative' } },
        button,
        React.createElement('input', {
          ref: fileInput,
          type: 'file',
          accept: 'image/*',
          tabIndex: -1,
          'aria-hidden': true,
          style: { display: 'none' },
          onChange: onPick,
        }),
        panel,
      );
    }

    // ---------- plugin ----------
    var inject = ['slots', 'connection'];

    function apply(ctx) {
      var connection = ctx.connection;
      var settingsScope = ctx.get('settingsScope');
      var controller = settingsScope === undefined ? undefined : settingsScope.bind({ namespace: VISION_NS });
      var useSnapshot = controller === undefined ? undefined : webReact.bindSnapshotSelector(controller.store);
      var injected = function () {
        return { controller: controller, useSnapshot: useSnapshot, api: connection.api, rpc: connection.rpc };
      };
      ctx.slots.inject('conversation.input.left', function () {
        return ctx.slots.register(
          { name: 'conversation.input.left', id: 'vision-upload', order: 20, inject: injected },
          VisionUploadButton,
        );
      });
      ctx.slots.inject('settings.plugin.item', function () {
        return ctx.slots.register(
          { name: 'settings.plugin.item', id: 'vision', order: 30, inject: injected },
          VisionPluginCard,
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
