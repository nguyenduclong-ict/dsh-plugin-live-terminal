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
- ⏹️ **Stop, Scoped to the Right Thing**: On a `job_output` card, **Stop** ends only the waiting tool call and leaves the background job running; on a `pwsh`/`bash` card it still kills the job or process.
- 🖥️ **Output Modal**: From a `job_output` card, or by clicking a row in DSH's own background-job list, the job's output opens in a modal with **View block** (jump to the card running it — paging older history in when the transcript has not loaded it yet), **Copy**, and **Stop job**. It reads output by job id, so it still works once the spawning card is out of the transcript.

---

## Installation

### For DSH Desktop

#### Windows (PowerShell)

```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### macOS (Terminal)

```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### Linux (Terminal)

```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

*After installing, restart **DSH Desktop** to apply the plugin.*

---

### For DSH CLI (All Platforms)

If you are using the standalone `dsh` CLI:

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

---

## How It Works

1. When a shell command (`pwsh`, `bash`) begins execution, the plugin detects the running block.
2. Clicking the tool call row expands the **Live Terminal View**.
3. Stdout stream is captured from `ctx.subprocess` and fed into the live terminal console in real-time.
4. Once the process settles, the live viewer gracefully steps aside and hands over to DSH's native settled terminal card.
5. Job-centric views (a `job_output` card, or a row of the session's background-job list) open one shared **output modal**; it streams by job id from the host, so it keeps working even when the card that spawned the job has left the transcript — the case where the old "View Job" action answered *Job not found*.

---

<a name="tiếng-việt"></a>

## Tiếng Việt

Plugin hỗ trợ xem **Live Stream Terminal Output** theo thời gian thực cho **DeepSeek Harness (DSH Desktop)**.

### Tính năng nổi bật

- 🟢 **Xem log trực tiếp**: Không cần chờ lệnh kết thúc mới xem được kết quả, log xuất hiện ngay khi script in ra console.
- 🎨 **Giao diện chuẩn gốc**: Đồng bộ 100% với giao diện, màu sắc và theme của DSH Desktop.
- 📌 **Cố định Header**: Header chứa câu lệnh luôn được giữ cố định ở trên cùng khi cuộn xem log bên dưới.
- ⚡ **Tự động dọn dẹp**: Khi lệnh chạy xong, giao diện tự động trả lại khối hiển thị mặc định của DSH.
- ⏹️ **Stop đúng phạm vi**: Trên card `job_output`, nút **Stop** chỉ kết thúc tool call đang chờ, job nền vẫn tiếp tục chạy; trên card `pwsh`/`bash` thì vẫn kill job/tiến trình như cũ.
- 🖥️ **Modal xem output**: Từ card `job_output`, hoặc click vào một dòng trong danh sách background job của DSH, output của job mở trong modal kèm **View block** (nhảy tới card đang chạy job đó — tự nạp thêm history cũ nếu transcript chưa load tới), **Copy** và **Stop job**. Modal đọc output theo job id nên vẫn dùng được khi card khởi tạo job đã rời khỏi transcript.

### Cách cài đặt trên DSH Desktop

#### Windows (PowerShell):
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### macOS (Terminal):
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### Linux (Terminal):
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

*Khởi động lại DSH Desktop sau khi cài đặt.*

---

<a name="中文"></a>

## 中文

适用于 **DeepSeek Harness (DSH Desktop)** 的实时终端流式输出查看插件。

### 功能特点

- 🟢 **实时流式输出**：命令运行时无需等待完成，实时查看标准输出（stdout）。
- 🎨 **原生样式对齐**：完全适配 DSH 官方 `--dsw-*` 设计规范及主题（Catppuccin、暗色、亮色）。
- 📌 **固定命令头**：支持独立滚动日志，保持顶部命令提示栏固定。
- ⚡ **自动交接**：命令执行完毕后自动切回官方默认结果展示卡片。
- ⏹️ **按上下文停止**：在 `job_output` 卡片上，**Stop** 只结束正在等待的工具调用，后台任务继续运行；在 `pwsh`/`bash` 卡片上仍然终止任务或进程。
- 🖥️ **输出弹窗**：从 `job_output` 卡片，或点击 DSH 后台任务列表中的一行，即可在弹窗中查看该任务的输出，并提供 **View block**（跳转到运行该任务的卡片，必要时自动加载更早的历史）、**Copy** 与 **Stop job**。弹窗按 job id 读取输出，因此即便发起任务的卡片已离开对话记录也仍然可用。

### DSH Desktop 安装方法

#### Windows (PowerShell):
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### macOS (Terminal):
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

#### Linux (Terminal):
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-plugin-live-terminal
```

*安装完成后重启 DSH Desktop 即可。*

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
