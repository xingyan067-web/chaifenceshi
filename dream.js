/* ==========================================================================
   梦境系统 (Dream Space) 逻辑
   ========================================================================== */

const dreamState = {
    currentMode: 'dream', // 新增：记录当前是梦境还是线下
    cards: [], 
    presets: [], 
    selectedWbIds: [], 
    selectedPresetId: null, 
    currentChat: [],
    fontSize: 14, // 新增：梦境字体大小
    fontUrl: '',  // 新增：梦境字体URL
    fontColor: '#111111', // 新增：梦境字体颜色
    offlineContextLimit: 20, // 新增：线下上下文条数
    // 新增：扩展组件数据
    ext: {
        currentTab: 'css', // 当前停留的tab
        css: [], html: [], regex: [], // 储存的预设列表
        activeCssId: null, activeHtmlId: null, activeRegexId: null // 当前启用的ID
    }
};

// 👇 新增：记录当前打开的卡片ID和同步保存函数 👇
let currentDreamCardId = null;

function syncDreamChatHistory() {
    if (currentDreamCardId) {
        const card = dreamState.cards.find(c => c.id === currentDreamCardId);
        if (card) {
            // 将当前屏幕上的聊天记录深拷贝回卡片中
            card.chatHistory = JSON.parse(JSON.stringify(dreamState.currentChat));
            dreamSaveData(); // 保存到数据库
        }
    }
}
// 👆 新增结束 👆

async function dreamLoadData() {
    try {
        const data = await idb.get('dream_space_data');
        if (data) {
            if (data.cards) dreamState.cards = data.cards;
            if (data.presets) dreamState.presets = data.presets;
            if (data.selectedWbIds) dreamState.selectedWbIds = data.selectedWbIds;
            if (data.selectedPresetId) dreamState.selectedPresetId = data.selectedPresetId;
            // 增加安全校验，防止 data.ext 为 undefined 时报错
            if (data.ext) dreamState.ext = { ...dreamState.ext, ...data.ext };
            if (data.fontSize) dreamState.fontSize = data.fontSize;
            if (data.fontUrl !== undefined) dreamState.fontUrl = data.fontUrl;
            if (data.fontColor !== undefined) dreamState.fontColor = data.fontColor;
            if (data.offlineContextLimit !== undefined) dreamState.offlineContextLimit = data.offlineContextLimit;
        }
        applyDreamCss(); // 加载时自动应用全局 CSS
        applyDreamFontSettings(); // 加载时应用字体设置
    } catch (e) {
        console.error("加载梦境数据失败", e);
    }
}

async function dreamSaveData() {
    await idb.set('dream_space_data', {
        cards: dreamState.cards,
        presets: dreamState.presets,
        selectedWbIds: dreamState.selectedWbIds,
        selectedPresetId: dreamState.selectedPresetId,
        ext: dreamState.ext,
        fontSize: dreamState.fontSize,
        fontUrl: dreamState.fontUrl,
        fontColor: dreamState.fontColor,
        offlineContextLimit: dreamState.offlineContextLimit
    });
}

// --- 页面导航 ---
async function openDreamMainPage() {
    // 1. 强制收起键盘，防止 iOS 视口高度计算冲突导致闪退
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    wcCloseAllPanels(); // 关闭微信的更多面板
    
    // 2. 核心修复：隐藏底层的聊天界面，释放 iOS GPU 内存，防止叠加渲染导致闪退
    const chatDetail = document.getElementById('wc-view-chat-detail');
    if (chatDetail) chatDetail.style.display = 'none';

    // 3. 增加 try...catch 防止数据读取异常中断程序
    try {
        await dreamLoadData();
    } catch (e) {
        console.error("加载梦境数据失败", e);
    }
    
    // 4. 延迟 150ms 显示，避开键盘收起和面板关闭的动画期
    setTimeout(() => {
        document.getElementById('dream-main-page').classList.add('active');
        dreamRenderCards();
    }, 150);
}

function closeDreamMainPage() {
    document.getElementById('dream-main-page').classList.remove('active');
    
    // 核心修复：退出梦境时，恢复底层聊天界面的显示
    const chatDetail = document.getElementById('wc-view-chat-detail');
    if (chatDetail) chatDetail.style.display = ''; // 清除内联样式，交回给 CSS 控制
}

// --- 渲染主页卡片 ---
// --- 渲染主页卡片 (加入云朵注入按钮) ---
function dreamRenderCards() {
    const container = document.getElementById('dream-card-container');
    container.innerHTML = '';
    
    // 👇 新增：过滤出属于当前角色的卡片 (兼容旧数据：如果没有 charId 则默认都显示)
    const currentCards = dreamState.cards.filter(c => !c.charId || c.charId === wcState.activeChatId);

    if (currentCards.length === 0) {
        container.innerHTML = '<div class="dream-empty-state">No dreams yet.<br><span style="font-size:10px; color:#E5E5EA;">点击下方进入梦境</span></div>';
        return;
    }

    const sortedCards = [...currentCards].sort((a, b) => b.time - a.time);
    
    sortedCards.forEach((card, idx) => {
        const dateStr = new Date(card.time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = 'dream-card';
        div.innerHTML = `
            <div class="dream-card-cloud-btn" onclick="injectDreamToChar(${card.id})" title="将此梦境化作记忆注入给当前角色">
                <svg viewBox="0 0 24 24"><path d="M17.5 19c2.48 0 4.5-2.02 4.5-4.5 0-2.33-1.77-4.26-4.05-4.48C17.2 6.52 13.9 4 10 4 6.14 4 3 7.14 3 11c0 .17.01.34.04.5C1.3 11.83 0 13.26 0 15c0 2.21 1.79 4 4 4h13.5z"/></svg>
                <span>INJECT</span>
            </div>
            <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 12px; align-items: center; font-family: 'Courier New', monospace; font-weight: bold;">
                <div style="color: #AF52DE; cursor: pointer; font-size: 12px;" onclick="viewDreamChatHistory(${card.id})" title="查看聊天记录">CHAT</div>
                <div style="color: #007AFF; cursor: pointer; font-size: 12px;" onclick="dreamEditCard(${card.id})">EDIT</div>
                <div style="color: #CCC; cursor: pointer; font-size: 18px; line-height: 1;" onclick="dreamDeleteCard(${card.id})">×</div>
            </div>
            <div class="dream-card-date">${dateStr}</div>
            <div class="dream-card-text" style="cursor: pointer;" onclick="viewDreamChatHistory(${card.id})" title="点击回溯梦境聊天">${card.content}</div>
        `;
        container.appendChild(div);
    });
}
function dreamEditCard(id) {
    const card = dreamState.cards.find(c => c.id === id);
    if (!card) return;
    
    openIosTextEditModal("修改梦境", card.content, (newText) => {
        if (newText) {
            card.content = newText;
            dreamSaveData();
            dreamRenderCards();
        }
    });
}
// 👇 新增：补全缺失的梦境卡片删除函数 👇
function dreamDeleteCard(id) {
    if (confirm("确定要将这段梦境化作尘埃吗？")) {
        // 从数组中过滤掉要删除的卡片
        dreamState.cards = dreamState.cards.filter(c => c.id !== id);
        // 保存数据
        dreamSaveData();
        // 重新渲染卡片列表
        dreamRenderCards();
    }
}
// 👆 新增结束 👆

function viewDreamChatHistory(id) {
    const card = dreamState.cards.find(c => c.id === id);
    if (!card) return;
    
    if (card.chatHistory && card.chatHistory.length > 0) {
        currentDreamCardId = id; // 👇 新增：记录当前打开的卡片ID
        
        // 👇 核心修复：恢复当时的模式 (梦境 or 线下)
        // 兼容旧数据：如果没有 mode 字段，通过 content 判断
        if (card.mode) {
            dreamState.currentMode = card.mode;
        } else {
            dreamState.currentMode = card.content.includes('[线下见面]') ? 'offline' : 'dream';
        }

        // 恢复当时的聊天记录
        dreamState.currentChat = JSON.parse(JSON.stringify(card.chatHistory));
        
        // 恢复顶栏标题
        const titleEl = document.getElementById('dream-chat-title');
        if (titleEl) {
            titleEl.innerText = dreamState.currentMode === 'offline' ? 'IN REALITY...' : 'IN THE DREAM...';
        }

        // 打开梦境聊天界面
        document.getElementById('dream-chat-page').classList.add('active');
        dreamRenderChatWithHTML();
    } else {
        alert("这条梦境是很久以前的，没有保存聊天记录哦~");
    }
}

// --- 醒来并总结梦境/线下 (修复卡死 Bug + 线下记忆互通) ---
async function endDreamAndSummarize() {
    if (dreamState.currentChat.length <= 1) {
        document.getElementById('dream-chat-page').classList.remove('active');
        return;
    }

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先配置 API");

    const btn = document.getElementById('dream-btn-summarize');
    if (btn) btn.innerText = "总结中...";

    try {
        let prompt = "";
        let summaryPrefix = "";

        // 提取当前的梦境/线下交互记录
        let currentChatText = dreamState.currentChat
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role === 'user' ? '我' : 'Ta'}: ${m.content}`)
            .join('\n');

        if (dreamState.currentMode === 'offline') {
            // ==========================================
            // 线下模式：结合微信聊天记录进行综合总结
            // ==========================================
            const charId = wcState.activeChatId;
            const char = wcState.characters.find(c => c.id === charId);
            
            // 提取最近 20 条微信聊天记录作为前情提要
            let recentWechatMsgs = "无";
            if (char && wcState.chats[charId]) {
                recentWechatMsgs = wcState.chats[charId]
                    .filter(m => !m.isError && m.type !== 'system')
                    .slice(-20)
                    .map(m => `${m.sender === 'me' ? '我' : char.name}: ${m.content}`)
                    .join('\n');
            }

            prompt = `你现在需要以【${char ? char.name : 'Ta'}】的第一人称视角，写一段私密的回忆日记（字数150-300字）。\n`;
            prompt += `请将以下【微信上的聊天记录】和【线下见面的互动记录】结合起来，梳理出事情的起因和经过，重点表达你在线下见面时的情感波动和内心OS。\n\n`;
            prompt += `【微信上的聊天记录（起因/前情提要）】：\n${recentWechatMsgs}\n\n`;
            prompt += `【线下见面的互动记录（经过/高潮）】：\n${currentChatText}\n\n`;
            prompt += `要求：不要出现“总结”、“记录”等字眼，直接输出这段充满感情的回忆日记。`;
            
            summaryPrefix = "[线下见面]";

        } else {
            // ==========================================
            // 梦境模式：保持原有的散文诗总结
            // ==========================================
            prompt = `请将以下梦境交互记录，总结成一段极具高级感、意识流、文艺且带有一丝忧郁或唯美气息的散文诗（字数100-200字）。不要出现“总结”、“梦境记录”等字眼，直接输出这段散文。\n\n【记录】：\n${currentChatText}`;
            summaryPrefix = "[梦境残影]";
        }

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        const data = await response.json();
        let summary = data.choices[0].message.content;
        summary = summary.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

        // 1. 保存到卡片列表 (梦境和线下都保存，方便回看聊天记录)
        if (currentDreamCardId) {
            // 👇 核心修复：如果是从已有记录点进来的，直接更新原卡片，不创建新卡片
            const card = dreamState.cards.find(c => c.id === currentDreamCardId);
            if (card) {
                card.content = `${summaryPrefix} ${summary}`;
                card.chatHistory = JSON.parse(JSON.stringify(dreamState.currentChat));
                card.time = Date.now();
                card.mode = dreamState.currentMode;
            }
        } else {
            // 如果是全新的，才创建新卡片
            dreamState.cards.push({
                id: Date.now(),
                time: Date.now(),
                content: `${summaryPrefix} ${summary}`,
                chatHistory: JSON.parse(JSON.stringify(dreamState.currentChat)),
                charId: wcState.activeChatId, // 👈 新增：绑定当前角色ID，防止串线
                mode: dreamState.currentMode  // 👈 新增：记录模式
            });
        }
        await dreamSaveData();

        // 2. 如果是线下模式，直接强行注入到微信的“回忆总结”中！
        if (dreamState.currentMode === 'offline') {
            const charId = wcState.activeChatId;
            const char = wcState.characters.find(c => c.id === charId);
            if (char) {
                if (!char.memories) char.memories = [];
                char.memories.unshift({
                    id: Date.now(),
                    type: 'summary',
                    content: `[线下约会记忆] ${summary}`,
                    time: Date.now()
                });
                wcSaveData();
                
                // 顺便在微信聊天界面插入一条系统提示，让 AI 知道刚见过面
                wcAddMessage(charId, 'system', 'system', `[系统内部信息(仅AI可见): 你们刚刚结束了一次线下见面。请在接下来的聊天中，自然地提及刚才见面的细节或表达见面后的心情。]`, { hidden: true });
            }
        }

        document.getElementById('dream-chat-page').classList.remove('active');
        dreamRenderCards();

        if (dreamState.currentMode === 'offline') {
            alert("线下见面已结束。这段珍贵的记忆已自动存入 Ta 的【回忆总结】中！");
        }

    } catch (e) {
        console.error(e);
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[总结失败] ${e.message}`);
        else alert("总结失败：" + e.message);
    } finally {
        if (btn) btn.innerText = "醒来(总结)";
    }
}


