# dsh-plugin-live-terminal

Session-scoped live output for DeepSeek Harness Web UI.

## Migrated interface

The expandable **Live Terminal** panel appears below the conversation composer through the public `conversation.composer.dock` Slot. Native tool cards and the background-job list are preserved. The previous body-mounted modal, card interception and “View block” history navigation are not provided by this version.

Open the panel and select a retained job or observed shell command. You can read and copy its output. **Stop job / command** asks for confirmation and requests termination of its producer. **Stop waiting**, shown during a waiting `job_output` call, aborts only the wait and leaves the job running.

Closing the panel stops browser polling. Changing conversations resets the selection and aborts pending requests. Text uses the locale service (English, Brazilian Portuguese and Chinese); styles use DSH theme aliases.

## Contracts and limits

- Source migration targets DSH `0.2.0-rc.2` and Cordis `4.0.4`; runtime compatibility has not been validated. Older DSH versions are not supported by this migration.
- Jobs use public `list/get/readAt/kill` methods. Absolute output reads do not consume the model cursor.
- Every route requires a session ID and selects records by ID within that session. Unowned records are excluded. The session ID is a scope selector, not an authentication secret; authentication remains the Harness web server's responsibility.
- Shell observation uses an effect-owned, reversible wrapper around public `subprocess.spawn`; the installed contract has no observer-registration API. The original handle is returned unchanged, and collected stdout is read without consuming producer streams.
- Only subprocesses carrying `DSH_SESSION_ID` and the plugin's `DSH_CALL_ID` contribution are observed. Piped/uncollected output, separate stderr and PTYs are not supported.
- Host stdout collection polls every 150 ms. While open, the Client polls the list every second and active output every 250 ms. These are intervals, not latency guarantees.
- Job output follows registry retention. Shell output is capped at 300,000 characters and 50 finished shell records. Truncation is indicated. Plugin disposal clears its observation state and timers without terminating producers.

## Installation

Use the Harness bundle manager in the intended profile. For a local checkout, supply its absolute directory to `install_bundle`. Installation affects all sessions in that profile; its application result determines whether a restart is needed. Do not manually edit profile manifests or run a package manager in the profile directory.

No installation or restart was performed for this migration.

## Validation status

Final source changes have not been tested, syntax-checked, installed or exercised in a browser/runtime. No push or PR was performed. Existing tests contain assumptions about the previous Client and legacy mocks and do not establish compatibility with this migration. Validation is left to the user.

## Português

O **Terminal ao vivo** fica abaixo do compositor e preserva os cards nativos. **Parar job / comando** solicita o encerramento do produtor; **Parar espera** cancela somente a espera de `job_output`. Saídas truncadas são sinalizadas. A migração ainda não foi validada em execução nem instalada.

## Tiếng Việt

Bảng **Live Terminal** nằm dưới trình soạn thảo và giữ nguyên thẻ công cụ gốc. **Stop job / command** yêu cầu dừng tiến trình; **Stop waiting** chỉ hủy việc chờ `job_output`. Bản chuyển đổi này chưa được kiểm tra trong runtime hoặc cài đặt.

## 中文

**实时终端**位于会话输入区下方，不修改原生工具卡片。**停止任务 / 命令**请求终止执行；**停止等待**仅取消 `job_output` 的等待。输出截断会显示提示。本次迁移尚未经过运行时验证或安装。

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
