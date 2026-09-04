# dsh-plugin-live-terminal

[English](README.md) | [Tiếng Việt](#tiếng-việt) | [中文](#中文)

A real-time live streaming terminal output plugin for **DeepSeek Harness (DSH Desktop)**.

By default, DSH buffers standard output and only presents the completed terminal card once the command settles. **dsh-plugin-live-terminal** intercepts stdout chunks during execution and streams them directly into an expandable, native-styled live terminal inside the conversation view in real time.

---

## Features

- 🟢 **Real-time Live Stream**: View stdout lines as they are produced every 250ms rather than waiting for command completion.
- 🎨 **100% Native Design**: Seamlessly aligns with DSH's official `--dsw-*` design tokens, font hierarchy, and theme colors (Catppuccin, Dark, Light).
- 📌 **Pinned Sticky Header**: The command prompt header remains pinned while the output scrolls independently.
- ⚡ **Zero External Dependencies**: Lightweight Cordis client/server extension with automatic lifecycle cleanup upon process settlement.

---

## Installation

### Method 1: Via DSH CLI

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

### Method 2: Via DSH Desktop Plugin Market

1. Open **DSH Desktop**.
2. Go to **Settings** → **Plugin Market**.
3. Search for `dsh-plugin-live-terminal` and click **Install**.

---

## How It Works

1. When a shell command (`pwsh`, `bash`) begins execution, the plugin detects the running block.
2. Clicking the tool call row expands the **Live Terminal View**.
3. Stdout stream is captured from `ctx.subprocess` and fed into the live terminal console in real-time.
4. Once the process settles, the live viewer gracefully steps aside and hands over to DSH's native settled terminal card.

---

<a name="tiếng-việt"></a>

## Tiếng Việt

Plugin hỗ trợ xem **Live Stream Terminal Output** theo thời gian thực cho **DeepSeek Harness (DSH Desktop)**.

### Tính năng nổi bật

- 🟢 **Xem log trực tiếp**: Không cần chờ lệnh kết thúc mới xem được kết quả, log xuất hiện ngay khi script in ra console.
- 🎨 **Giao diện chuẩn gốc**: Đồng bộ 100% với giao diện, màu sắc và theme của DSH Desktop.
- 📌 **Cố định Header**: Header chứa câu lệnh luôn được giữ cố định ở trên cùng khi cuộn xem log bên dưới.
- ⚡ **Tự động dọn dẹp**: Khi lệnh chạy xong, giao diện tự động trả lại khối hiển thị mặc định của DSH.

### Cách cài đặt

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

---

<a name="中文"></a>

## 中文

适用于 **DeepSeek Harness (DSH Desktop)** 的实时终端流式输出查看插件。

### 功能特点

- 🟢 **实时流式输出**：命令运行时无需等待完成，实时查看标准输出（stdout）。
- 🎨 **原生样式对齐**：完全适配 DSH 官方 `--dsw-*` 设计规范及主题（Catppuccin、暗色、亮色）。
- 📌 **固定命令头**：支持独立滚动日志，保持顶部命令提示栏固定。
- ⚡ **自动交接**：命令执行完毕后自动切回官方默认结果展示卡片。

### 安装方法

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