// --- 设置弹窗 (世界书与预设) ---
function openDreamSettings() {
    document.getElementById('dream-settings-modal').classList.add('active');
    dreamRenderSettings();
}

function closeDreamSettings() {
    document.getElementById('dream-settings-modal').classList.remove('active');
}

function saveDreamOfflineContextLimit(val) {
    dreamState.offlineContextLimit = parseInt(val) || 20;
    dreamSaveData();
}

function dreamRenderSettings() {
    // 0. 渲染线下上下文条数和字体设置
    document.getElementById('dream-offline-context-limit').value = dreamState.offlineContextLimit || 20;
    document.getElementById('dream-font-slider').value = dreamState.fontSize || 14;
    document.getElementById('dream-font-size-val').innerText = (dreamState.fontSize || 14) + 'px';
    document.getElementById('dream-font-color-input').value = dreamState.fontColor || '#111111';
    document.getElementById('dream-font-url-input').value = dreamState.fontUrl || '';

    // 1. 渲染世界书列表
    const wbList = document.getElementById('dream-wb-list');
    wbList.innerHTML = '';
    let dreamWbCount = 0;
    if (dreamState.selectedWbIds) {
        dreamState.selectedWbIds.forEach(id => {
            wbList.innerHTML += `<input type="checkbox" value="${id}" checked>`;
            dreamWbCount++;
        });
    }
    document.getElementById('dream-wb-count').innerText = `已选 ${dreamWbCount} 项`;

    // 2. 渲染预设列表 (带左滑删除)
    const presetList = document.getElementById('dream-preset-list');
    presetList.innerHTML = '';
    if (dreamState.presets.length > 0) {
        dreamState.presets.forEach(p => {
            const isChecked = dreamState.selectedPresetId === p.id;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'dream-swipe-wrapper';
            
             wrapper.innerHTML = `
                <div class="dream-swipe-action" onclick="deleteDreamPreset(${p.id})">DELETE</div>
                <div class="dream-swipe-content" ontouchstart="dreamTouchStart(event)" ontouchmove="dreamTouchMove(event)" ontouchend="dreamTouchEnd(event)">
                    <div style="flex:1; cursor:pointer; font-family: 'Courier New', monospace; font-weight: bold;" onclick="openDreamPresetEditor(${p.id})">
                        ${p.name} <span style="color:#999; font-size:10px; font-weight: normal;">(Edit)</span>
                    </div>
                    <!-- 👇修改：改成 checkbox，并传入 this -->
                    <input type="checkbox" class="dream-checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="dreamSelectPreset(${p.id}, this)">
                </div>
            `;
            presetList.appendChild(wrapper);
        });
    } else {
        presetList.innerHTML = '<div style="color:#999; font-size:12px;">暂无预设</div>';
    }
}

// --- 新增：左滑交互逻辑 ---
function addDreamSwipeLogic(element) {
    let startX = 0, currentX = 0;
    element.addEventListener('touchstart', e => { 
        startX = e.touches[0].clientX; 
    }, {passive: true});
    
    element.addEventListener('touchmove', e => {
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        // 只允许向左滑动，最大滑动距离 70px
        if (diff < 0 && diff > -80) { 
            element.style.transform = `translateX(${diff}px)`; 
        }
    }, {passive: true});
    
    element.addEventListener('touchend', e => {
        let diff = currentX - startX;
        if (diff < -35) { 
            element.style.transform = `translateX(-70px)`; // 展开删除按钮
        } else { 
            element.style.transform = `translateX(0px)`; // 恢复原状
        }
    });

    // 点击其他地方恢复原状
    document.addEventListener('touchstart', e => {
        if (!element.contains(e.target)) {
            element.style.transform = `translateX(0px)`;
        }
    }, {passive: true});
}

function dreamToggleWb(checkbox) {
    const val = checkbox.value;
    if (checkbox.checked) {
        if (!dreamState.selectedWbIds.includes(val)) dreamState.selectedWbIds.push(val);
    } else {
        dreamState.selectedWbIds = dreamState.selectedWbIds.filter(id => id !== val);
    }
    dreamSaveData();
}

function dreamSelectPreset(id, checkbox) {
    if (checkbox.checked) {
        // 如果勾选了，记录当前选中的预设 ID
        dreamState.selectedPresetId = id;
    } else {
        // 如果取消勾选，清空预设 ID
        dreamState.selectedPresetId = null;
    }
    dreamSaveData();
    // 重新渲染列表，确保其他多余的勾选被清除（实现可取消的单选效果）
    dreamRenderSettings();
}


function addDreamPreset() {
    const name = prompt("请输入预设名称：");
    if (!name) return;
    const content = prompt("请输入预设内容（AI的系统提示词）：");
    if (!content) return;
    
    dreamState.presets.push({ id: Date.now(), name, content });
    dreamSaveData();
    dreamRenderSettings();
}

