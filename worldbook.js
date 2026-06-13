// --- 世界书逻辑 (信封版) ---
let currentWbPapers = [];
let currentWbGroupName = '';

function openWorldbook() {
    document.getElementById('worldbookModal').classList.add('open');
    renderWbEnvelopeList();
}

function closeWorldbook() {
    document.getElementById('worldbookModal').classList.remove('open');
}

// 渲染信封列表
function renderWbEnvelopeList() {
    const container = document.getElementById('wb-envelope-list');
    container.innerHTML = '';

    // 👇 永远在最前面渲染一个“创建分组”的实体文件夹
    const createDiv = document.createElement('div');
    createDiv.className = 'wb-folder-item';
    createDiv.onclick = () => addNewGroup();
    createDiv.innerHTML = `
        <div class="wb-folder-back">
            <div class="wb-folder-tab"></div>
            <div class="wb-folder-back-main"></div>
        </div>
        <div class="wb-folder-paper-preview" style="align-items: center;">
            <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; stroke: #CCC; stroke-width: 2; fill: none; margin-bottom: 20px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="wb-folder-front">
            <div class="wb-folder-header">
                <div class="wb-folder-title-box">
                    <div class="wb-folder-title">New Group</div>
                    <div class="wb-folder-subtitle">Create a new folder</div>
                </div>
            </div>
            <div class="wb-folder-footer">
                <div class="wb-folder-count">创建世界书分组</div>
            </div>
        </div>
    `;
    container.appendChild(createDiv);

    worldbookGroups.forEach((group, index) => {
        const entries = worldbookEntries.filter(e => e.type === group);
        
        // 提取前几个条目的标题作为描述
        let descText = entries.slice(0, 2).map(e => e.title).join(' / ');
        if (entries.length > 2) descText += '...';
        if (entries.length === 0) descText = '空空如也';

        const div = document.createElement('div');
        div.className = `wb-folder-item`;
        div.onclick = () => openWbEnvelopeModal(group);
        
        div.innerHTML = `
            <div class="wb-folder-back">
                <div class="wb-folder-tab"></div>
                <div class="wb-folder-back-main"></div>
            </div>
            <div class="wb-folder-paper-preview">
                <div style="width: 60px; height: 6px; background: #EAEAEA; border-radius: 3px; margin-top: 12px; margin-left: 12px;"></div>
            </div>
            <div class="wb-folder-front">
                <div class="wb-folder-header">
                    <div class="wb-folder-title-box">
                        <div class="wb-folder-title">${group}</div>
                        <div class="wb-folder-subtitle">${descText}</div>
                    </div>
                    <div class="wb-folder-actions">
                        <svg viewBox="0 0 24 24" onclick="event.stopPropagation(); showWbGroupEditMenu(event, '${group}')"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </div>
                </div>
                <div class="wb-folder-footer">
                    <div class="wb-folder-count">${entries.length} entries</div>
                    <div style="cursor: pointer; display: flex; align-items: center; gap: 4px; color: #007AFF;" onclick="event.stopPropagation(); openWbFullscreenView('${group}')">
                        Check <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; stroke-width: 2; fill: none;"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 打开屏幕中间的动态信封弹窗
function openWbEnvelopeModal(groupName) {
    currentWbGroupName = groupName;
    currentWbPapers = worldbookEntries.filter(e => e.type === groupName);

    const envelope = document.getElementById('wb-modal-envelope');
    document.getElementById('wb-modal-title').innerText = groupName;
    
    let descText = currentWbPapers.slice(0, 2).map(e => e.title).join(' / ');
    if (currentWbPapers.length > 2) descText += '...';
    if (currentWbPapers.length === 0) descText = '空空如也';
    
    document.getElementById('wb-modal-desc').innerText = descText;
    document.getElementById('wb-modal-count').innerText = `${currentWbPapers.length} entries`;

    renderWbPapers();

    const modal = document.getElementById('wb-envelope-modal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.classList.add('active');
        setTimeout(() => {
            envelope.classList.add('open');
        }, 100); // 稍微延迟一下，让抽出动画更明显
    }, 10);
}


// 👇 新增：显示分组编辑菜单 (重命名 / 删除)
function showWbGroupEditMenu(e, groupName) {
    let menu = document.getElementById('wb-group-edit-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'wb-group-edit-menu';
        menu.style.cssText = 'position: absolute; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(15px); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 3000; display: none; flex-direction: column; min-width: 140px; overflow: hidden;';
        document.body.appendChild(menu);
    }

    const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const deleteSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:10px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    menu.innerHTML = `
        <div style="padding: 12px 16px; font-size: 15px; color: #000; border-bottom: 0.5px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center;" onclick="renameWbGroup('${groupName}')">
            ${editSvg} 修改名称
        </div>
        <div style="padding: 12px 16px; font-size: 15px; color: #FF3B30; cursor: pointer; display: flex; align-items: center;" onclick="deleteWbGroup('${groupName}')">
            ${deleteSvg} 删除分组
        </div>
    `;

    let x = e.clientX;
    let y = e.clientY;
    const menuWidth = 140;
    const menuHeight = 90;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (x + menuWidth > screenW) x = screenW - menuWidth - 10;
    if (y + menuHeight > screenH) y = screenH - menuHeight - 10;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
    
    // 点击其他地方隐藏菜单
    setTimeout(() => {
        const hideMenu = (evt) => {
            if (!evt.target.closest('#wb-group-edit-menu')) {
                menu.style.display = 'none';
                document.removeEventListener('click', hideMenu);
            }
        };
        document.addEventListener('click', hideMenu);
    }, 10);
}

// 👇 新增：重命名分组逻辑
function renameWbGroup(oldName) {
    document.getElementById('wb-group-edit-menu').style.display = 'none';
    if (oldName === 'Default') return alert("默认分组不可重命名");
    
    openTextEditModal("重命名分组", "请输入新的分组名称", oldName, (newName) => {
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedName = newName.trim();
            if (worldbookGroups.includes(trimmedName)) {
                return alert("该分组名称已存在！");
            }
            
            // 更新分组列表
            const idx = worldbookGroups.indexOf(oldName);
            if (idx !== -1) worldbookGroups[idx] = trimmedName;
            
            // 更新条目所属分组
            worldbookEntries.forEach(e => {
                if (e.type === oldName) e.type = trimmedName;
            });
            
            saveWorldbookData();
            renderWbEnvelopeList();
        }
    });
}

// 👇 新增：删除分组逻辑
function deleteWbGroup(groupName) {
    document.getElementById('wb-group-edit-menu').style.display = 'none';
    if (groupName === 'Default') return alert("默认分组不可删除");
    
    if (confirm(`确定要删除分组 "${groupName}" 吗？\n该分组下的所有条目也将被一并删除！`)) {
        worldbookGroups = worldbookGroups.filter(g => g !== groupName);
        worldbookEntries = worldbookEntries.filter(e => e.type !== groupName);
        saveWorldbookData();
        renderWbEnvelopeList();
    }
}

// 渲染交叠的信纸
function renderWbPapers() {
    const container = document.getElementById('wb-papers-container');
    container.innerHTML = '';

    if (currentWbPapers.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#999; padding-top:50px; font-size:12px;">空空如也</div>';
        return;
    }

    currentWbPapers.forEach((entry, index) => {
        const paper = document.createElement('div');
        paper.className = 'wb-paper-item';
        paper.setAttribute('data-index', index);
        
        // 点击后面的信纸，将其切换到最前面
        paper.onclick = (e) => {
            e.stopPropagation();
            if (index !== 0) {
                const clickedPaper = currentWbPapers.splice(index, 1)[0];
                currentWbPapers.unshift(clickedPaper);
                renderWbPapers();
            } else {
                // 点击最前面的信纸，打开编辑器
                openWorldbookEditor(entry.id);
            }
        };

        paper.innerHTML = `
            <div class="wb-clip-tag">
                ${currentWbGroupName}
            </div>
            <div class="wb-paper-title">${entry.title}</div>
            <div class="wb-paper-desc">${entry.desc}</div>
        `;
        container.appendChild(paper);
    });
}

// 左右滑动切换信纸逻辑
let wbTouchStartX = 0;
let wbTouchEndX = 0;

document.addEventListener('DOMContentLoaded', () => {
    const papersContainer = document.getElementById('wb-papers-container');
    if (!papersContainer) return;

    papersContainer.addEventListener('touchstart', e => {
        wbTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    papersContainer.addEventListener('touchend', e => {
        wbTouchEndX = e.changedTouches[0].screenX;
        handleWbSwipe();
    });

    function handleWbSwipe() {
        const swipeThreshold = 40;
        if (currentWbPapers.length <= 1) return;

        if (wbTouchEndX < wbTouchStartX - swipeThreshold) {
            // 向左滑：把第一张放到最后
            const first = currentWbPapers.shift();
            currentWbPapers.push(first);
            renderWbPapers();
        }
        if (wbTouchEndX > wbTouchStartX + swipeThreshold) {
            // 向右滑：把最后一张放到最前
            const last = currentWbPapers.pop();
            currentWbPapers.unshift(last);
            renderWbPapers();
        }
    }
});

// 关闭弹窗
function closeWbEnvelopeModal(e, force = false) {
    if (!force && e.target.id !== 'wb-envelope-modal') return;
    
    const envelope = document.getElementById('wb-modal-envelope');
    const modal = document.getElementById('wb-envelope-modal');
    
    envelope.classList.remove('open');
    
    setTimeout(() => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }, 500);
}

// 👇 新增：生成条目卡片的通用函数
function createWbEntryCard(entry) {
    const card = document.createElement('div');
    card.className = 'wb-fs-card';
    card.onclick = () => openWorldbookEditor(entry.id);
    card.innerHTML = `
        <div class="wb-fs-card-header">
            <div class="wb-fs-card-title">${entry.title} <span style="font-size:10px; color:#999; font-weight:normal; margin-left:6px; background:#F5F5F5; padding:2px 6px; border-radius:4px;">${entry.type}</span></div>
            <div class="wb-fs-card-edit" onclick="event.stopPropagation(); showWbEntryEditMenu(event, ${entry.id})">Edit</div>
        </div>
        <div class="wb-fs-card-desc">${entry.desc}</div>
    `;
    return card;
}

// 👇 新增：搜索世界书条目逻辑
window.filterWbEntries = function(keyword) {
    const envList = document.getElementById('wb-envelope-list');
    const searchRes = document.getElementById('wb-search-results');
    
    if (!keyword.trim()) {
        envList.style.display = 'grid'; /* 👈 核心修复：恢复为 grid 网格布局，防止挤成一排 */
        searchRes.style.display = 'none';
        return;
    }
    
    envList.style.display = 'none';
    searchRes.style.display = 'flex';

    
    const lowerKw = keyword.toLowerCase();
    const filtered = worldbookEntries.filter(e => 
        e.title.toLowerCase().includes(lowerKw) || 
        e.keys.toLowerCase().includes(lowerKw) || 
        e.desc.toLowerCase().includes(lowerKw)
    );
    
    searchRes.innerHTML = '';
    if (filtered.length === 0) {
        searchRes.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0; font-size:13px;">未找到相关条目</div>';
    } else {
        filtered.forEach(entry => {
            searchRes.appendChild(createWbEntryCard(entry));
        });
    }
};

// 👇 新增：条目右上角 Edit 菜单
window.showWbEntryEditMenu = function(e, entryId) {
    let menu = document.getElementById('wb-entry-edit-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'wb-entry-edit-menu';
        menu.style.cssText = 'position: absolute; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(15px); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 4000; display: none; flex-direction: column; min-width: 120px; overflow: hidden;';
        document.body.appendChild(menu);
    }

    const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:8px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const deleteSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:8px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    menu.innerHTML = `
        <div style="padding: 12px 16px; font-size: 14px; color: #000; border-bottom: 0.5px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center;" onclick="document.getElementById('wb-entry-edit-menu').style.display='none'; openWorldbookEditor(${entryId})">
            ${editSvg} 编辑条目
        </div>
        <div style="padding: 12px 16px; font-size: 14px; color: #FF3B30; cursor: pointer; display: flex; align-items: center;" onclick="document.getElementById('wb-entry-edit-menu').style.display='none'; deleteWorldbookEntry(${entryId})">
            ${deleteSvg} 删除条目
        </div>
    `;

    let x = e.clientX;
    let y = e.clientY;
    const menuWidth = 120;
    const menuHeight = 90;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (x + menuWidth > screenW) x = screenW - menuWidth - 10;
    if (y + menuHeight > screenH) y = screenH - menuHeight - 10;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
    
    setTimeout(() => {
        const hideMenu = (evt) => {
            if (!evt.target.closest('#wb-entry-edit-menu')) {
                menu.style.display = 'none';
                document.removeEventListener('click', hideMenu);
            }
        };
        document.addEventListener('click', hideMenu);
    }, 10);
};

// 全屏查看页面逻辑
function openWbFullscreenView(groupName = null) {
    const targetGroup = groupName || currentWbGroupName;
    if (!targetGroup) return;

    document.getElementById('wb-fs-title').innerText = targetGroup;
    const content = document.getElementById('wb-fs-content');
    content.innerHTML = '';

    const entries = worldbookEntries.filter(e => e.type === targetGroup);

    if (entries.length === 0) {
        content.innerHTML = '<div style="text-align:center; color:#999; padding:40px 0;">暂无条目</div>';
    } else {
        entries.forEach(entry => {
            content.appendChild(createWbEntryCard(entry));
        });
    }

    const fsView = document.getElementById('wb-fullscreen-view');
    fsView.style.display = 'flex';
    setTimeout(() => fsView.classList.add('active'), 10);
}

// 修复：删除条目时同步刷新搜索结果
function deleteWorldbookEntry(id) {
    if (confirm("确定要删除这个条目吗？")) {
        worldbookEntries = worldbookEntries.filter(e => e.id !== id);
        saveWorldbookData();
        
        renderWbEnvelopeList(); // 刷新信封列表
        
        // 如果搜索框有内容，刷新搜索结果
        const searchInput = document.getElementById('wb-search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            filterWbEntries(searchInput.value);
        }
        
        // 如果动态信封弹窗开着，同步刷新它
        const envModal = document.getElementById('wb-envelope-modal');
        if (envModal && envModal.classList.contains('active')) {
            currentWbPapers = worldbookEntries.filter(e => e.type === currentWbGroupName);
            renderWbPapers();
        }

        // 如果全屏查看页面开着，同步刷新它
        const fsView = document.getElementById('wb-fullscreen-view');
        if (fsView && fsView.classList.contains('active')) {
            openWbFullscreenView(currentWbGroupName);
        }
    }
}

function closeWbFullscreenView() {
    const fsView = document.getElementById('wb-fullscreen-view');
    fsView.classList.remove('active');
    setTimeout(() => fsView.style.display = 'none', 300);
}


// (保险起见，如果你连删除分组的函数也误删了，把下面这个也带上)
function deleteGroup(groupName) {
    if (confirm(`确定要删除分组 "${groupName}" 吗？\n该分组下的所有条目也将被删除！`)) {
        worldbookGroups = worldbookGroups.filter(g => g !== groupName);
        worldbookEntries = worldbookEntries.filter(e => e.type !== groupName);
        saveWorldbookData();
        renderGroupView();
    } else {
        const items = document.querySelectorAll('.wb-swipe-box');
        items.forEach(el => el.style.transform = 'translateX(0)');
    }
}

function editWorldbookGroup(oldName) {
    if (oldName === 'Default') return alert("默认分组不可重命名");
    // ...
}

function createEntryElement(entry) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wb-list-item-wrapper';
    const swipeBox = document.createElement('div');
    swipeBox.className = 'wb-swipe-box';
    const content = document.createElement('div');
    content.className = 'wb-list-item';
    content.onclick = () => openWorldbookEditor(entry.id);
    content.innerHTML = `<div class="wb-item-info"><div class="wb-item-title">${entry.title} <span class="wb-item-type">${entry.type}</span></div><div class="wb-item-desc">${entry.desc}</div></div>`;
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'wb-delete-btn';
    deleteBtn.innerText = '删除';
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteWorldbookEntry(entry.id); };

    swipeBox.appendChild(content);
    swipeBox.appendChild(deleteBtn);
    wrapper.appendChild(swipeBox);
    
    addSwipeLogic(swipeBox);
    
    return wrapper;
}

function addSwipeLogic(element) {
    let startX, currentX;
    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, {passive: true});

    element.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        if (diff < 0 && diff > -100) {
            element.style.transform = `translateX(${diff}px)`;
        }
    }, {passive: true});

    element.addEventListener('touchend', (e) => {
        const diff = currentX - startX;
        if (diff < -40) {
            element.style.transform = 'translateX(-80px)'; 
        } else {
            element.style.transform = 'translateX(0)';
        }
        startX = null;
        currentX = null;
    });
    
    document.addEventListener('touchstart', (e) => {
        if (!element.contains(e.target)) {
            element.style.transform = 'translateX(0)';
        }
    }, {passive: true});
}

function openWorldbookEditor(id = null) {
    currentEditingId = id;
    const modal = document.getElementById('worldbookEditorModal');
    const titleInput = document.getElementById('wbTitleInput');
    const typeInput = document.getElementById('wbTypeInput'); // 隐藏的真实值
    const typeDisplay = document.getElementById('wbTypeDisplay'); // 显示的按钮
    const keyInput = document.getElementById('wbKeyInput');
    const descInput = document.getElementById('wbDescInput');

    if (worldbookGroups.length === 0) worldbookGroups = ['Default'];

    if (id) {
        const entry = worldbookEntries.find(e => e.id === id);
        if (entry) {
            titleInput.value = entry.title;
            typeInput.value = entry.type;
            typeDisplay.innerText = entry.type;
            keyInput.value = entry.keys;
            descInput.value = entry.desc;
        }
    } else {
        titleInput.value = '';
        typeInput.value = worldbookGroups[0];
        typeDisplay.innerText = worldbookGroups[0];
        keyInput.value = '';
        descInput.value = '';
    }
    modal.classList.add('open');
}

// 👇 新增：打开自定义分组选择弹窗
window.openWbTypeSelectModal = function() {
    const list = document.getElementById('wb-type-select-list');
    const currentType = document.getElementById('wbTypeInput').value;
    list.innerHTML = '';

    // 渲染已有分组
    worldbookGroups.forEach(g => {
        const isActive = g === currentType;
        const div = document.createElement('div');
        div.className = `wb-type-item ${isActive ? 'active' : ''}`;
        div.innerHTML = `<span>${g}</span> ${isActive ? '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}`;
        div.onclick = () => {
            document.getElementById('wbTypeInput').value = g;
            document.getElementById('wbTypeDisplay').innerText = g;
            wcCloseModal('wc-modal-wb-type-select');
        };
        list.appendChild(div);
    });

    // 渲染新建分组按钮
    const newDiv = document.createElement('div');
    newDiv.className = 'wb-type-item new-group';
    newDiv.innerHTML = '+ 新建分组...';
    newDiv.onclick = () => {
        wcCloseModal('wc-modal-wb-type-select');
        setTimeout(() => {
            openTextEditModal("新建分组", "请输入新分组名称", "", (newGroup) => {
                if (newGroup && newGroup.trim() !== "") {
                    const trimmedName = newGroup.trim();
                    if (!worldbookGroups.includes(trimmedName)) {
                        worldbookGroups.push(trimmedName);
                        saveWorldbookData(); // 保存一下分组列表
                    }
                    document.getElementById('wbTypeInput').value = trimmedName;
                    document.getElementById('wbTypeDisplay').innerText = trimmedName;
                }
            });
        }, 300); // 等待底部弹窗收起后再弹出输入框
    };
    list.appendChild(newDiv);

    wcOpenModal('wc-modal-wb-type-select');
};


function closeWorldbookEditor() { document.getElementById('worldbookEditorModal').classList.remove('open'); }

function saveWorldbookEntry() {
    const title = document.getElementById('wbTitleInput').value;
    let type = document.getElementById('wbTypeInput').value;
    const keys = document.getElementById('wbKeyInput').value;
    const desc = document.getElementById('wbDescInput').value;

    if (!title) { alert("请输入条目名称"); return; }
    if (worldbookGroups.length === 0) { type = "Default"; worldbookGroups.push("Default"); }

    if (currentEditingId) {
        const index = worldbookEntries.findIndex(e => e.id === currentEditingId);
        if (index !== -1) {
            worldbookEntries[index] = { id: currentEditingId, title, type, keys, desc };
        }
    } else {
        const newId = Date.now();
        worldbookEntries.push({ id: newId, title, type, keys, desc });
    }
    saveWorldbookData();
    
    // 修复：加入 150ms 延迟，防止点击穿透导致误触列表项
    setTimeout(() => {
        closeWorldbookEditor();
        renderWbEnvelopeList(); // 刷新信封列表
        
        // 如果动态信封弹窗开着，同步刷新它
        const envModal = document.getElementById('wb-envelope-modal');
        if (envModal && envModal.classList.contains('active')) {
            currentWbPapers = worldbookEntries.filter(e => e.type === currentWbGroupName);
            renderWbPapers();
        }

        // 如果全屏查看页面开着，同步刷新它
        const fsView = document.getElementById('wb-fullscreen-view');
        if (fsView && fsView.classList.contains('active')) {
            openWbFullscreenView(currentWbGroupName);
        }
    }, 150);
}

function deleteWorldbookEntry(id) {
    if (confirm("确定要删除这个条目吗？")) {
        worldbookEntries = worldbookEntries.filter(e => e.id !== id);
        saveWorldbookData();
        
        renderWbEnvelopeList(); // 刷新信封列表
        
        // 如果动态信封弹窗开着，同步刷新它
        const envModal = document.getElementById('wb-envelope-modal');
        if (envModal && envModal.classList.contains('active')) {
            currentWbPapers = worldbookEntries.filter(e => e.type === currentWbGroupName);
            renderWbPapers();
        }

        // 如果全屏查看页面开着，同步刷新它
        const fsView = document.getElementById('wb-fullscreen-view');
        if (fsView && fsView.classList.contains('active')) {
            openWbFullscreenView(currentWbGroupName);
        }
    }
}
function addNewGroup() {
    openTextEditModal("创建分组", "请输入新分组名称", "", (name) => {
        if (name && name.trim() !== "") {
            const trimmedName = name.trim();
            if (!worldbookGroups.includes(trimmedName)) {
                worldbookGroups.push(trimmedName);
                saveWorldbookData();
                renderWbEnvelopeList(); // 👈 修复：调用新版的信封渲染函数
            } else {
                alert("该分组名称已存在！");
            }
        }
    });
}

function filterWorldbook(keyword) {
    if (!keyword) {
        renderWorldbookList();
        return;
    }
    const lower = keyword.toLowerCase();
    const filtered = worldbookEntries.filter(e => 
        e.title.toLowerCase().includes(lower) || 
        e.keys.toLowerCase().includes(lower) ||
        e.desc.toLowerCase().includes(lower)
    );
    const container = document.getElementById('worldbookList');
    container.innerHTML = '';
    filtered.forEach(entry => container.appendChild(createEntryElement(entry)));
}

