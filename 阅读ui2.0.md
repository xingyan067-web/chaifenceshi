
# 📖 韩系极简阅读 App (v2.8) - 核心 PRD 与严格 UI 开发规范

> **⚠️ 致开发 Agent (Claude Code / DeepSeek) 的最高指令：**
> 本应用主打「无色彩韩系极简、手账拍立得风、微排版」。**严禁**使用 Material Design 或普通卡片的常规布局思维来覆盖样式。你必须**严格、1:1 地遵循**本文档中提供的 DOM 嵌套结构和精确到像素的 CSS 绝对定位值，否则将丢失设计的核心灵魂。

---

## 🎨 一、 核心视觉规范 (Design System)

### 1. 全局色彩变量 (严格使用以下色值，不要加彩色)
*   **页面外层背景 (Body/Outside)**：`#D5D5D5`
*   **App 主背景色 (App Container)**：`#F8F8F8` (纯净微灰)
*   **卡片/浮层底色 (Surface)**：`#FFFFFF` (纯白)
*   **照片占位区底色 (Placeholder)**：`#EEEEEE`
*   **主标题/强调文本 (Primary Text)**：`#1A1A1A` (深黑灰)
*   **次要/副标题文本 (Secondary Text)**：`#8E8E8E` 或 `#999999`
*   **极细线框/分割线 (Border)**：`#E5E5E5` 或 `#E0E0E0`

### 2. 字体与排版 (Typography)
*   **大标题 (Large Title)**：所有一级页面（书架、统计、我的）顶部标题必须**最左对齐**。上方一行 `10px` 英文副标题（全大写, `letter-spacing: 2px`），下方是 `28px` 中文大标题（`font-weight: 800`）。取消原有的顶部 `<` 返回键和 `≡` 菜单键。
*   **微排版 (Micro-typography)**：页面中的辅助英文（如卡片底部的句子），必须使用**全大写 (uppercase)**、极小字号 (`8px`)、并拉大字间距 (`letter-spacing: 1.5px`)。

---

## 📸 二、 书籍卡片：严格 DOM 结构与 CSS (重中之重)

书架列表里的书籍卡片，必须模拟出**真实相纸、半透明纸胶带贴纸、破边标签**的感觉。**请直接使用以下结构和 CSS 核心属性，禁止擅自修改：**

### 1. DOM 嵌套结构
```html
<div class="card">
  <!-- 顶部：仅靠右放置标签 -->
  <div class="card-top-bar">
    <div class="ui-btn-pill">End Meeting</div>
  </div>
  
  <!-- 照片区 (相对定位体系) -->
  <div class="cover">
    <!-- 胶带：必须绝对定位在正上方并倾斜 -->
    <div class="washi-tape"></div>
    
    <!-- 中心装饰：圆框 + SVG线稿 (若有自定义封面则被覆盖) -->
    <div class="cover-center-graphic"> [此处放SVG花朵或留空] </div>
    
    <!-- 标签：必须绝对定位在左下角，并溢出底边 -->
    <div class="cover-tag">Beloved</div>
  </div>

  <!-- 底部：微排版区域 -->
  <div class="card-info">
    <div class="card-book-title">看不见的城市</div>
    <div class="card-book-author">SOULS, BETWEEN LINES.</div>
  </div>
</div>
```

### 2. 必须生效的 CSS 核心代码
*   **`.card` (拍立得外框)**：`background: #FFFFFF; border-radius: 12px; padding: 6px 6px 14px 6px;` (注意底部 padding 必须更大，形成相纸下巴) `box-shadow: 0 10px 20px rgba(0,0,0,0.05);`
*   **`.cover` (灰色照片区)**：`position: relative; height: 160px; background: #EEEEEE; border-radius: 6px; border: 1px solid #E5E5E5; overflow: hidden;`
*   **`.washi-tape` (半透明胶带)**：`position: absolute; top: -4px; left: 50%; transform: translateX(-50%) rotate(-2deg); width: 45px; height: 14px; background: rgba(255,255,255,0.6); backdrop-filter: blur(2px); border: 1px solid rgba(0,0,0,0.04); z-index: 10;`
*   **`.cover-tag` (破边状态标签)**：`position: absolute; bottom: -6px; left: 4px;` (**关键：负的 bottom 才能压在线上**)，`background: #FFFFFF; border: 1px solid #1A1A1A; font-size: 9px; font-weight: 700; color: #1A1A1A; z-index: 10;`
*   **`.card-book-author` (极简英文)**：`font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #999999;`