function editDreamPreset(id) {
    const preset = dreamState.presets.find(p => p.id === id);
    if (!preset) return;
    
    const newContent = prompt(`编辑预设 [${preset.name}] 的内容：`, preset.content);
    if (newContent !== null) {
        if (newContent.trim() === "") {
            if (confirm("内容为空，是否删除该预设？")) {
                dreamState.presets = dreamState.presets.filter(p => p.id !== id);
                if (dreamState.selectedPresetId === id) dreamState.selectedPresetId = null;
            }
        } else {
            preset.content = newContent;
        }
        dreamSaveData();
        dreamRenderSettings();
    }
}

// --- 梦境聊天交互 ---
function enterDreamChat() {
    dreamState.currentChat = []; // 清空上次的聊天
    document.getElementById('dream-chat-page').classList.add('active');
    dreamRenderChat();
    
    // 插入一条系统提示
    dreamState.currentChat.push({ role: 'system', content: '你闭上眼睛，坠入了梦境...' });
    dreamRenderChat();
}

function exitDreamChat() {
    if (dreamState.currentChat.length > 1) {
        if (!confirm("退出将丢失当前梦境对话，确定退出吗？(如需保存请点击右上角'醒来')")) return;
    }
    document.getElementById('dream-chat-page').classList.remove('active');
}

