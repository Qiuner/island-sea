# DeepSeek API Key 配置

这份文档只需要你完成一件事：把自己的 DeepSeek API Key 填进项目根目录的 `.dev.vars`。

## 1. 打开 `.dev.vars`

项目根目录下应该已经有一个 `.dev.vars` 文件。

如果没有，就复制 `.dev.vars.example` 的内容，新建一个 `.dev.vars`。

## 2. 填写 DeepSeek 配置

把 `.dev.vars` 调整为下面这样：

```env
DEEPSEEK_API_KEY=你的_DeepSeek_API_Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

如果你想使用更强的模型，可以把模型改成：

```env
DEEPSEEK_MODEL=deepseek-v4-pro
```

## 3. 重启本地服务

保存 `.dev.vars` 后，重启本地开发服务：

```bash
npm run dev
```

## 4. 当前代码读取规则

后端会优先读取：

```env
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
DEEPSEEK_BASE_URL
```

为了兼容旧配置，代码仍然会 fallback 到：

```env
DASHSCOPE_API_KEY
BAILIAN_MODEL
BAILIAN_BASE_URL
```

但后续建议只使用 DeepSeek 这一组变量。