---

## 🪟 三、 书籍详情：3D 翻转弹窗交互

用户点击书籍卡片时，弹出一个遮罩层及详情卡片：
*   **遮罩背景**：`#F8F8F8` (85%透明度) + `backdrop-filter: blur(12px)`。纯净毛玻璃，**不要任何波点**。
*   **正反面翻转逻辑 (Flip Modal)**：
    *   弹窗主体 `.popup-main-part` 设为 `position: relative; overflow: hidden;`
    *   **正面 (封面)** 和 **反面 (详情清单)** 通过类名（如 `.show-details`）控制 `opacity` 和 `transform: translateX` 来实现平滑切换（类似卡片滑动/翻转）。
    *   **底部操作栏**：绝对定位在弹窗底部，不参与翻转。左侧 `GO` (粗体小字)，中间 `开始阅读`，右侧为 `⋯`。
    *   点击 `⋯` 时，正面滑出，反面滑入展示详细信息（作者、时间、来源等），同时 `⋯` 按钮变为 `×`，再次点击可翻转回去。

---

## 📱 四、 页面功能与逻辑体系

### 1. 全局悬浮岛导航 (Floating Dock)
*   定位：`position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);`
*   样式：`background: rgba(255,255,255,0.75); backdrop-filter: blur(20px); border-radius: 100px; padding: 6px;`
*   **交互动效**：内部包含「书架、统计、我的」三个选项。未选中的项**隐藏文字**仅显示灰色图标；选中的项变为黑底白字 (`#1A1A1A`)，并**横向展开显示图标和文字**。

### 2. 统计页面 (Stats) - 按月滑动日历
*   **头部排版**：左对齐大标题“统计”。
*   **按月日历控件 (Month-View Calendar)**：
    *   **切换操作**：日历顶部中央显示当前月份（如 `2026年 5月`），两侧带有 `<` 和 `>` 按钮，支持点击或左右滑动切换月份。不要把所有月份一股脑铺满。
    *   **网格显示**：标准的 7 列排版（周一至周日）。天数使用灰色方块显示，阅读量越大的天数，灰色色块越深（类似高对比度的极简黑白热力图）。
*   **下半部分 (日期详情面板)**：
    *   点击某一天，下方平滑展示当天的阅读情况。
    *   内容包含：阅读时长、阅读书目，以及展示这一天记录的**「我的书评」**和**「char的书评」**片段。

### 3. 我的页面 (Profile & Menu)
*   **个人信息卡**：包含 Me 头像（黑底白字）、用户昵称、总阅读时长。
*   **列表菜单**：四个功能项：【网盘备份】、【主题设置】、【我的书评】、【char的书评】。
*   样式：白底、16px圆角、极细边框、左侧带纯色线性 SVG 图标（stroke-width: 2）。

### 4. 个性化与持久化设置 (Customization System)
需使用本地存储 (LocalStorage / AsyncStorage) 保存以下用户偏好：
*   **自定义封面**：在书架长按某本书，或在详情页翻转后的菜单中，允许用户上传/更改该书的封面图片（替换默认的灰底相框）。
*   **主题设置 (Theme)**：
    1.  支持修改全局背景（App最底层的颜色或上传的背景图）。若为图片，需加一层低透明度遮罩保证界面文字清晰。
    2.  支持全局字体切换。

---
> **执行验收标准：**
> 1. DOM 和 CSS 是否严格采用了文档中的绝对定位和负 Margin？
> 2. 胶带是否倾斜？Beloved 标签是否压线（一半在图内一半在框上）？
> 3. 是否去除了所有的原生 Material Design 阴影和波点？
> 4. 统计页日历是否实现了【左右切换月份】而不是一整张大长图？
> 如果以上确认无误，请输出代码！