function dreamRenderChat() {
    const container = document.getElementById('dream-chat-history');
    container.innerHTML = '';
    
    dreamState.currentChat.forEach(msg => {
        const div = document.createElement('div');
        if (msg.role === 'user') {
            div.className = 'dream-msg me';
        } else if (msg.role === 'assistant') {
            div.className = 'dream-msg ai';
        } else {
            div.className = 'dream-msg system';
        }
        div.innerText = msg.content;
        container.appendChild(div);
    });
    
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

function sendDreamMessage() {
    const input = document.getElementById('dream-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    dreamState.currentChat.push({ role: 'user', content: text });
    input.value = '';
    dreamRenderChat();
}

// --- 梦境 AI 逻辑 (带对话/旁白分离解析) ---
// --- 梦境 AI 逻辑 (带人设读取、动态HTML状态栏与正则解析) ---
async function triggerDreamAI() {
    if (dreamState.currentChat.length === 0) return;

    const apiConfig = await getActiveApiConfig('chat');
    if (!apiConfig || !apiConfig.key) return alert("请先在主设置中配置 API");

    // 1. 基础设定 (根据模式分流)
    let systemPrompt = "";
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    const charName = char ? char.name : "未知角色";
    const charPersona = char ? char.prompt : "无";
    const userPersona = (char && char.chatConfig && char.chatConfig.userPersona) ? char.chatConfig.userPersona : wcState.user.persona;

    if (dreamState.currentMode === 'offline') {
        systemPrompt += `你现在处于现实世界的线下互动场景中。你和 User 已经跨越了屏幕，正在面对面接触。\n`;

        const isTimePerceptionEnabled = char && char.chatConfig && char.chatConfig.timePerceptionEnabled !== false;

        if (isTimePerceptionEnabled) {
            // 👇 新增：获取当前时间与时段氛围 👇
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const timeString = `${year}年${month}月${date}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            const dayString = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];

            let timeSlotVibe = "";
            if (hours >= 5 && hours < 8) timeSlotVibe = "清晨：可能带着慵懒、柔软或起床气。";
            else if (hours >= 8 && hours < 12) timeSlotVibe = "上午：清醒、有活力，适合外出或工作。";
            else if (hours >= 12 && hours < 18) timeSlotVibe = "下午：平稳，午后可能有些懒洋洋，适合喝下午茶或散步。";
            else if (hours >= 18 && hours < 21) timeSlotVibe = "傍晚：放松，适合共进晚餐、看日落或散步。";
            else if (hours >= 21 && hours < 24) timeSlotVibe = "夜晚：放松，更容易敞开心扉，适合私密独处或看电影。";
            else timeSlotVibe = "深夜/凌晨：夜深人静，适合极度私密的互动、相拥入眠或吃宵夜。";
            
            systemPrompt += `【当前现实时间】：${timeString} ${dayString}\n`;
            systemPrompt += `【当前时段氛围参考】：${timeSlotVibe}\n`;
            systemPrompt += `【时间观念要求】：请严格根据当前的时间点和氛围来描写你们的线下互动。例如：如果是深夜，你们可能在吃宵夜或在家里；如果是清晨，可能刚醒来。绝对不要出现时间逻辑错误！\n\n`;
        } else {
            systemPrompt += `\n【现实感知】：你当前处于一个模糊的时间维度，不需要关注具体的时间流逝。\n\n`;
        }

        systemPrompt += `请注重描写你的肢体动作、神态、语气以及周围的现实环境。不要输出JSON，直接输出纯文本回复。请使用中文双引号（“”）或单引号（「」）来包裹角色说出的话。\n`;
        systemPrompt += `【最高格式警告】：绝对禁止输出任何思维链过程！绝对禁止使用 <thinking> 或类似标签！直接输出你最终的回复内容！\n\n`;
        
        // 提取最近 5 条记忆
        let memoryText = "暂无特殊记忆。";
        if (char && char.memories && char.memories.length > 0) {
            memoryText = char.memories.slice(0, 5).map(m => `- ${m.content.replace(/^\[.*?\]\s*/, '')}`).join('\n');
        }
        systemPrompt += `【你们的共同记忆（潜意识）】：\n${memoryText}\n\n`;

        // 提取最近的聊天记录 (根据聊天设置中的上下文条数)
        let recentMsgsText = "暂无聊天记录。";
        if (char && wcState.chats[char.id]) {
            const msgs = wcState.chats[char.id];
            const contextLimit = (char.chatConfig && char.chatConfig.contextLimit > 0) ? char.chatConfig.contextLimit : 30;
            recentMsgsText = msgs.filter(m => !m.isError && m.type !== 'system')
                                 .slice(-contextLimit)
                                 .map(m => {
                                     let content = m.content;
                                     if (m.type !== 'text') content = `[${m.type}]`;
                                     return `${m.sender === 'me' ? 'User' : char.name}: ${content}`;
                                 })
                                 .join('\n');
        }
        systemPrompt += `【你们刚刚在微信上的聊天记录（作为见面的前情提要）】：\n${recentMsgsText}\n\n`;
        
        systemPrompt += `【⚠️ 核心场景切换指令（最高优先级）⚠️】：\n`;
        systemPrompt += `注意！上面的微信聊天已经结束！现在，你和 User 已经在【现实世界的线下】见面了！\n`;
        systemPrompt += `请根据你们在微信上的最后对话状态和情绪，自然地开启或继续这次线下见面。\n`;
        systemPrompt += `绝对禁止再说“我给你发微信”、“看手机”之类的话，你们现在是面对面！\n\n`;

    } else {
        systemPrompt += "你现在处于一个梦境文字交互游戏中（作为独立的小番外）。请根据用户的输入（User），推动梦境的发展。回复要充满画面感、意识流、或者诡异/唯美的梦境氛围。不要输出JSON，直接输出纯文本回复。请使用中文双引号（“”）或单引号（「」）来包裹角色说出的话。\n";
        systemPrompt += `【最高格式警告】：绝对禁止输出任何思维链过程！绝对禁止使用 <thinking> 或类似标签！直接输出你最终的回复内容！\n\n`;
    }
    
    // 2. 核心：读取当前角色和用户的人设
    systemPrompt += `【当前角色设定 (${charName})】：\n${charPersona}\n\n`;
    systemPrompt += `【用户设定 (User)】：\n${userPersona}\n\n`;

    // 3. 读取关联的世界书
    if (dreamState.selectedWbIds.length > 0 && typeof worldbookEntries !== 'undefined') {
        const linkedWbs = worldbookEntries.filter(e => dreamState.selectedWbIds.includes(e.id.toString()));
        if (linkedWbs.length > 0) {
            systemPrompt += "【梦境背景参考 (世界书)】：\n" + linkedWbs.map(e => `${e.title}: ${e.desc}`).join('\n') + "\n\n";
        }
    }
    
    // 4. 读取梦境预设
    if (dreamState.selectedPresetId) {
        const preset = dreamState.presets.find(p => p.id === dreamState.selectedPresetId);
        if (preset) systemPrompt += "【梦境特殊规则/预设】：\n" + preset.content + "\n\n";
    }

    // 5. 核心：读取 HTML 状态栏模板，并要求 AI 动态填写
    if (dreamState.ext.activeHtmlId) {
        const activeHtml = dreamState.ext.html.find(h => h.id === dreamState.ext.activeHtmlId);
        if (activeHtml && activeHtml.content) {
            systemPrompt += `【强制指令：动态状态栏】：\n`;
            if (activeHtml.prompt) {
                systemPrompt += `${activeHtml.prompt}\n`;
            }
            systemPrompt += `你必须在回复的最末尾，输出以下 HTML 状态栏代码，并根据当前梦境的剧情发展，更新里面的数值或状态文本（不要修改 HTML 标签结构，只修改里面的内容）。\n请务必将状态栏代码包裹在 \`\`\`html 和 \`\`\` 之间！\n\n状态栏模板如下：\n${activeHtml.content}\n\n`;
        }
    }

    // 构造消息体
    const messages = [{ role: "system", content: systemPrompt }];
    
    // 👇 核心修改：根据设置截断当前场景的上下文条数
    const chatLimit = dreamState.offlineContextLimit > 0 ? dreamState.offlineContextLimit : 20;
    const validChats = dreamState.currentChat.filter(m => m.role === 'user' || m.role === 'assistant');
    const recentChats = validChats.slice(-chatLimit);

    recentChats.forEach(m => {
        // 传给 AI 的历史记录剥离掉 HTML 状态栏，防止污染 AI 的认知
        messages.push({ role: m.role, content: m.rawContent || m.content });
    });

    dreamState.currentChat.push({ role: 'system', content: '梦境正在演化...' });
    dreamRenderChatWithHTML();

    try {
        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: messages,
                temperature: parseFloat(apiConfig.temp) || 0.8
            })
        });

        const data = await response.json();
        let rawReply = data.choices[0].message.content;
        rawReply = rawReply.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        
        let finalReply = rawReply;
        let extractedHtml = "";

        // ==========================================
        // 解析 AI 动态生成的 HTML 状态栏
        // ==========================================
        const htmlMatch = finalReply.match(/```html\s*([\s\S]*?)\s*```/i);
        if (htmlMatch) {
            extractedHtml = htmlMatch[1]; // 提取出 AI 填好的 HTML
            finalReply = finalReply.replace(/```html\s*[\s\S]*?\s*```/i, '').trim(); // 从正文中删掉代码块
        } else {
            // 兜底：如果 AI 忘了加 ```html，尝试直接提取末尾的 <div>
            const divMatch = finalReply.match(/(<div[\s\S]*>[\s\S]*<\/div>)$/i);
            if (divMatch) {
                extractedHtml = divMatch[1];
                finalReply = finalReply.replace(/(<div[\s\S]*>[\s\S]*<\/div>)$/i, '').trim();
            }
        }

        // ==========================================
        // 执行正则替换 (Regex)
        // ==========================================
        if (dreamState.ext.activeRegexId) {
            const activeRegex = dreamState.ext.regex.find(r => r.id === dreamState.ext.activeRegexId);
            if (activeRegex && activeRegex.content) {
                const lines = activeRegex.content.split('\n');
                lines.forEach(line => {
                    const parts = line.split('===');
                    if (parts.length === 2) {
                        try {
                            const match = parts[0].trim().match(/^\/(.+)\/([gimuy]*)$/);
                            if (match) {
                                const regex = new RegExp(match[1], match[2]);
                                finalReply = finalReply.replace(regex, parts[1].trim());
                            } else {
                                finalReply = finalReply.split(parts[0].trim()).join(parts[1].trim());
                            }
                        } catch(e) {}
                    }
                });
            }
        }

        dreamState.currentChat.pop(); // 移除 loading
        
        // 保存记录：rawContent 存纯净文本，htmlInject 存 AI 填好的状态栏
        dreamState.currentChat.push({ 
            role: 'assistant', 
            content: finalReply, 
            rawContent: rawReply,
            htmlInject: extractedHtml 
        });
        
        dreamRenderChatWithHTML();
        syncDreamChatHistory(); // 👇 新增：AI回复后同步保存

    } catch (e) {
        dreamState.currentChat.pop(); 
        dreamState.currentChat.push({ role: 'system', content: '梦境连接断开: ' + e.message });
        dreamRenderChatWithHTML();
        if (typeof showApiErrorModal === 'function') showApiErrorModal(`[梦境生成失败] ${e.message}`);
    }
}
// 文本解析器：分离对话和旁白
function parseDreamTextToCards(text) {
    // 匹配中文双引号 “”、英文双引号 ""、直角引号 「」『』
    const regex = /([“"「『][^”"」』]+[”"」』])/g;
    const parts = text.split(regex);
    let html = '';
    
    parts.forEach(part => {
        if (!part) return;
        if (part.match(/^[“"「『]/)) {
            // 这是对话，用气泡包裹
            html += `<div class="dream-dialogue-bubble">${part}</div>`;
        } else {
            // 这是旁白，转换换行符
            const formatted = part.replace(/\n/g, '<br>');
            if (formatted.trim() || formatted.includes('<br>')) {
                html += `<div class="dream-narrative-text">${formatted}</div>`;
            }
        }
    });
    return html;
}

// 渲染聊天记录 (支持长按、解析和AI卡片操作)
function dreamRenderChatWithHTML() {
    const container = document.getElementById('dream-chat-history');
    container.innerHTML = '';
    
    dreamState.currentChat.forEach((msg, index) => {
        const div = document.createElement('div');
        
        if (msg.role === 'user') {
            div.className = 'dream-msg me';
            div.innerText = msg.content;
            // 绑定长按事件 (传入 'user' 类型)
            div.addEventListener('touchstart', (e) => handleDreamTouchStart(e, index), {passive: false});
            div.addEventListener('touchend', handleDreamTouchEnd);
            div.addEventListener('contextmenu', (e) => {
                showDreamContextMenu(e, index, 'user');
            });
            
        } else if (msg.role === 'assistant') {
            div.className = 'dream-msg ai';
            let innerHtml = parseDreamTextToCards(msg.content);
            
            if (msg.htmlInject) {
                innerHtml += `<div style="margin-top: 10px; border-top: 1px dashed #E5E5EA; padding-top: 10px;">${msg.htmlInject}</div>`;
            }
            
            // 新增：右下角操作按键 (传入 'ai' 类型)
            innerHtml += `
                <div class="dream-ai-action-btn" onclick="showDreamContextMenu(event, ${index}, 'ai')">
                    <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </div>
            `;
            div.innerHTML = innerHtml;
            
        } else {
            div.className = 'dream-msg system';
            div.innerText = msg.content;
        }
        container.appendChild(div);
    });
    
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// 自动调整输入框高度
document.addEventListener('DOMContentLoaded', function() {
    const dreamInput = document.getElementById('dream-chat-input');
    if (dreamInput) {
        dreamInput.addEventListener('input', function() {
            this.style.height = '44px';
            // 👉【修改】：使用 setProperty 确保优先级，防止被其他样式覆盖导致闪烁
            this.style.setProperty('height', this.scrollHeight + 'px', 'important');
        });
    }
});
// 覆盖原本的 enterDreamChat 和 sendDreamMessage，让它们调用支持 HTML 的渲染函数
async function enterDreamChat(mode = 'dream') {
    currentDreamCardId = null; // 新增：新建梦境时清空卡片ID，防止覆盖旧卡片
    dreamState.currentMode = mode; // 记录模式
    dreamState.currentChat = []; 
    document.getElementById('dream-chat-page').classList.add('active');
    
    // 更新顶栏头像和名字
    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (char) {
        const avatarEl = document.getElementById('dream-chat-avatar');
        const nameEl = document.getElementById('dream-chat-name');
        if (avatarEl) avatarEl.src = char.avatar;
        if (nameEl) nameEl.innerText = char.name;
    }
    
    // 👇 新增：读取当前生效的 API 模型并显示在底部标签上
    try {
        const activeConfig = await getActiveApiConfig('chat');
        const modelTextEl = document.getElementById('dream-current-model-text');
        if (modelTextEl) {
            modelTextEl.innerText = activeConfig.model || '未选择模型';
        }
    } catch (e) {
        console.warn("读取模型失败", e);
    }
    
    const titleEl = document.getElementById('dream-chat-title');
    if (mode === 'offline') {
        if (titleEl) titleEl.innerText = 'IN REALITY...';
        dreamState.currentChat.push({ role: 'system', content: '跨越屏幕，你们在现实中相遇了...' });
    } else {
        if (titleEl) titleEl.innerText = 'IN THE DREAM...';
        dreamState.currentChat.push({ role: 'system', content: '你闭上眼睛，坠入了梦境...' });
    }
    
    dreamRenderChatWithHTML();
}

function sendDreamMessage() {
    const input = document.getElementById('dream-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    dreamState.currentChat.push({ role: 'user', content: text });
    input.value = '';
    dreamRenderChatWithHTML();
    syncDreamChatHistory(); // 👇 新增：用户发送消息后同步保存
}
// ==========================================
// 梦境总结、模型选择与亮度调节逻辑
// ==========================================
function openDreamSummaryModal() {
    const modal = document.getElementById('dream-summary-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function closeDreamSummaryModal() {
    const modal = document.getElementById('dream-summary-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 200);
    }
}

// 动态打开模型选择弹窗
async function openDreamModelSelectModal() {
    const container = document.getElementById('dream-model-list-container');
    if (!container) return;
    
    const modal = document.getElementById('dream-model-select-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // 填充 API 预设
    const presetSelect = document.getElementById('dream-api-preset-select');
    if (presetSelect) {
        presetSelect.innerHTML = '<option value="">当前默认 API</option>';
        apiPresets.forEach((p, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.innerText = p.name;
            presetSelect.appendChild(opt);
        });
    }

    // 默认加载当前模型的列表
    renderDreamModelList();
}

async function fetchDreamModelsFromPreset() {
    const presetIdx = document.getElementById('dream-api-preset-select').value;
    const container = document.getElementById('dream-model-list-container');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#888; font-size: 14px;">拉取中...</div>';

    let baseUrl, key;
    if (presetIdx !== "") {
        const p = apiPresets[presetIdx];
        baseUrl = p.baseUrl;
        key = p.key;
    } else {
        const activeConfig = await getActiveApiConfig('chat');
        baseUrl = activeConfig.baseUrl;
        key = activeConfig.key;
    }

    if (!baseUrl || !key) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#FF3B30; font-size: 14px;">API 配置不完整</div>';
        return;
    }

    try {
        const res = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        
        if (data.data && Array.isArray(data.data)) {
            dreamState.tempModels = data.data.map(m => m.id);
            renderDreamModelList();
        } else {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#FF3B30; font-size: 14px;">拉取失败：格式不正确</div>';
        }
    } catch (e) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#FF3B30; font-size: 14px;">拉取失败：${e.message}</div>`;
    }
}

async function renderDreamModelList() {
    const container = document.getElementById('dream-model-list-container');
    container.innerHTML = '';

    let models = dreamState.tempModels;
    
    const activeConfig = await getActiveApiConfig('chat');
    const currentModel = activeConfig.model || '';

    if (!models || models.length === 0) {
        // 尝试从主副 API 缓存中读取
        const fullConfig = await idb.get('ios_theme_api_config') || {};
        const secondary = fullConfig.secondary || {};
        const isSecondary = (activeConfig === secondary);
        models = isSecondary ? fetchedModelsSecondary : fetchedModelsPrimary;
        
        if (!models || models.length === 0) {
            const selectId = isSecondary ? 'secModelSelect' : 'modelSelect';
            const selectEl = document.getElementById(selectId);
            if (selectEl && selectEl.options.length > 0) {
                models = Array.from(selectEl.options).map(opt => opt.value);
            }
        }
    }

    if (!models || models.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#888; font-size: 14px;">暂无模型列表，请点击拉取</div>';
        return;
    }

    models.forEach(model => {
        const div = document.createElement('div');
        div.className = 'dream-model-option';
        if (model === currentModel) {
            div.style.color = '#007AFF';
            div.style.fontWeight = 'bold';
            div.innerText = model + ' (当前)';
        } else {
            div.innerText = model;
        }
        div.onclick = () => selectDreamModel(model);
        container.appendChild(div);
    });
}

function closeDreamModelSelectModal() {
    const modal = document.getElementById('dream-model-select-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 200);
    }
}

// 选中模型并保存到数据库
async function selectDreamModel(modelName) {
    const presetIdx = document.getElementById('dream-api-preset-select').value;
    
    // 1. 更新底部标签 UI
    const textEl = document.getElementById('dream-current-model-text');
    if (textEl) textEl.innerText = modelName;
    
    // 2. 更新数据库
    try {
        const fullConfig = await idb.get('ios_theme_api_config') || {};
        const activeConfig = await getActiveApiConfig('chat');
        const isSecondary = (activeConfig === fullConfig.secondary);

        if (presetIdx !== "") {
            // 如果选择了预设，将预设的 baseUrl, key, model 覆盖到当前生效的 API 中
            const p = apiPresets[presetIdx];
            if (isSecondary) {
                if (!fullConfig.secondary) fullConfig.secondary = {};
                fullConfig.secondary.baseUrl = p.baseUrl;
                fullConfig.secondary.key = p.key;
                fullConfig.secondary.model = modelName;
                fullConfig.secondary.temp = p.temp;
            } else {
                if (!fullConfig.primary) fullConfig.primary = {};
                fullConfig.primary.baseUrl = p.baseUrl;
                fullConfig.primary.key = p.key;
                fullConfig.primary.model = modelName;
                fullConfig.primary.temp = p.temp;
            }
        } else {
            // 仅修改模型
            if (isSecondary) {
                if (!fullConfig.secondary) fullConfig.secondary = {};
                fullConfig.secondary.model = modelName;
            } else {
                if (!fullConfig.primary) fullConfig.primary = {};
                fullConfig.primary.model = modelName;
            }
        }
        
        await idb.set('ios_theme_api_config', fullConfig);
        
        // 同步更新设置页面的 select 和 input
        if (isSecondary) {
            const selectEl = document.getElementById('secModelSelect');
            if (selectEl) selectEl.value = modelName;
            if (presetIdx !== "") {
                const urlEl = document.getElementById('secApiBaseUrl');
                const keyEl = document.getElementById('secApiKey');
                if (urlEl) urlEl.value = fullConfig.secondary.baseUrl;
                if (keyEl) keyEl.value = fullConfig.secondary.key;
            }
        } else {
            const selectEl = document.getElementById('modelSelect');
            if (selectEl) selectEl.value = modelName;
            if (presetIdx !== "") {
                const urlEl = document.getElementById('apiBaseUrl');
                const keyEl = document.getElementById('apiKey');
                if (urlEl) urlEl.value = fullConfig.primary.baseUrl;
                if (keyEl) keyEl.value = fullConfig.primary.key;
            }
        }
        
    } catch (e) {
        console.error("保存模型设置失败", e);
    }
    
    closeDreamModelSelectModal();
}

// --- 亮度调节逻辑 ---
function openBrightnessModal() {
    const modal = document.getElementById('brightness-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        // 加载已保存的壁纸
        const savedWp = localStorage.getItem('ios_theme_dream_wallpaper');
        const preview = document.getElementById('dream-wp-preview');
        const urlInput = document.getElementById('dream-wallpaper-url');
        if (savedWp) {
            if (preview) preview.style.backgroundImage = `url('${savedWp}')`;
            if (urlInput && !savedWp.startsWith('data:')) urlInput.value = savedWp;
        }
    }
}

function closeBrightnessModal() {
    const modal = document.getElementById('brightness-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 200);
    }
}

// --- 梦境壁纸自定义逻辑 ---
function handleDreamWallpaperFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        applyDreamWallpaper(base64);
    };
    reader.readAsDataURL(file);
}

function applyDreamWallpaperUrl() {
    const url = document.getElementById('dream-wallpaper-url').value.trim();
    if (!url) return;
    applyDreamWallpaper(url);
}

function applyDreamWallpaper(url) {
    const bg = document.getElementById('dream-chat-bg');
    if (bg) bg.style.backgroundImage = `url('${url}')`;
    const preview = document.getElementById('dream-wp-preview');
    if (preview) preview.style.backgroundImage = `url('${url}')`;
    const urlInput = document.getElementById('dream-wallpaper-url');
    if (urlInput && url.startsWith('data:')) urlInput.value = '';
    localStorage.setItem('ios_theme_dream_wallpaper', url);
}

function clearDreamWallpaper() {
    const bg = document.getElementById('dream-chat-bg');
    if (bg) bg.style.backgroundImage = '';
    const preview = document.getElementById('dream-wp-preview');
    if (preview) preview.style.backgroundImage = '';
    const urlInput = document.getElementById('dream-wallpaper-url');
    if (urlInput) urlInput.value = '';
    localStorage.removeItem('ios_theme_dream_wallpaper');
}

function changeBrightness(val) {
    const displayEl = document.getElementById('brightness-val-display');
    if (displayEl) displayEl.innerText = val + '%';
    
    // 调节背景颜色，从白(100)变暗(0)
    const lightness = Math.floor((val / 100) * 255);
    const bgColor = `rgb(${lightness}, ${lightness}, ${lightness})`;
    // 让边框颜色比背景稍微深一点点，增加层次感
    const borderColor = `rgb(${Math.max(0, lightness - 20)}, ${Math.max(0, lightness - 20)}, ${Math.max(0, lightness - 20)})`;
    
    // 使用 CSS 变量统一控制背景层和底栏的颜色
    document.documentElement.style.setProperty('--dream-bg-color', bgColor);
    document.documentElement.style.setProperty('--dream-border-color', borderColor);
}

function saveBrightness() {
    const val = document.getElementById('brightness-slider').value;
    localStorage.setItem('ios_theme_brightness', val);
    // 同时保存当前壁纸
    const bg = document.getElementById('dream-chat-bg');
    if (bg && bg.style.backgroundImage) {
        const url = bg.style.backgroundImage.slice(5, -2).replace(/"/g, '');
        if (url) localStorage.setItem('ios_theme_dream_wallpaper', url);
    }
    closeBrightnessModal();
}

// 页面加载时初始化亮度与壁纸
document.addEventListener('DOMContentLoaded', () => {
    const savedBrightness = localStorage.getItem('ios_theme_brightness');
    if (savedBrightness) {
        const slider = document.getElementById('brightness-slider');
        if (slider) slider.value = savedBrightness;
        changeBrightness(savedBrightness);
    } else {
        changeBrightness(100);
    }
    // 恢复壁纸
    const savedWp = localStorage.getItem('ios_theme_dream_wallpaper');
    if (savedWp) {
        const bg = document.getElementById('dream-chat-bg');
        if (bg) bg.style.backgroundImage = `url('${savedWp}')`;
    }
});

// --- 梦境预设卡片编辑与保存逻辑 ---
function openDreamPresetEditor(id = null) {
    dreamState.editingPresetId = id;
    const modal = document.getElementById('dream-preset-editor-modal');
    const nameInput = document.getElementById('dream-preset-name');
    const contentInput = document.getElementById('dream-preset-content');
    const idDisplay = document.getElementById('dream-preset-id-display');

    if (id) {
        const preset = dreamState.presets.find(p => p.id === id);
        if (preset) {
            nameInput.value = preset.name;
            contentInput.value = preset.content;
            idDisplay.innerText = id.toString().slice(-4); // 显示ID后四位作为档案号
        }
    } else {
        nameInput.value = '';
        contentInput.value = '';
        idDisplay.innerText = 'NEW';
    }
    
    modal.classList.add('active');
}

function closeDreamPresetEditor() {
    document.getElementById('dream-preset-editor-modal').classList.remove('active');
    dreamState.editingPresetId = null;
}

function saveDreamPreset() {
    const name = document.getElementById('dream-preset-name').value.trim();
    const content = document.getElementById('dream-preset-content').value.trim();
    
    if (!name || !content) {
        alert("SUBJECT 和 内容都不能为空哦。");
        return;
    }

    if (dreamState.editingPresetId) {
        // 编辑模式
        const preset = dreamState.presets.find(p => p.id === dreamState.editingPresetId);
        if (preset) {
            preset.name = name;
            preset.content = content;
        }
    } else {
        // 新增模式
        dreamState.presets.push({ id: Date.now(), name, content });
    }
    
    dreamSaveData();
    dreamRenderSettings();
    closeDreamPresetEditor();
}

function deleteDreamPreset(id) {
    if (confirm("确定要销毁这份档案(预设)吗？")) {
        dreamState.presets = dreamState.presets.filter(p => p.id !== id);
        if (dreamState.selectedPresetId === id) {
            dreamState.selectedPresetId = null; // 如果删除了正在使用的，清空选中状态
        }
        dreamSaveData();
        dreamRenderSettings();
    }
}

// --- 替换旧的 addDreamPreset，让点击“+ 添加”时调用新弹窗 ---
function addDreamPreset() {
    openDreamPresetEditor(null);
}

// --- 预设列表左滑逻辑 ---
let dreamSwipeXDown = null;
let dreamSwipeYDown = null;
let dreamCurrentSwipeElement = null;

function dreamTouchStart(evt) {
    dreamSwipeXDown = evt.touches[0].clientX;
    dreamSwipeYDown = evt.touches[0].clientY;
    dreamCurrentSwipeElement = evt.currentTarget;
}

function dreamTouchMove(evt) {
    if (!dreamSwipeXDown || !dreamSwipeYDown || !dreamCurrentSwipeElement) return;
    let xUp = evt.touches[0].clientX;
    let yUp = evt.touches[0].clientY;
    let xDiff = dreamSwipeXDown - xUp;
    let yDiff = dreamSwipeYDown - yUp;
    
    // 确保是水平滑动
    if (Math.abs(xDiff) > Math.abs(yDiff)) { 
        if (xDiff > 0) {
            // 向左滑，露出删除按钮 (宽度70px)
            dreamCurrentSwipeElement.style.transform = `translateX(-70px)`; 
        } else {
            // 向右滑，恢复原位
            dreamCurrentSwipeElement.style.transform = 'translateX(0px)'; 
        }
    }
}

function dreamTouchEnd(evt) {
    dreamSwipeXDown = null;
    dreamSwipeYDown = null;
}
// ==========================================
// 梦境扩展组件 (CSS / HTML / REGEX) 逻辑
// ==========================================

function openDreamExtModal() {
    document.getElementById('dream-ext-modal').classList.add('active');
    switchDreamExtTab(dreamState.ext.currentTab);
}

function closeDreamExtModal() {
    document.getElementById('dream-ext-modal').classList.remove('active');
}

let currentEditingExtId = null; // 新增：记录当前正在编辑的组件ID

function switchDreamExtTab(tab) {
    dreamState.ext.currentTab = tab;
    currentEditingExtId = null; // 切换 Tab 时清空编辑状态
    
    // UI 切换
    document.querySelectorAll('.dream-ext-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.dream-ext-tab[onclick="switchDreamExtTab('${tab}')"]`).classList.add('active');
    
    // 清空输入框
    document.getElementById('dream-ext-name').value = '';
    document.getElementById('dream-ext-content').value = '';
    
    const promptInput = document.getElementById('dream-ext-prompt');
    if (tab === 'html') {
        promptInput.style.display = 'block';
        promptInput.value = '';
    } else {
        promptInput.style.display = 'none';
    }
    
    // 渲染列表
    renderDreamExtList();
}

// 处理文件导入 (支持 JSON/TXT/DOCX)
async function handleDreamExtImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const ext = file.name.split('.').pop().toLowerCase();
    document.getElementById('dream-ext-name').value = fileName;

    try {
        let content = '';
        if (ext === 'txt' || ext === 'json') {
            content = await file.text();
            if (ext === 'json') {
                try {
                    const jsonObj = JSON.parse(content);
                    
                    // 👇 新增：判断是否是我们导出的备份文件
                    if (jsonObj.signature && jsonObj.signature.startsWith('dream_ext_')) {
                        if (confirm("检测到这是梦境扩展组件的备份文件，是否直接导入并合并到现有列表中？")) {
                            if (jsonObj.signature === 'dream_ext_all') {
                                if (jsonObj.data.css) dreamState.ext.css.push(...jsonObj.data.css);
                                if (jsonObj.data.html) dreamState.ext.html.push(...jsonObj.data.html);
                                if (jsonObj.data.regex) dreamState.ext.regex.push(...jsonObj.data.regex);
                            } else {
                                const tab = jsonObj.signature.replace('dream_ext_', '');
                                if (dreamState.ext[tab] && jsonObj.data) {
                                    dreamState.ext[tab].push(...jsonObj.data);
                                }
                            }
                            dreamSaveData();
                            renderDreamExtList();
                            alert("导入成功！");
                            event.target.value = '';
                            return;
                        }
                    }
                    
                    if (jsonObj.html || jsonObj.content) {
                        content = jsonObj.html || jsonObj.content;
                    }
                    if (jsonObj.prompt && document.getElementById('dream-ext-prompt')) {
                        document.getElementById('dream-ext-prompt').value = jsonObj.prompt;
                    }
                } catch(e) {}
            }
        } else if (ext === 'docx') {
            content = await readDocxFile(file);
        }
        document.getElementById('dream-ext-content').value = content;
    } catch (e) {
        alert("导入失败: " + e.message);
    }
    event.target.value = ''; 
}

// 👇 新增：导出当前 Tab 的扩展组件 (分别导出)
function exportDreamExtCurrent() {
    const tab = dreamState.ext.currentTab;
    const data = dreamState.ext[tab];
    if (!data || data.length === 0) {
        return alert("当前分类下没有可导出的数据哦~");
    }
    
    const exportObj = {
        signature: `dream_ext_${tab}`,
        timestamp: Date.now(),
        data: data
    };
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    let defaultName = `dream_${tab}_backup_${new Date().toISOString().slice(0,10)}`;
    let fileName = prompt(`请输入导出的 ${tab.toUpperCase()} 备份文件名称：`, defaultName);
    if (fileName === null) return;
    fileName = fileName.trim() || defaultName;
    
    a.href = url; 
    a.download = `${fileName}.json`;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
}

// 👇 新增：导出所有扩展组件 (CSS + HTML + Regex 一键导出)
function exportDreamExtAll() {
    const data = {
        css: dreamState.ext.css,
        html: dreamState.ext.html,
        regex: dreamState.ext.regex
    };
    
    if (data.css.length === 0 && data.html.length === 0 && data.regex.length === 0) {
        return alert("没有任何可导出的数据哦~");
    }
    
    const exportObj = {
        signature: 'dream_ext_all',
        timestamp: Date.now(),
        data: data
    };
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    let defaultName = `dream_ext_all_backup_${new Date().toISOString().slice(0,10)}`;
    let fileName = prompt("请输入导出的全部备份文件名称：", defaultName);
    if (fileName === null) return;
    fileName = fileName.trim() || defaultName;
    
    a.href = url; 
    a.download = `${fileName}.json`;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
}

// 新增：点击编辑按钮，将数据回填到输入框
function editDreamExt(id) {
    const tab = dreamState.ext.currentTab;
    const item = dreamState.ext[tab].find(i => i.id === id);
    if (!item) return;

    currentEditingExtId = id;
    document.getElementById('dream-ext-name').value = item.name;
    document.getElementById('dream-ext-content').value = item.content;
    
    if (tab === 'html' && document.getElementById('dream-ext-prompt')) {
        document.getElementById('dream-ext-prompt').value = item.prompt || '';
    }
}

// 保存预设 (支持新增和修改)
function saveDreamExt() {
    const tab = dreamState.ext.currentTab;
    const name = document.getElementById('dream-ext-name').value.trim();
    const content = document.getElementById('dream-ext-content').value.trim();
    const prompt = document.getElementById('dream-ext-prompt') ? document.getElementById('dream-ext-prompt').value.trim() : '';
    
    if (!name || !content) return alert("名称和内容不能为空");
    
    if (currentEditingExtId) {
        // 编辑模式：更新已有数据
        const item = dreamState.ext[tab].find(i => i.id === currentEditingExtId);
        if (item) {
            item.name = name;
            item.content = content;
            item.prompt = prompt;
        }
        currentEditingExtId = null; // 保存后清空编辑状态
    } else {
        // 新增模式：插入到最前面
        const newExt = { id: Date.now(), name, content, prompt };
        dreamState.ext[tab].unshift(newExt); 
        
        // 自动启用刚保存的预设
        if (tab === 'css') dreamState.ext.activeCssId = newExt.id;
        if (tab === 'html') dreamState.ext.activeHtmlId = newExt.id;
        if (tab === 'regex') dreamState.ext.activeRegexId = newExt.id;
    }
    
    dreamSaveData();
    
    if (tab === 'css') applyDreamCss(); // 如果是 CSS，立即生效
    
    document.getElementById('dream-ext-name').value = '';
    document.getElementById('dream-ext-content').value = '';
    if (document.getElementById('dream-ext-prompt')) document.getElementById('dream-ext-prompt').value = '';
    renderDreamExtList();
}

// 渲染列表 (HTML 渲染为 100x50 卡片，并增加编辑按钮)
function renderDreamExtList() {
    const tab = dreamState.ext.currentTab;
    const list = dreamState.ext[tab];
    const container = document.getElementById('dream-ext-list');
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; font-size:12px; margin-top:20px;">暂无保存的预设</div>';
        container.style.display = 'block';
        return;
    }
    
    let activeId = null;
    if (tab === 'css') activeId = dreamState.ext.activeCssId;
    if (tab === 'html') activeId = dreamState.ext.activeHtmlId;
    if (tab === 'regex') activeId = dreamState.ext.activeRegexId;

    if (tab === 'html') {
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '10px';
        
        list.forEach(item => {
            const isActive = item.id === activeId;
            const div = document.createElement('div');
            div.className = `dream-ext-html-card ${isActive ? 'active' : ''}`;
            div.innerHTML = `
                <div class="html-card-name" onclick="previewDreamHtml(${item.id})" title="点击预览状态栏">${item.name}</div>
                <div class="html-card-actions">
                    <span onclick="toggleDreamExtActive(${item.id})" style="color: ${isActive ? '#34C759' : '#888'}; font-weight: ${isActive ? 'bold' : 'normal'};">${isActive ? '已启用' : '启用'}</span>
                    <span onclick="deleteDreamExt(${item.id})" style="color:#FF3B30;">删除</span>
                </div>
                <!-- 新增：右上角编辑按钮 -->
                <div onclick="editDreamExt(${item.id})" style="position: absolute; top: 4px; right: 4px; cursor: pointer; color: #888; padding: 2px;" title="编辑">
                    <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
            `;
            container.appendChild(div);
        });
    } else {
        container.style.display = 'block';
        list.forEach(item => {
            const isActive = item.id === activeId;
            const div = document.createElement('div');
            div.className = `dream-ext-item ${isActive ? 'active' : ''}`;
            
            div.innerHTML = `
                <div class="dream-ext-item-info" onclick="toggleDreamExtActive(${item.id})">
                    <div class="dream-ext-item-name">${item.name} ${isActive ? '<span style="color:#34C759; font-size:10px;">(已启用)</span>' : ''}</div>
                    <div class="dream-ext-item-preview">${item.content.replace(/\n/g, ' ')}</div>
                </div>
                <div class="dream-ext-item-actions">
                    <!-- 新增：编辑按钮 -->
                    <svg onclick="editDreamExt(${item.id})" viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#007AFF; stroke-width:2; cursor:pointer;" title="编辑"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <svg onclick="deleteDreamExt(${item.id})" viewBox="0 0 24 24" style="width:18px; height:18px; fill:none; stroke:#FF3B30; stroke-width:2; cursor:pointer;"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </div>
            `;
            container.appendChild(div);
        });
    }
}

// 预览 HTML 状态栏
function previewDreamHtml(id) {
    const item = dreamState.ext.html.find(h => h.id === id);
    if (item) {
        document.getElementById('dream-html-preview-inner').innerHTML = item.content;
        document.getElementById('dream-html-preview-modal').classList.add('active');
    }
}

function closeDreamHtmlPreview() {
    document.getElementById('dream-html-preview-modal').classList.remove('active');
}

// 启用/取消启用
function toggleDreamExtActive(id) {
    const tab = dreamState.ext.currentTab;
    let currentActive = null;
    
    if (tab === 'css') currentActive = dreamState.ext.activeCssId;
    if (tab === 'html') currentActive = dreamState.ext.activeHtmlId;
    if (tab === 'regex') currentActive = dreamState.ext.activeRegexId;

    // 如果点击的是已经启用的，则取消启用；否则启用新的
    const newActiveId = (currentActive === id) ? null : id;

    if (tab === 'css') {
        dreamState.ext.activeCssId = newActiveId;
        applyDreamCss(); // 立即刷新 CSS
    }
    if (tab === 'html') dreamState.ext.activeHtmlId = newActiveId;
    if (tab === 'regex') dreamState.ext.activeRegexId = newActiveId;

    dreamSaveData();
    renderDreamExtList();
}

// 删除预设
function deleteDreamExt(id) {
    if (!confirm("确定删除此预设吗？")) return;
    const tab = dreamState.ext.currentTab;
    
    dreamState.ext[tab] = dreamState.ext[tab].filter(item => item.id !== id);
    
    // 如果删除的是正在启用的，清空启用状态
    if (tab === 'css' && dreamState.ext.activeCssId === id) {
        dreamState.ext.activeCssId = null;
        applyDreamCss();
    }
    if (tab === 'html' && dreamState.ext.activeHtmlId === id) dreamState.ext.activeHtmlId = null;
    if (tab === 'regex' && dreamState.ext.activeRegexId === id) dreamState.ext.activeRegexId = null;

    dreamSaveData();
    renderDreamExtList();
}

// 全局注入 CSS
function applyDreamCss() {
    let styleTag = document.getElementById('dream-custom-css-inject');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dream-custom-css-inject';
        document.head.appendChild(styleTag);
    }
    
    let newCss = '';
    if (dreamState.ext && dreamState.ext.activeCssId) {
        const activeCss = dreamState.ext.css.find(c => c.id === dreamState.ext.activeCssId);
        newCss = activeCss ? activeCss.content : '';
    }
    
    // 🌟 核心修复：比对新旧内容，防止重复注入导致重绘闪退
    if (styleTag.innerHTML.trim() !== newCss.trim()) {
        styleTag.innerHTML = newCss;
    }
}
// ==========================================
// 梦境长按菜单、编辑与重生成逻辑
// ==========================================
let dreamLongPressTimer = null;
let dreamSelectedMsgIndex = -1;

function handleDreamTouchStart(e, index) {
    dreamLongPressTimer = setTimeout(() => {
        showDreamContextMenu(e, index, 'user');
    }, 500);
}

function handleDreamTouchEnd() {
    if (dreamLongPressTimer) {
        clearTimeout(dreamLongPressTimer);
        dreamLongPressTimer = null;
    }
}

function showDreamContextMenu(e, index, type = 'user') {
    // 阻止默认事件和冒泡，防止触发全局关闭
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    dreamSelectedMsgIndex = index;
    const menu = document.getElementById('dream-context-menu');
    
    // 动态生成菜单内容 (纯 SVG 图标)
    menu.innerHTML = '';
    if (type === 'user') {
        menu.innerHTML = `
            <div class="dream-ctx-item" onclick="editDreamMsg()">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <div class="dream-ctx-item" onclick="deleteDreamMsg()">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
        `;
    } else if (type === 'ai') {
        menu.innerHTML = `
            <div class="dream-ctx-item" onclick="regenerateDreamMsg()">
                <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </div>
            <div class="dream-ctx-item" onclick="editDreamMsg()">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <div class="dream-ctx-item" onclick="deleteDreamMsg()">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
        `;
    }

    // 获取点击位置 (兼容鼠标和触摸)
    let x = e.clientX || (e.touches && e.touches[0].clientX);
    let y = e.clientY || (e.touches && e.touches[0].clientY);

    // 估算菜单宽高 (每个 item 约 60px 宽，高度约 44px)
    const menuWidth = type === 'ai' ? 180 : 120;
    const menuHeight = 44; 
    const screenW = window.innerWidth;
    
    // 计算居中位置：X轴居中于点击点，Y轴在点击点上方
    let leftPos = x - (menuWidth / 2);
    let topPos = y - menuHeight - 20; // 距离手指上方 20px

    // 边界保护：防止超出屏幕左右
    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > screenW - 10) leftPos = screenW - menuWidth - 10;

    // 边界保护：如果上方空间不够，就显示在手指下方，并翻转小三角
    if (topPos < 10) {
        topPos = y + 30;
        menu.style.setProperty('--triangle-top', '-7px');
        menu.style.setProperty('--triangle-bottom', 'auto');
        menu.style.setProperty('--triangle-rotate', '180deg');
    } else {
        // 正常显示在上方
        menu.style.setProperty('--triangle-top', '100%');
        menu.style.setProperty('--triangle-bottom', 'auto');
        menu.style.setProperty('--triangle-rotate', '0deg');
    }

    menu.style.left = leftPos + 'px';
    menu.style.top = topPos + 'px';
    menu.style.display = 'flex';
}
// ==========================================
// 新增：全局监听 - 点击任意位置隐藏梦境菜单
// ==========================================
document.addEventListener('touchstart', (e) => {
    const menu = document.getElementById('dream-context-menu');
    // 如果菜单正在显示
    if (menu && menu.style.display === 'flex') {
        // 并且点击的区域不是菜单本身
        if (!e.target.closest('#dream-context-menu')) {
            menu.style.display = 'none';
            dreamSelectedMsgIndex = -1; // 重置选中状态
        }
    }
}, { passive: true });

document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('dream-context-menu');
    if (menu && menu.style.display === 'flex') {
        if (!e.target.closest('#dream-context-menu')) {
            menu.style.display = 'none';
            dreamSelectedMsgIndex = -1;
        }
    }
});

