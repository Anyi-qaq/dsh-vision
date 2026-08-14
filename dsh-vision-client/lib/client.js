// dsh-vision-client — browser half (prebuilt client bundle).
// Registers:
//   1. a "Vision" section on the Settings page (settings.section, id "vision")
//   2. a configuration card in Settings → Plugins → Plugin configuration
//      (settings.plugin.item, id "vision")
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

    var VISION_NS = 'dsh-vision';
    var CRED_REF = 'DSH_VISION_API_KEY';

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
    };

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

    // ---------- settings page section ----------
    function VisionSection(props) {
      return React.createElement(
        'div',
        { style: { padding: '4px 8px', maxWidth: '620px' } },
        React.createElement('h3', { style: styles.title }, 'Vision'),
        React.createElement('p', { style: styles.hint },
          'OpenAI-compatible vision tools (vision_image / vision_video). ' +
          'These fields are also editable with the vision_config tool.'),
        React.createElement(VisionForm, { controller: props.controller, useSnapshot: props.useSnapshot, api: props.api }),
      );
    }

    // ---------- plugin configuration card ----------
    function VisionPluginCard(props) {
      return React.createElement(
        'div',
        { style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '10px', padding: '14px', marginBottom: '10px', maxWidth: '640px' } },
        React.createElement('div', { style: styles.title }, 'Vision (识图 / 视频)'),
        React.createElement('p', { style: styles.hint }, 'OpenAI-compatible vision configuration for vision_image and vision_video.'),
        React.createElement(VisionForm, { controller: props.controller, useSnapshot: props.useSnapshot, api: props.api, compact: true }),
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
        return { controller: controller, useSnapshot: useSnapshot, api: connection.api };
      };
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'vision', order: 30, label: 'Vision', inject: injected },
          VisionSection,
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
