# dsh-vision

OpenAI 兼容的识图 / 视频插件，安装到 DeepSeek Harness (DSH) 本体。

> **AI 生成声明**：本仓库代码由 AI 编程助手（运行于 DeepSeek Harness 的编码智能体）在仓库所有者指导下生成，并经所有者确认后发布。

提供三个工具（任意会话可用）：

| 工具 | 用途 |
|---|---|
| `vision_image` | 识图：本地文件 / http(s) URL / data URL → 标准 OpenAI `image_url` 部件发送 |
| `vision_video` | 视频理解：ffmpeg 抽帧（自动在 PATH 与 nix store 中查找），按时间顺序发送多帧；`direct: true` 时整段视频直传（需视频原生后端） |
| `vision_config` | 读取 / 写入配置（base_url、默认模型、API key） |

WebUI 配置入口（安装客户端包后）：

- **设置 → Vision**：base URL、默认图片/视频模型、API key
- **设置 → 插件 → 插件配置**：Vision 配置卡片
- **设置 → 插件 → 插件清单**：`dsh-vision-ui`（浏览器端）与 `tool-vision`（主机端）状态

配置优先级：调用参数 > `dsh-vision` 设置命名空间 / credentials > 环境变量（`OPENAI_BASE_URL`、`OPENAI_VISION_MODEL`、`OPENAI_VIDEO_MODEL`）> 默认值（`https://api.openai.com/v1`，`gpt-4o-mini`）。

## 安装

### 1. 放置插件包

把 `dsh-vision/` 与 `dsh-vision-client/` 两个目录放到你的 DSH profile 目录下（`~/.dsh/profiles/web/plugins/`），并把 `dsh-vision-client` 通过符号链接暴露为可解析包名：

```bash
PLUGIN_ROOT="$HOME/.dsh/profiles/web/plugins"
mkdir -p "$PLUGIN_ROOT"
cp -r dsh-vision dsh-vision-client "$PLUGIN_ROOT/"
ln -sfn "$PLUGIN_ROOT/dsh-vision-client" "$HOME/.dsh/profiles/node_modules/dsh-vision-ui"
```

> 放在 `profiles/` 下的原因：DSH 每次启动会修复 `~/.dsh/profiles/node_modules` 里的官方包链接，插件目录放这里可以沿 node_modules 上溯解析 `@deepseek-ai/*` 依赖。

### 2. 注册插件行

编辑 `~/.dsh/cordis.patch.yml`（机器级用户补丁层，**保存即热生效**），参考 `install/cordis.patch.example.yml`：

```yaml
- insert:
    - id: tool-vision
      name: file:///home/你的用户名/.dsh/profiles/web/plugins/dsh-vision/index.js
    - id: tool-vision-ui
      name: dsh-vision-ui
```

保存后几秒内工具即注册（`Tool.listTools` 可见）；WebUI 客户端部分需**刷新页面**一次。

### 3. 配置

- 用工具：`vision_config { action: set, baseUrl: "...", apiKey: "...", model: "...", videoModel: "..." }`
- 或用 WebUI：设置 → Vision（base_url / 模型 / API key 直接填）

API key 存入 DSH credentials 服务（`~/.dsh/.credentials.yaml` 的 `DSH_VISION_API_KEY`），不会写入仓库与配置文件的明文之外。

## 卸载

删除 `~/.dsh/cordis.patch.yml` 中对应行（热生效），再删除插件目录与符号链接。

## 依赖

- `curl`（API 调用）
- `ffmpeg`（视频抽帧；PATH 或 nix store 中任意一个即可）

## 说明

- 客户端 bundle（`dsh-vision-client/lib/client.js`）为手工编写的浏览器插件，依赖前端种子模块（`react`、`@deepseek-ai/dsh-client-web-react` 等），无需构建工具链。
- 该仓库不含任何密钥；所有路径示例请按本机实际情况替换。

## License

[MIT](LICENSE)