// 重新生成 AI 回复
function regenerateDreamMsg() {
    if (dreamSelectedMsgIndex > -1) {
        const isLastMsg = dreamSelectedMsgIndex === dreamState.currentChat.length - 1;
        
        if (!isLastMsg) {
            if (!confirm("重生成此条消息，将会删除它之后的所有对话记录，确定要继续吗？")) {
                document.getElementById('dream-context-menu').style.display = 'none';
                return;
            }
        }

        // 截断数组：保留到这条 AI 消息之前的所有内容（即删除这条 AI 消息及之后的所有消息）
        dreamState.currentChat = dreamState.currentChat.slice(0, dreamSelectedMsgIndex);
        dreamRenderChatWithHTML();
        syncDreamChatHistory(); // 👇 新增：截断后同步保存到数据库
        document.getElementById('dream-context-menu').style.display = 'none';
        
        // 重新触发 AI
        triggerDreamAI();
    }
}

function deleteDreamMsg() {
    if (dreamSelectedMsgIndex > -1) {
        if (confirm("确定删除这条记录吗？")) {
            dreamState.currentChat.splice(dreamSelectedMsgIndex, 1);
            dreamRenderChatWithHTML();
            syncDreamChatHistory(); // 👇 新增：同步保存到数据库
        }
    }
    document.getElementById('dream-context-menu').style.display = 'none';
}

