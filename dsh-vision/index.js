// dsh-vision — machine-local DSH plugin.
// OpenAI-compatible vision tools: vision_image, vision_video, vision_config.
// Configuration: vision_config tool (or the dsh-vision settings namespace),
// credentials service for the API key, OPENAI_BASE_URL / OPENAI_VISION_MODEL
// / OPENAI_VIDEO_MODEL environment variables.
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-vision'
export const inject = ['fs', 'subprocess', 'tools', 'settings']

const SETTINGS_NS = 'dsh-vision'
const CRED_REF = 'DSH_VISION_API_KEY'
const DEFAULT_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

export function apply(ctx) {
  const fs = ctx.fs
  const subprocess = ctx.subprocess
  const tools = ctx.tools
  const settings = ctx.settings
  const credentials = ctx.get('credentials')
  const sandboxPolicy = ctx.get('sandboxPolicy')

  const settingsScope = settings.register(SETTINGS_NS, z.object({
    baseUrl: z.string().default('').description('OpenAI-compatible API base, e.g. https://api.openai.com/v1'),
    model: z.string().default('').description('Default model for vision_image, e.g. gpt-4o-mini or qwen-vl-max'),
    videoModel: z.string().default('').description('Default model for vision_video; falls back to the image model when empty'),
  }), { applies: 'live' })

  // ---------- small utilities ----------
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  function base64Bytes(bytes) {
    let out = ''
    const len = bytes.length
    for (let i = 0; i < len; i += 3) {
      const a = bytes[i]
      const b = i + 1 < len ? bytes[i + 1] : 0
      const c = i + 2 < len ? bytes[i + 2] : 0
      out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)]
      out += i + 1 < len ? B64[((b & 15) << 2) | (c >> 6)] : '='
      out += i + 2 < len ? B64[c & 63] : '='
    }
    return out
  }

  const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/mp4',
  }
  function mimeFromName(name) {
    const idx = String(name).lastIndexOf('.')
    if (idx < 0) return undefined
    return MIME[String(name).slice(idx + 1).toLowerCase()]
  }

  function workspaceRoot() {
    if (sandboxPolicy !== undefined && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot !== '') return sandboxPolicy.workspaceRoot
    return '/tmp'
  }

  // Run one child process with collected output. Returns { code, out, err }.
  async function runProc(argv, opts) {
    const options = opts || {}
    const handle = subprocess.spawn({
      argv: argv,
      cwd: typeof options.cwd === 'string' ? options.cwd : workspaceRoot(),
      stdio: {
        stdin: typeof options.stdinData === 'string' ? { data: options.stdinData } : 'ignore',
        stdout: { maxBytes: options.maxOut || 1048576 },
        stderr: { maxBytes: options.maxErr || 262144 },
      },
      graceMs: 3000,
      signal: options.signal,
    })
    const outcome = await handle.done
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { code: outcome.exitCode, out: out, err: err }
  }

  // ---------- environment ----------
  let envCache = null
  async function readEnv() {
    if (envCache !== null) return envCache
    envCache = {}
    try {
      const printenv = await subprocess.resolveExecutable('printenv')
      const res = await runProc([printenv], { maxOut: 524288, maxErr: 65536 })
      if (res.code === 0) {
        const map = {}
        for (const line of res.out.split('\n')) {
          const idx = line.indexOf('=')
          if (idx > 0) map[line.slice(0, idx)] = line.slice(idx + 1)
        }
        envCache = map
      }
    } catch (error) {
      console.error('[dsh-vision] cannot read environment:', error)
    }
    return envCache
  }

  async function homeDir() {
    const env = await readEnv()
    if (typeof env.HOME === 'string' && env.HOME !== '') return env.HOME
    if (typeof env.USERPROFILE === 'string' && env.USERPROFILE !== '') return env.USERPROFILE
    return workspaceRoot()
  }

  async function ensureDir(path) {
    try {
      const mkdir = await subprocess.resolveExecutable('mkdir')
      const res = await runProc([mkdir, '-p', path], { maxOut: 65536, maxErr: 65536 })
      return res.code === 0
    } catch (error) {
      return false
    }
  }

  async function configPath() {
    return await homeDir() + '/.config/dsh-vision/config.json'
  }

  async function loadFallbackKey() {
    try {
      const target = await fs.resolve(await configPath())
      const text = await fs.readText(target)
      const parsed = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object' && typeof parsed.apiKey === 'string' && parsed.apiKey !== '') return parsed.apiKey
      return undefined
    } catch (error) {
      return undefined
    }
  }

  async function saveFallbackKey(key) {
    const path = await configPath()
    await ensureDir(path.slice(0, path.lastIndexOf('/')))
    const target = await fs.resolve(path)
    if (key === undefined) {
      await fs.writeText(target, JSON.stringify({}, null, 2))
    } else {
      await fs.writeText(target, JSON.stringify({ apiKey: key }, null, 2))
    }
  }

  // ---------- executables ----------
  let curlPath = null
  async function getCurl() {
    if (curlPath !== null) return curlPath
    try {
      curlPath = await subprocess.resolveExecutable('curl')
    } catch (error) {
      curlPath = undefined
    }
    return curlPath
  }

  let ffmpegProbed = false
  let ffmpegPath
  async function getFfmpeg() {
    if (ffmpegProbed) return ffmpegPath
    ffmpegProbed = true
    try {
      ffmpegPath = await subprocess.resolveExecutable('ffmpeg')
      return ffmpegPath
    } catch (error) { /* keep probing */ }
    try {
      const find = await subprocess.resolveExecutable('find')
      const res = await runProc([find, '/nix/store', '-maxdepth', '4', '-name', 'ffmpeg', '-type', 'f'], { maxOut: 65536, maxErr: 65536 })
      if (res.code === 0 && res.out !== '') {
        const first = res.out.split('\n').map(function (s) { return s.trim() }).find(Boolean)
        if (first !== undefined) {
          ffmpegPath = first
          return ffmpegPath
        }
      }
    } catch (error) { /* ignore */ }
    return undefined
  }

  async function tmpDir() {
    const dir = workspaceRoot() + '/.dsh-vision-tmp'
    await ensureDir(dir)
    try {
      return fs.processPath(await fs.resolve(dir))
    } catch (error) {
      return dir
    }
  }

  // ---------- configuration ----------
  function readProfile() {
    const value = settings.get(SETTINGS_NS)
    const read = (key) => value !== undefined && value !== null && typeof value[key] === 'string' ? value[key] : ''
    return { baseUrl: read('baseUrl'), model: read('model'), videoModel: read('videoModel') }
  }

  async function resolveApiKey(argKey) {
    if (typeof argKey === 'string' && argKey !== '') return argKey
    if (credentials !== undefined) {
      try {
        const resolved = await credentials.resolve(CRED_REF)
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value !== '') return resolved.value
      } catch (error) { /* fall through */ }
    }
    return await loadFallbackKey()
  }

  async function storeApiKey(key) {
    if (credentials !== undefined) {
      try {
        await credentials.set(CRED_REF, key)
        return 'credentials'
      } catch (error) { /* fall through to file */ }
    }
    await saveFallbackKey(key)
    return 'config file'
  }

  async function clearApiKey() {
    if (credentials !== undefined) {
      try { await credentials.unset(CRED_REF) } catch (error) { /* ignore */ }
    }
    try { await saveFallbackKey(undefined) } catch (error) { /* ignore */ }
  }

  function normalizeBase(base) {
    let value = String(base === undefined ? '' : base).trim().replace(/\/+$/, '')
    if (value === '') value = DEFAULT_BASE
    if (value.slice(-17) === '/chat/completions') return value
    if (value.slice(-3) === '/v1') return value + '/chat/completions'
    return value + '/v1/chat/completions'
  }

  async function resolveCommon(args, useVideoModel) {
    const profile = readProfile()
    const env = await readEnv()
    let base = typeof args.baseUrl === 'string' && args.baseUrl !== '' ? args.baseUrl : undefined
    if (base === undefined) base = profile.baseUrl || env.OPENAI_BASE_URL
    let model = typeof args.model === 'string' && args.model !== '' ? args.model : undefined
    if (model === undefined) {
      if (useVideoModel) model = profile.videoModel || env.OPENAI_VIDEO_MODEL || profile.model || env.OPENAI_VISION_MODEL
      else model = profile.model || env.OPENAI_VISION_MODEL
    }
    if (model === undefined || model === '') model = DEFAULT_MODEL
    const key = await resolveApiKey(args.apiKey)
    if (key === undefined) throw new Error('no API key configured: pass apiKey, or set one with the vision_config tool')
    return { base: base, model: model, key: key }
  }

  // ---------- API plumbing ----------
  async function toMediaUrl(pathOrUrl, signal, maxBytes) {
    const input = String(pathOrUrl === undefined ? '' : pathOrUrl)
    if (/^https?:\/\//i.test(input)) return input
    if (/^data:/i.test(input)) return input
    const target = await fs.resolve(input)
    const bytes = await fs.readBytes(target, signal, maxBytes)
    const mime = mimeFromName(input) || 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64Bytes(bytes)
  }

  async function chatCompletion(options) {
    const url = normalizeBase(options.base)
    const body = { model: options.model, messages: options.messages, max_tokens: options.maxTokens }
    const headers = 'Content-Type: application/json\nAuthorization: Bearer ' + options.key + '\n'
    const tmp = await tmpDir()
    const headersFile = tmp + '/headers.txt'
    const outFile = tmp + '/response.json'
    await fs.writeText(await fs.resolve(headersFile), headers)
    const curl = await getCurl()
    if (curl === undefined) throw new Error('curl executable not found; cannot call the API')
    const res = await runProc(
      [curl, '-sS', '--max-time', '280', '-X', 'POST', url, '--header', '@' + headersFile, '--data-binary', '@-', '-o', outFile, '-w', '%{http_code}'],
      { stdinData: JSON.stringify(body), maxOut: 65536, maxErr: 524288, signal: options.signal },
    )
    const status = parseInt(res.out.trim(), 10)
    let raw = ''
    try {
      const bytes = await fs.readBytes(await fs.resolve(outFile), options.signal, 8 * 1048576)
      raw = new TextDecoder().decode(bytes)
    } catch (error) {
      raw = ''
    }
    let data = null
    try { data = JSON.parse(raw) } catch (error) { data = null }
    if (!(status >= 200 && status < 300)) {
      let message = raw.slice(0, 600)
      if (data !== null && data.error !== undefined && typeof data.error === 'object' && data.error.message !== undefined) message = String(data.error.message)
      else if (data !== null && data.error !== undefined && typeof data.error === 'object' && data.error.code !== undefined) message = String(data.error.code)
      else if (data !== null && data.message !== undefined) message = String(data.message)
      throw new Error('OpenAI-compatible API error (HTTP ' + status + '): ' + message)
    }
    if (data === null || data.choices === undefined || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('unexpected API response: ' + raw.slice(0, 600))
    }
    const message = data.choices[0].message !== undefined && data.choices[0].message !== null ? data.choices[0].message : {}
    let content = ''
    if (typeof message.content === 'string') content = message.content
    else if (Array.isArray(message.content)) {
      const pieces = []
      for (const part of message.content) {
        if (part !== null && typeof part === 'object' && typeof part.text === 'string') pieces.push(part.text)
      }
      content = pieces.join('')
    }
    if (content === '' && typeof message.refusal === 'string') content = '[model refused] ' + message.refusal
    if (content === '') throw new Error('empty completion content from API')
    const usageOut = {}
    if (data.usage !== undefined && data.usage !== null) {
      if (typeof data.usage.prompt_tokens === 'number') usageOut.promptTokens = data.usage.prompt_tokens
      if (typeof data.usage.completion_tokens === 'number') usageOut.completionTokens = data.usage.completion_tokens
      if (typeof data.usage.total_tokens === 'number') usageOut.totalTokens = data.usage.total_tokens
    }
    return {
      content: content,
      model: typeof data.model === 'string' ? data.model : options.model,
      usage: usageOut,
    }
  }

  // ---------- renderers ----------
  function renderAnswer(_args, value) {
    const lines = []
    if (value !== null && typeof value === 'object' && typeof value.content === 'string') lines.push(value.content)
    if (value !== null && typeof value === 'object' && typeof value.model === 'string') {
      lines.push('')
      if (typeof value.frames === 'number') lines.push('[' + value.frames + ' frames, model: ' + value.model + ']')
      else lines.push('[model: ' + value.model + ']')
    }
    return [{ type: 'text', text: lines.join('\n') }]
  }

  function renderConfig(_args, value) {
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
  }

  // ---------- tools ----------
  tools.register(defineTool({
    name: 'vision_image',
    description: 'Understand one image (local file path, http(s) URL, or data URL) through an OpenAI-compatible chat/completions vision endpoint. Sends the image as an image_url content part in standard OpenAI format. Configuration comes from optional per-call args, then the dsh-vision profile (vision_config tool / settings), then OPENAI_BASE_URL / OPENAI_VISION_MODEL environment variables. Default endpoint is https://api.openai.com/v1 with model gpt-4o-mini.',
    parameters: {
      image: { type: 'string', required: true, description: 'Local image file path, http(s) URL, or existing data: URL.' },
      prompt: { type: 'string', required: true, description: 'What to ask about the image.' },
      baseUrl: { type: 'string', description: 'OpenAI-compatible API base. Accepted forms: https://api.openai.com/v1, https://host/v1, or a full .../chat/completions URL.' },
      apiKey: { type: 'string', description: 'API key override. Prefer storing it with vision_config.' },
      model: { type: 'string', description: 'Vision model override.' },
      detail: { type: 'string', enum: ['auto', 'low', 'high'], description: 'OpenAI image detail level. Default auto.' },
      maxTokens: { type: 'integer', description: 'Maximum completion tokens. Default 1024.' },
    },
    output: { schema: { type: 'json' }, render: renderAnswer },
    async execute(args, exec) {
      const common = await resolveCommon(args, false)
      const imageUrl = await toMediaUrl(args.image, exec.signal, 20 * 1048576)
      const detail = args.detail === 'low' || args.detail === 'high' ? args.detail : 'auto'
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: String(args.prompt) },
          { type: 'image_url', image_url: { url: imageUrl, detail: detail } },
        ],
      }]
      const res = await chatCompletion({
        base: common.base, key: common.key, model: common.model, messages: messages,
        maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 1024, signal: exec.signal,
      })
      return { content: res.content, model: res.model, usage: res.usage }
    },
  }))

  tools.register(defineTool({
    name: 'vision_video',
    description: 'Understand a video through an OpenAI-compatible chat/completions endpoint. Default mode extracts sampled frames with ffmpeg (found on PATH or in the nix store) and sends them as chronological image_url parts, which works with any OpenAI-compatible vision endpoint. Set direct: true to pass the whole video as one media part instead, which requires a video-native backend (e.g. Gemini-compatible).',
    parameters: {
      video: { type: 'string', required: true, description: 'Local video file path or http(s) URL.' },
      prompt: { type: 'string', required: true, description: 'What to ask about the video.' },
      fps: { type: 'number', description: 'Frame sampling rate in frames per second. Default 0.5.' },
      maxFrames: { type: 'integer', description: 'Maximum frames to send (1-32). Default 12.' },
      direct: { type: 'boolean', description: 'Pass the whole video as one media part instead of extracting frames. Requires a video-native backend.' },
      baseUrl: { type: 'string', description: 'OpenAI-compatible API base override.' },
      apiKey: { type: 'string', description: 'API key override. Prefer storing it with vision_config.' },
      model: { type: 'string', description: 'Model override. Defaults to videoModel from the dsh-vision profile, else OPENAI_VIDEO_MODEL, else the image model.' },
      maxTokens: { type: 'integer', description: 'Maximum completion tokens. Default 2048.' },
    },
    output: { schema: { type: 'json' }, render: renderAnswer },
    async execute(args, exec) {
      const common = await resolveCommon(args, true)
      const maxFrames = Math.min(32, Math.max(1, typeof args.maxFrames === 'number' ? Math.floor(args.maxFrames) : 12))
      const fps = Math.min(10, Math.max(0.05, typeof args.fps === 'number' ? args.fps : 0.5))
      let frames = 0
      let contentParts
      if (args.direct === true) {
        const videoUrl = await toMediaUrl(args.video, exec.signal, 120 * 1048576)
        contentParts = [
          { type: 'text', text: 'The following media is a video. ' + String(args.prompt) },
          { type: 'image_url', image_url: { url: videoUrl } },
        ]
      } else {
        const ffmpeg = await getFfmpeg()
        if (ffmpeg === undefined) throw new Error('ffmpeg not found (checked PATH and the nix store). Install ffmpeg, or retry with direct: true if the endpoint accepts whole videos.')
        const tmp = await tmpDir()
        const outPattern = tmp + '/frame_%04d.jpg'
        const res = await runProc(
          [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', String(args.video), '-vf', 'fps=' + fps + ",scale='min(896,iw)':-2", '-frames:v', String(maxFrames), '-q:v', '4', outPattern],
          { cwd: tmp, maxOut: 65536, maxErr: 524288, signal: exec.signal },
        )
        if (res.code !== 0) {
          const detail = (res.err || res.out || '').trim().slice(0, 800)
          throw new Error('ffmpeg frame extraction failed: ' + detail)
        }
        let entries = []
        try { entries = await fs.listDir(await fs.resolve(tmp)) } catch (error) { entries = [] }
        const names = entries
          .filter(function (e) { return e.type === 'file' && /^frame_\d+\.jpg$/.test(e.name) })
          .map(function (e) { return e.name })
          .sort()
          .slice(0, maxFrames)
        frames = names.length
        if (frames === 0) throw new Error('ffmpeg produced no frames')
        const parts = []
        parts.push({ type: 'text', text: 'The following ' + frames + ' images are frames sampled from a video at ' + fps + ' fps, in chronological order; frame i (1-based) is at roughly (i-1)/' + fps + ' seconds. ' + String(args.prompt) })
        for (let i = 0; i < names.length; i += 1) {
          const bytes = await fs.readBytes(await fs.resolve(tmp + '/' + names[i]), exec.signal, 3 * 1048576)
          parts.push({ type: 'text', text: '[Frame ' + (i + 1) + ']' })
          parts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64Bytes(bytes) } })
        }
        contentParts = parts
      }
      const messages = [{ role: 'user', content: contentParts }]
      const res = await chatCompletion({
        base: common.base, key: common.key, model: common.model, messages: messages,
        maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 2048, signal: exec.signal,
      })
      const out = { content: res.content, model: res.model, usage: res.usage }
      if (frames > 0) { out.frames = frames; out.fps = fps }
      return out
    },
  }))

  tools.register(defineTool({
    name: 'vision_config',
    description: 'Read or update the saved OpenAI-compatible vision profile used by vision_image and vision_video: baseUrl, default image/video models (stored in the dsh-vision settings namespace) and the API key (stored in the credentials service, falling back to ~/.config/dsh-vision/config.json).',
    parameters: {
      action: { type: 'string', required: true, enum: ['get', 'set', 'unset'], description: 'get: show current profile (key masked); set: save the provided fields; unset: reset everything.' },
      baseUrl: { type: 'string', description: 'OpenAI-compatible API base, e.g. https://api.openai.com/v1.' },
      apiKey: { type: 'string', description: 'API key to store.' },
      model: { type: 'string', description: 'Default image model, e.g. gpt-4o-mini or qwen-vl-max.' },
      videoModel: { type: 'string', description: 'Default video model.' },
    },
    output: { schema: { type: 'json' }, render: renderConfig },
    async execute(args) {
      const profile = readProfile()
      if (args.action === 'get') {
        const key = await resolveApiKey(undefined)
        return {
          baseUrl: profile.baseUrl !== '' ? profile.baseUrl : '(unset, default ' + DEFAULT_BASE + ')',
          model: profile.model !== '' ? profile.model : '(unset, default ' + DEFAULT_MODEL + ')',
          videoModel: profile.videoModel !== '' ? profile.videoModel : '(unset, falls back to image model)',
          apiKeyConfigured: key !== undefined,
          settingsNamespace: SETTINGS_NS,
        }
      }
      if (args.action === 'set') {
        const patch = {}
        if (typeof args.baseUrl === 'string' && args.baseUrl !== '') patch.baseUrl = args.baseUrl
        if (typeof args.model === 'string' && args.model !== '') patch.model = args.model
        if (typeof args.videoModel === 'string' && args.videoModel !== '') patch.videoModel = args.videoModel
        if (Object.keys(patch).length > 0) await settings.update(SETTINGS_NS, patch)
        let apiKeyStored = 'not-provided'
        if (typeof args.apiKey === 'string' && args.apiKey !== '') {
          apiKeyStored = await storeApiKey(args.apiKey)
        } else if (typeof args.apiKey === 'string') {
          await clearApiKey()
          apiKeyStored = 'cleared'
        }
        return { saved: true, apiKeyStored: apiKeyStored, settingsNamespace: SETTINGS_NS }
      }
      if (args.action === 'unset') {
        await settings.replace(SETTINGS_NS, {})
        await clearApiKey()
        return { reset: true, settingsNamespace: SETTINGS_NS }
      }
      throw new Error('unknown action: ' + String(args.action))
    },
  }))

  // ---------- browser RPC channel (composer upload button) ----------
  // Serves the dsh-vision-client upload button: "status" probes configuration,
  // "analyze" runs the same vision call as the vision_image tool on an image
  // the browser sends as a data: URL. The client half calls this channel via
  // ctx.connection.rpc.call('/dsh-vision', 'analyze', payload).
  const connection = ctx.get('connection')
  if (connection !== undefined && connection.rpc !== undefined && typeof connection.rpc.handle === 'function') {
    const rpcHandler = async (endpoint, payload, signal) => {
      try {
        if (endpoint === 'status') {
          const key = await resolveApiKey(undefined)
          const profile = readProfile()
          return {
            ok: true,
            value: {
              configured: key !== undefined,
              baseUrl: profile.baseUrl !== '' ? profile.baseUrl : null,
              model: profile.model !== '' ? profile.model : null,
            },
          }
        }
        if (endpoint === 'analyze') {
          const input = payload !== null && typeof payload === 'object' ? payload : {}
          if (typeof input.dataUrl !== 'string' || input.dataUrl === '') {
            return { ok: false, error: { code: 'bad-request', message: 'missing dataUrl', details: { issues: [] } } }
          }
          const prompt = typeof input.prompt === 'string' && input.prompt.trim() !== '' ? input.prompt : '请详细描述这张图片的内容。'
          const common = await resolveCommon(input, false)
          const detail = input.detail === 'low' || input.detail === 'high' ? input.detail : 'auto'
          const messages = [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: String(input.dataUrl), detail: detail } },
            ],
          }]
          const res = await chatCompletion({
            base: common.base, key: common.key, model: common.model, messages: messages,
            maxTokens: typeof input.maxTokens === 'number' ? input.maxTokens : 1024, signal: signal,
          })
          return { ok: true, value: { content: res.content, model: res.model } }
        }
        return { ok: false, error: { code: 'bad-request', message: 'unknown endpoint: ' + String(endpoint), details: { issues: [] } } }
      } catch (error) {
        return { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} } }
      }
    }
    const disposeChannel = connection.rpc.handle('/dsh-vision', rpcHandler, { authority: 'loopback' })
    ctx.on('dispose', function () {
      disposeChannel().catch(function () { /* ignore disposal errors */ })
    })
    console.log('[dsh-vision] browser RPC channel ready: /dsh-vision (analyze, status)')
  } else {
    console.warn('[dsh-vision] connection service unavailable; browser upload channel disabled')
  }

  console.log('[dsh-vision] installed: vision_image, vision_video, vision_config')
}
