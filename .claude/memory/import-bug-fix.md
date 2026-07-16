---
name: import-bug-fix
description: 修复 main.ts 漏导入 AiVoicePolishSettingTab 导致设置页不显示的 bug
metadata:
  type: feedback
---

## Import 遗漏导致设置页不显示

**现象：** 插件在 Obsidian 中显示已安装，但无设置按钮（齿轮图标），只有开关。

**根因：** `src/main.ts` 第 11-14 行 `import` 语句只导入了 `DEFAULT_SETTINGS` 和 `AiVoicePolishSettings`（interface），**遗漏了 `AiVoicePolishSettingTab`**。

```
// ❌ 原来
import { DEFAULT_SETTINGS, AiVoicePolishSettings } from "./settings";

// ✅ 修复后
import { DEFAULT_SETTINGS, AiVoicePolishSettings, AiVoicePolishSettingTab } from "./settings";
```

**影响：** esbuild 的 tree-shaking 将 `AiVoicePolishSettingTab`（设置面板类）当作死代码剪掉了。导致：
1. `addSettingTab(undefined)` 抛错
2. `onload()` 中断
3. 设置页、Ribbon 图标、命令全部不生效

**Why it happened:** 该插件是用户从零搭建的新项目，导入语句写法不完整，esbuild 不会检查类型错误。

**How to apply:** 在 `main.ts` 中从 `settings.ts` 导入类时，确保所有在代码中使用的导出都已包含在 import 中。