function editDreamMsg() {
    if (dreamSelectedMsgIndex > -1) {
        const msg = dreamState.currentChat[dreamSelectedMsgIndex];
        document.getElementById('dream-edit-textarea').value = msg.content;
        document.getElementById('dream-edit-modal').classList.add('active');
    }
    document.getElementById('dream-context-menu').style.display = 'none';
}

function closeDreamEditModal() {
    document.getElementById('dream-edit-modal').classList.remove('active');
    dreamSelectedMsgIndex = -1;
}

// 👇 新增：保存梦境编辑消息的逻辑 👇
function saveDreamEditMsg() {
    if (dreamSelectedMsgIndex > -1) {
        const newText = document.getElementById('dream-edit-textarea').value.trim();
        if (newText) {
            // 更新当前选中的消息内容
            dreamState.currentChat[dreamSelectedMsgIndex].content = newText;
            // 重新渲染聊天界面
            dreamRenderChatWithHTML();
            syncDreamChatHistory(); // 👇 新增：同步保存到数据库
        }
    }
    // 关闭弹窗
    closeDreamEditModal();
}
// 👆 新增结束 👆

// --- 梦境字体设置逻辑 ---
function changeDreamFontSize(val) {
    dreamState.fontSize = val;
    document.getElementById('dream-font-size-val').innerText = val + 'px';
    document.documentElement.style.setProperty('--dream-font-size', val + 'px');
    dreamSaveData();
}

function changeDreamFontColor(val) {
    dreamState.fontColor = val;
    document.documentElement.style.setProperty('--dream-font-color', val);
    dreamSaveData();
}

function applyDreamFontUrl() {
    const url = document.getElementById('dream-font-url-input').value.trim();
    dreamState.fontUrl = url;
    applyDreamFontSettings();
    dreamSaveData();
    alert("梦境字体已应用！");
}

function applyDreamFontSettings() {
    // 应用大小
    if (dreamState.fontSize) {
        document.documentElement.style.setProperty('--dream-font-size', dreamState.fontSize + 'px');
    }
    // 应用颜色
    if (dreamState.fontColor) {
        document.documentElement.style.setProperty('--dream-font-color', dreamState.fontColor);
    } else {
        document.documentElement.style.setProperty('--dream-font-color', '#111111');
    }
    // 应用字体文件
    let styleTag = document.getElementById('dream-custom-font-inject');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dream-custom-font-inject';
        document.head.appendChild(styleTag);
    }
    
    let newCss = '';
    if (dreamState.fontUrl) {
        newCss = `
            @font-face { font-family: 'DreamCustomFont'; src: url('${dreamState.fontUrl}'); }
            :root { --dream-font-family: 'DreamCustomFont', 'Kaiti', 'STKaiti', '楷体', serif; }
        `;
    } else {
        newCss = `:root { --dream-font-family: 'Kaiti', 'STKaiti', '楷体', serif; }`;
    }
    
    // 🌟 核心修复：比对新旧内容，防止重复注入庞大的 Base64 字体导致 iOS 内存溢出闪退
    if (styleTag.innerHTML.trim() !== newCss.trim()) {
        styleTag.innerHTML = newCss;
    }
}

// --- 新增：先不总结，储存记录退出 ---
function saveAndExitDreamChat() {
    if (dreamState.currentChat.length > 1) {
        if (!currentDreamCardId) {
            // 如果是新开的梦境，生成一张新卡片
            const summaryPrefix = dreamState.currentMode === 'offline' ? "[线下见面]" : "[梦境残影]";
            
            // 尝试获取最后一条有意义的消息作为预览
            let previewText = "未总结的记录...";
            const validMsgs = dreamState.currentChat.filter(m => m.role === 'user' || m.role === 'assistant');
            if (validMsgs.length > 0) {
                previewText = validMsgs[validMsgs.length - 1].content.replace(/<[^>]*>?/gm, '').substring(0, 30) + "...";
            }
            
            const newCard = {
                id: Date.now(),
                time: Date.now(),
                content: `${summaryPrefix} ${previewText} (未总结)`,
                chatHistory: JSON.parse(JSON.stringify(dreamState.currentChat)),
                charId: wcState.activeChatId,
                mode: dreamState.currentMode // 👈 核心修复：暂存退出时，记录当前的模式 (mode)
            };
            dreamState.cards.push(newCard);
            currentDreamCardId = newCard.id;
            dreamSaveData();
        } else {
            // 如果是已有的卡片，确保数据同步
            syncDreamChatHistory();
        }
    }
    
    document.getElementById('dream-chat-page').classList.remove('active');
    dreamRenderCards(); // 刷新主页卡片列表
}

// --- 将梦境作为潜意识注入给角色 ---
function injectDreamToChar(cardId) {
    const charId = wcState.activeChatId;
    
    if (!charId) {
        alert("请先在微信主界面进入一个角色的聊天框，然后再打开梦境进行注入哦！");
        return;
    }

    const char = wcState.characters.find(c => c.id === charId);
    if (!char) return;

    const card = dreamState.cards.find(c => c.id === cardId);
    if (!card) return;

    if (!char.memories) char.memories = [];
    
    // 查重：防止重复注入同一个梦境
    const isAlreadyInjected = char.memories.some(m => m.content.includes(card.content.substring(0, 20)));
    if (isAlreadyInjected) {
        if (!confirm("这个梦境似乎已经注入过了，确定要重复注入吗？")) return;
    }

    // 包装成潜意识记忆
    const memoryText = `[梦境残影/潜意识] 我最近做了一个无比真实的梦，梦里的情景挥之不去，它可能会影响我现在的潜意识和情绪：${card.content}`;

    char.memories.unshift({
        id: Date.now(),
        type: 'manual', // 存入角色的记忆库
        content: memoryText,
        time: Date.now()
    });

    wcSaveData();
    alert(`成功！\n已将该梦境化作潜意识，植入到 ${char.name} 的记忆中。`);
}
