// ============ 阅读App 完整逻辑 (Steps 1-15) ============
// ============================================================

(function() {
    'use strict';

    // ===== 全局状态 =====
    var raCurrentBook = -1;
    var raReadingTimer = null;
    var raReadingStartTime = 0;
    var raParaArray = [];   // 段落节点缓存
    var raParaMap = {};     // paraIndex → 段落节点映射
    var raMenuVisible = false;
    var raChapters = [];
    var raCurrentChapter = 0;
    var raPendingParagraph = null;
    var raSelectedText = '';
    var raBookColors = ['#8b9dc3', '#a8b5a2', '#c4a882', '#c49b9b', '#9bb5c4', '#b5a2c4'];
    var raCurrentChar = null; // 当前选中的角色 { id, name, avatar, prompt }
    var raLatestAnnotationParaIdx = -1; // 最近一条批注的段落 index

    // 恢复上次选中的角色
    (function() {
        try { raCurrentChar = JSON.parse(localStorage.getItem('ra_currentChar')); } catch(e) {}
    })();

    // ===== 工具函数 =====
    function getBooks() {
        try { return JSON.parse(localStorage.getItem('ra_books') || '[]'); }
        catch(e) { return []; }
    }
    function saveBooks(books) { localStorage.setItem('ra_books', JSON.stringify(books)); }

    function getReadingState() {
        try { return JSON.parse(localStorage.getItem('ra_readingState') || '{}'); }
        catch(e) { return {}; }
    }
    function saveReadingState(state) { localStorage.setItem('ra_readingState', JSON.stringify(state)); }

    function getNotes() {
        try { return JSON.parse(localStorage.getItem('ra_notes') || '[]'); }
        catch(e) { return []; }
    }
    function saveNotes(notes) { localStorage.setItem('ra_notes', JSON.stringify(notes)); }

    function getAnnotations() {
        try { return JSON.parse(localStorage.getItem('ra_annotations') || '[]'); }
        catch(e) { return []; }
    }
    function saveAnnotations(arr) { localStorage.setItem('ra_annotations', JSON.stringify(arr)); }

    function getSettings() {
        try { return JSON.parse(localStorage.getItem('ra_settings') || '{}'); }
        catch(e) { return {}; }
    }
    function saveSettings(s) { localStorage.setItem('ra_settings', JSON.stringify(s)); }

    // ===== 打开/关闭书架 =====
    window.openReadingApp = function() {
        var modal = document.getElementById('readingModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('open');
            setTimeout(function() { modal.style.opacity = '1'; }, 10);
        }
        openBookshelf();
    };

    function openBookshelf() {
        document.getElementById('bookshelf-page').style.display = 'flex';
        document.getElementById('reading-page').style.display = 'none';
        restoreBookshelf();
    }

    window.closeBookshelf = function() {
        var modal = document.getElementById('readingModal');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.2s ease';
            setTimeout(function() {
                modal.style.display = 'none';
                modal.classList.remove('open');
            }, 200);
        }
    };

    // ===== 书架渲染 + 导入 =====
    var raCurrentGroup = 'all';

    window.switchBookGroup = function(group) {
        raCurrentGroup = group;
        var tabs = document.querySelectorAll('.ra-group-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-group') === group);
        }
        restoreBookshelf();
    };

    window.moveBookToGroup = function() {
        closeBookCardMenu();
        var idx = raBookMenuIndex;
        var books = getBooks();
        if (!books[idx]) return;
        var groups = ['want', 'reading', 'done'];
        var labels = ['想读', '在读', '读完'];
        var current = books[idx].group || '';
        var choice = prompt('选择分组 (输入数字):\n1. 想读\n2. 在读\n3. 读完');
        if (!choice) return;
        var gi = parseInt(choice) - 1;
        if (gi >= 0 && gi < groups.length) {
            books[idx].group = groups[gi];
            saveBooks(books);
            restoreBookshelf();
        }
    };

    function restoreBookshelf() {
        var grid = document.getElementById('bookshelf-grid');
        if (!grid) return;
        grid.innerHTML = '';
        var books = getBooks();
        var s = getSettings();
        var sortMode = s.sortMode || 'recent';

        // 创建索引数组排序
        var indices = [];
        for (var i = 0; i < books.length; i++) {
            if (raCurrentGroup !== 'all' && (books[i].group || '') !== raCurrentGroup) continue;
            indices.push(i);
        }
        var state = getReadingState();
        if (sortMode === 'recent') {
            indices.sort(function(a, b) {
                var ta = (state['book_' + a] && state['book_' + a].lastTime) || 0;
                var tb = (state['book_' + b] && state['book_' + b].lastTime) || 0;
                return tb - ta;
            });
        } else if (sortMode === 'name') {
            indices.sort(function(a, b) { return (books[a].name || '').localeCompare(books[b].name || ''); });
        } else if (sortMode === 'progress') {
            indices.sort(function(a, b) { return (books[b].progress || 0) - (books[a].progress || 0); });
        }
        for (var j = 0; j < indices.length; j++) {
            grid.appendChild(createBookCard(indices[j], books[indices[j]]));
        }
        grid.appendChild(createAddCard());
    }

    window.toggleSortMenu = function() {
        var menu = document.getElementById('ra-sort-menu');
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    window.applySortMode = function(mode) {
        var s = getSettings(); s.sortMode = mode; saveSettings(s);
        var menu = document.getElementById('ra-sort-menu');
        if (menu) menu.style.display = 'none';
        restoreBookshelf();
    };

    // 书名 hash 取色（同一书名始终一致）
    function hashColor(name) {
        var h = 0;
        for (var i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h); }
        var hue = Math.abs(h) % 360;
        return 'hsl(' + hue + ', 35%, 60%)';
    }

    function createBookCard(index, book) {
        var card = document.createElement('div');
        card.className = 'ra-book-card';
        var progress = book.progress || 0;
        var coverHtml;
        if (book.coverImage) {
            // 自定义封面（base64 或 URL）
            coverHtml = '<div class="ra-book-cover" style="background:#000;"><div><img src="' + book.coverImage + '" style="width:100%;height:100%;object-fit:cover;"></div></div>';
        } else {
            // 默认封面：书名 hash 取色 + 书名
            var color = hashColor(book.name || '');
            coverHtml = '<div class="ra-book-cover" style="background:' + color + ';"><div class="ra-book-cover-name">' + escapeHtml(book.name) + '</div></div>';
        }
        card.innerHTML =
            coverHtml +
            '<div class="ra-book-info">' +
                '<div class="ra-book-title">' + escapeHtml(book.name) + '</div>' +
                '<div class="ra-book-progress-bar"><div class="ra-book-progress-fill" style="width:' + progress + '%;"></div></div>' +
            '</div>';
        var longTimer = null;
        var cardTouchMoved = false;
        card.addEventListener('touchstart', function(e) {
            cardTouchMoved = false;
            longTimer = setTimeout(function() { showBookCardMenu(index); }, 500);
        }, { passive: true });
        card.addEventListener('touchend', function(e) {
            clearTimeout(longTimer);
            if (!cardTouchMoved) { openReadingPage(index); }
        });
        card.addEventListener('touchmove', function() { cardTouchMoved = true; clearTimeout(longTimer); });
        return card;
    }

    var raBookMenuIndex = -1;
    function showBookCardMenu(index) {
        raBookMenuIndex = index;
        var menu = document.getElementById('ra-bookcard-menu');
        if (menu) menu.style.display = 'block';
    }

    window.closeBookCardMenu = function() {
        var menu = document.getElementById('ra-bookcard-menu');
        if (menu) menu.style.display = 'none';
    };

    window.changeCoverImage = function() {
        closeBookCardMenu();
        var idx = raBookMenuIndex;
        // 弹出选择方式
        var method = prompt('输入封面图片URL，或留空选择本地上传：');
        if (method === null) return;
        if (method.trim()) {
            // URL — 直接存链接，不占 localStorage 空间
            var books = getBooks();
            if (books[idx]) {
                books[idx].coverImage = method.trim();
                try { saveBooks(books); } catch(e) { alert('保存失败：存储空间不足'); return; }
                restoreBookshelf();
            }
        } else {
            // 本地上传 — 压缩后存 base64
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = function(e) {
                var file = e.target.files[0];
                if (!file) return;
                compressCoverImage(file, function(dataUrl) {
                    var books = getBooks();
                    if (books[idx]) {
                        books[idx].coverImage = dataUrl;
                        try { saveBooks(books); } catch(e) { alert('保存失败：图片太大或存储空间不足'); return; }
                        restoreBookshelf();
                    }
                });
            };
            input.click();
        }
    };

    // 压缩封面图到合理大小
    function compressCoverImage(file, callback) {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function() {
            var maxW = 200, maxH = 300;
            var w = img.width, h = img.height;
            if (w > maxW || h > maxH) {
                var ratio = Math.min(maxW / w, maxH / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            URL.revokeObjectURL(url);
            callback(dataUrl);
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            alert('图片加载失败');
        };
        img.src = url;
    }

    window.deleteBook = function() {
        closeBookCardMenu();
        if (!confirm('确定要删除这本书吗？')) return;
        var books = getBooks();
        books.splice(raBookMenuIndex, 1);
        saveBooks(books);
        restoreBookshelf();
    };

    function createAddCard() {
        var card = document.createElement('div');
        card.className = 'ra-book-card ra-book-add-card';
        card.innerHTML =
            '<div class="ra-book-cover ra-book-cover-empty"><div>' +
                '<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M18 8v20M8 18h20" stroke="#BBB" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</div></div>' +
            '<div class="ra-book-info"><div class="ra-book-title" style="color:#999;">导入书籍</div><div class="ra-book-progress-bar"><div class="ra-book-progress-fill" style="width:0%;"></div></div></div>';
        card.onclick = function() { triggerImport(); };
        return card;
    }

    function triggerImport() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var name = file.name.replace(/\.txt$/i, '');
                var content = ev.target.result;
                var books = getBooks();
                var chapters = scanChapters(content);
                books.push({ name: name, content: content, progress: 0, chapters: chapters });
                saveBooks(books);
                restoreBookshelf();
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ===== 阅读页逻辑 =====
    function openReadingPage(index) {
        raCurrentBook = index;
        var books = getBooks();
        var book = books[index];
        if (!book || !book.content) return;

        document.getElementById('bookshelf-page').style.display = 'none';
        document.getElementById('reading-page').style.display = 'flex';
        document.getElementById('reading-bookname').textContent = book.name;

        var contentEl = document.getElementById('reading-content');
        var paragraphs = book.content.split(/\n+/).filter(function(p) { return p.trim().length > 0; });
        contentEl.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < paragraphs.length; i++) {
            var p = document.createElement('p');
            p.textContent = paragraphs[i].trim();
            p.setAttribute('data-para-index', i);
            frag.appendChild(p);
        }
        contentEl.appendChild(frag);

        // 缓存段落节点数组和索引映射，避免后续频繁 querySelectorAll
        raParaArray = Array.prototype.slice.call(contentEl.querySelectorAll('p[data-para-index]'));
        raParaMap = {};
        for (var pi = 0; pi < raParaArray.length; pi++) {
            raParaMap[raParaArray[pi].getAttribute('data-para-index')] = raParaArray[pi];
        }

        raChapters = book.chapters || [];
        raCurrentChapter = 0;
        restoreNoteMarks(index);
        restoreAnnotationsForBook(index);
        applySettings();

        // 恢复阅读进度（精确到段落）
        var state = getReadingState();
        var body = document.getElementById('reading-body');
        if (state['book_' + index] && body) {
            setTimeout(function() {
                var st = state['book_' + index];
                if (st.paragraphIndex >= 0) {
                    var contentEl = document.getElementById('reading-content');
                    var p = contentEl ? contentEl.querySelector('[data-para-index="' + st.paragraphIndex + '"]') : null;
                    if (p) {
                        body.scrollTop = p.offsetTop + (st.scrollOffset || 0);
                        return;
                    }
                }
                body.scrollTop = (st.scrollPercent || 0) * body.scrollHeight;
            }, 100);
        }

        raReadingStartTime = Date.now();
        hideReadingMenu();
        var prevDuration = (state['book_' + index] && state['book_' + index].duration) || 0;
        clearInterval(raReadingTimer);
        raReadingTimer = setInterval(function() {
            autoSaveReadingState(prevDuration);
        }, 5000);

        initTapZone();
        initLongPress();
        updateReadingAvatar();
        initTopBarAutoHide();
    }

    window.closeReadingPage = function() {
        saveCurrentReadingState();
        clearInterval(raReadingTimer);
        updateBookProgress();
        hideReadingMenu();
        document.getElementById('reading-page').style.display = 'none';
        document.getElementById('bookshelf-page').style.display = 'flex';
        restoreBookshelf();
    };

    function saveCurrentReadingState() {
        if (raCurrentBook < 0) return;
        var body = document.getElementById('reading-body');
        if (!body) return;
        var state = getReadingState();
        var elapsed = (Date.now() - raReadingStartTime) / 1000;
        var prev = (state['book_' + raCurrentBook] && state['book_' + raCurrentBook].duration) || 0;
        var scrollPercent = body.scrollHeight > 0 ? body.scrollTop / body.scrollHeight : 0;
        // 精确段落级别记忆
        var paraIdx = findVisibleParagraphIndex();
        var scrollOffset = 0;
        if (paraIdx >= 0) {
            var contentEl = document.getElementById('reading-content');
            var p = contentEl ? contentEl.querySelector('[data-para-index="' + paraIdx + '"]') : null;
            if (p) scrollOffset = body.scrollTop - p.offsetTop;
        }
        state['book_' + raCurrentBook] = {
            scrollPercent: scrollPercent,
            paragraphIndex: paraIdx,
            scrollOffset: scrollOffset,
            duration: prev + elapsed,
            lastTime: Date.now()
        };
        saveReadingState(state);
    }

    function findVisibleParagraphIndex() {
        var body = document.getElementById('reading-body');
        if (!body) return -1;
        var scrollTop = body.scrollTop + 80;
        for (var i = raParaArray.length - 1; i >= 0; i--) {
            if (raParaArray[i].offsetTop <= scrollTop) return parseInt(raParaArray[i].getAttribute('data-para-index'));
        }
        return 0;
    }

    function autoSaveReadingState(prevDuration) {
        if (raCurrentBook < 0) return;
        var body = document.getElementById('reading-body');
        if (!body) return;
        var state = getReadingState();
        var elapsed = (Date.now() - raReadingStartTime) / 1000;
        var scrollPercent = body.scrollHeight > 0 ? body.scrollTop / body.scrollHeight : 0;
        state['book_' + raCurrentBook] = {
            scrollPercent: scrollPercent,
            duration: prevDuration + elapsed,
            lastTime: Date.now()
        };
        saveReadingState(state);
    }

    function updateBookProgress() {
        if (raCurrentBook < 0) return;
        var body = document.getElementById('reading-body');
        if (!body || body.scrollHeight <= 0) return;
        var progress = Math.min(100, Math.round((body.scrollTop + body.clientHeight) / body.scrollHeight * 100));
        var books = getBooks();
        if (books[raCurrentBook]) {
            books[raCurrentBook].progress = progress;
            saveBooks(books);
        }
    }

    // ===== 菜单栏逻辑 =====
    // ===== 顶部栏自动隐藏 (Step 19) =====
    var raTopBarInited = false;
    function initTopBarAutoHide() {
        if (raTopBarInited) return;
        raTopBarInited = true;
        var body = document.getElementById('reading-body');
        var topbar = document.getElementById('reading-topbar');
        if (!body || !topbar) return;
        var lastScroll = 0;
        var hideTimer = null;
        topbar.style.transition = 'transform 0.3s ease';
        body.addEventListener('scroll', function() {
            var curScroll = body.scrollTop;
            if (raMenuVisible) {
                topbar.style.transform = 'translateY(0)';
            } else if (curScroll > lastScroll && curScroll > 100) {
                topbar.style.transform = 'translateY(-100%)';
            } else {
                topbar.style.transform = 'translateY(0)';
            }
            lastScroll = curScroll;
        }, { passive: true });
    }

    var raTapZoneInited = false;
    var raLastScrollTime = 0;
    function initTapZone() {
        if (raTapZoneInited) return;
        raTapZoneInited = true;
        var body = document.getElementById('reading-body');
        if (!body) return;

        // 跟踪最近一次滚动时间
        body.addEventListener('scroll', function() {
            raLastScrollTime = Date.now();
        }, { passive: true });

        // 用 click 事件 + 滚动冷却 来检测真正点击
        body.addEventListener('click', function(e) {
            var rp = document.getElementById('reading-page');
            if (!rp || rp.style.display === 'none') return;
            // 滚动后 80ms 内的 click 忽略（防止惯性滚动结束时误触）
            if (Date.now() - raLastScrollTime < 80) return;
            // 有选中文字时忽略
            var sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) return;
            // 点在交互元素上忽略
            if (e.target.closest && e.target.closest('button, a, input, .char-annotation, .ra-mark-click-menu, [onclick]')) return;
            // 只在页面中间 40% 高度区域响应
            var h = window.innerHeight;
            if (e.clientY < h * 0.3 || e.clientY > h * 0.7) return;
            toggleReadingMenu();
        });
    }

    function toggleReadingMenu() {
        if (raMenuVisible) { hideReadingMenu(); } else { showReadingMenu(); }
    }

    function showReadingMenu() {
        raMenuVisible = true;
        var menu = document.getElementById('reading-menu');
        var overlay = document.getElementById('reading-menu-overlay');
        if (menu) menu.classList.add('show');
        if (overlay) overlay.classList.add('show');
        updateMenuStats();
    }

    window.hideReadingMenu = function() {
        raMenuVisible = false;
        var menu = document.getElementById('reading-menu');
        var overlay = document.getElementById('reading-menu-overlay');
        if (menu) menu.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    function updateMenuStats() {
        var state = getReadingState();
        var bookState = state['book_' + raCurrentBook] || {};
        var elapsed = (Date.now() - raReadingStartTime) / 1000 + (bookState.duration || 0);

        var mins = Math.floor(elapsed / 60);
        var durEl = document.getElementById('rm-duration');
        if (durEl) durEl.textContent = mins < 60 ? mins + '分' : Math.floor(mins / 60) + '时' + (mins % 60) + '分';

        var body = document.getElementById('reading-body');
        var progressPercent = 0;
        if (body && body.scrollHeight > 0) {
            progressPercent = Math.min(100, ((body.scrollTop + body.clientHeight) / body.scrollHeight * 100));
        }
        var progEl = document.getElementById('rm-progress');
        if (progEl) progEl.textContent = progressPercent.toFixed(1) + '%';

        var totalChars = 0;
        var contentEl = document.getElementById('reading-content');
        if (contentEl && body) {
            var ps = contentEl.querySelectorAll('p');
            for (var i = 0; i < ps.length; i++) {
                var rect = ps[i].getBoundingClientRect();
                var bodyRect = body.getBoundingClientRect();
                if (rect.bottom < bodyRect.bottom) {
                    totalChars += ps[i].textContent.length;
                }
            }
        }
        var speedEl = document.getElementById('rm-speed');
        var minsElapsed = elapsed / 60;
        if (speedEl) speedEl.textContent = minsElapsed > 0.1 ? Math.round(totalChars / minsElapsed) : '0';

        var notes = getNotes().filter(function(n) { return n.bookIndex === raCurrentBook; });
        var notesEl = document.getElementById('rm-notes');
        if (notesEl) notesEl.textContent = notes.length;

        var slider = document.getElementById('reading-progress-slider');
        if (slider) slider.value = progressPercent;
    }

    window.onProgressSliderChange = function(val) {
        var body = document.getElementById('reading-body');
        if (body && body.scrollHeight > 0) {
            body.scrollTop = (val / 100) * (body.scrollHeight - body.clientHeight);
        }
    };

    // ===== 目录功能 =====
    function scanChapters(content) {
        var lines = content.split('\n');
        var chapters = [];
        var pattern = /^(第[零一二三四五六七八九十百千\d]+[章节回卷集篇]|Chapter\s*\d+|CHAPTER\s*\d+)/;
        var paraIndex = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.length === 0) continue;
            if (pattern.test(line)) {
                chapters.push({ title: line.substring(0, 50), paraIndex: paraIndex });
            }
            paraIndex++;
        }
        return chapters;
    }

    window.openCatalog = function() {
        hideReadingMenu();
        var panel = document.getElementById('catalog-panel');
        var overlay = document.getElementById('catalog-overlay');
        var list = document.getElementById('catalog-list');
        if (!panel || !list) return;

        list.innerHTML = '';
        if (raChapters.length === 0) {
            list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999;font-size:14px;">未检测到章节</div>';
        } else {
            for (var i = 0; i < raChapters.length; i++) {
                (function(idx) {
                    var item = document.createElement('div');
                    item.className = 'ra-catalog-item' + (idx === raCurrentChapter ? ' current' : '');
                    item.textContent = raChapters[idx].title;
                    item.onclick = function() {
                        jumpToChapter(idx);
                        closeCatalog();
                    };
                    list.appendChild(item);
                })(i);
            }
        }
        panel.classList.add('show');
        if (overlay) overlay.classList.add('show');
    };

    window.closeCatalog = function() {
        var panel = document.getElementById('catalog-panel');
        var overlay = document.getElementById('catalog-overlay');
        if (panel) panel.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    function jumpToChapter(idx) {
        if (idx < 0 || idx >= raChapters.length) return;
        raCurrentChapter = idx;
        var paraIndex = raChapters[idx].paraIndex;
        var contentEl = document.getElementById('reading-content');
        var body = document.getElementById('reading-body');
        if (!contentEl || !body) return;
        var p = contentEl.querySelector('[data-para-index="' + paraIndex + '"]');
        if (p) { body.scrollTop = p.offsetTop - 60; }
    }

    window.jumpChapter = function(dir) {
        var next = raCurrentChapter + dir;
        if (next >= 0 && next < raChapters.length) {
            jumpToChapter(next);
            updateMenuStats();
        }
    };

    // ===== 笔记功能 (Step 16: Selection API 增强) =====
    var raLongPressInited = false;
    function initLongPress() {
        if (raLongPressInited) return;
        raLongPressInited = true;
        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var timer = null;
        var touchTarget = null;
        var moved = false;
        contentEl.addEventListener('touchstart', function(e) {
            touchTarget = e.target;
            moved = false;
            // 只在 p 或 p 内的子元素上触发
            var p = touchTarget.closest ? touchTarget.closest('p') : null;
            if (!p && touchTarget.tagName === 'P') p = touchTarget;
            if (!p) return;
            timer = setTimeout(function() {
                // Check if user has selected text via native selection
                var sel = window.getSelection();
                if (sel && sel.toString().trim().length > 0) {
                    raSelectedText = sel.toString().substring(0, 200);
                    raSelectionRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
                } else {
                    raSelectedText = p.textContent.substring(0, 100);
                    raSelectionRange = null;
                }
                raPendingParagraph = p;
                showParagraphMenu();
            }, 500);
        }, { passive: true });
        contentEl.addEventListener('touchend', function() { clearTimeout(timer); });
        contentEl.addEventListener('touchmove', function(e) {
            moved = true;
            clearTimeout(timer);
        });
    }

    var raSelectionRange = null; // 保存用户选区 Range

    function showParagraphMenu() {
        var menu = document.getElementById('paragraph-action-menu');
        if (!menu) return;
        menu.style.display = 'block';
        // 菜单跟随选区位置
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            var rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect.top > 0) {
                menu.style.position = 'fixed';
                menu.style.top = Math.max(10, rect.top - menu.offsetHeight - 10) + 'px';
                menu.style.left = Math.max(10, Math.min(window.innerWidth - 200, rect.left + rect.width / 2 - 90)) + 'px';
                menu.style.transform = 'none';
                return;
            }
        }
        // fallback: 居中
        menu.style.position = 'fixed';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%,-50%)';
    }

    window.closeParagraphMenu = function() {
        var menu = document.getElementById('paragraph-action-menu');
        if (menu) { menu.style.display = 'none'; menu.style.transform = ''; }
    };

    var raCurrentMarkStyle = 'highlight-yellow'; // 默认标记样式
    var raClickedMark = null; // 点击的已标记元素

    window.selectMarkStyle = function(el) {
        var btns = el.parentNode.querySelectorAll('.ra-mark-color-btn, .ra-mark-type-btn');
        // 只在同一行内切换
        var allBtns = el.closest('.ra-note-input-box').querySelectorAll('.ra-mark-color-btn, .ra-mark-type-btn');
        for (var i = 0; i < allBtns.length; i++) allBtns[i].classList.remove('active');
        el.classList.add('active');
        raCurrentMarkStyle = el.getAttribute('data-mark');
    };

    window.startAddNote = function() {
        closeParagraphMenu();
        raCurrentMarkStyle = 'highlight-yellow';
        var modal = document.getElementById('note-input-modal');
        var textEl = document.getElementById('note-selected-text');
        if (textEl) textEl.textContent = raSelectedText;
        if (modal) modal.style.display = 'flex';
        // 重置标记选择
        var allBtns = modal.querySelectorAll('.ra-mark-color-btn, .ra-mark-type-btn');
        for (var i = 0; i < allBtns.length; i++) allBtns[i].classList.remove('active');
        var def = modal.querySelector('[data-mark="highlight-yellow"]');
        if (def) def.classList.add('active');
        var ta = document.getElementById('note-input-textarea');
        if (ta) { ta.value = ''; ta.focus(); }
    };

    window.closeNoteInput = function() {
        var modal = document.getElementById('note-input-modal');
        if (modal) modal.style.display = 'none';
        raPendingParagraph = null;
        raSelectionRange = null;
    };

    window.saveCurrentNote = function() {
        var ta = document.getElementById('note-input-textarea');
        if (!raPendingParagraph) { closeNoteInput(); return; }
        var paraIdx = parseInt(raPendingParagraph.getAttribute('data-para-index'));
        var chapter = findChapterForPara(paraIdx);

        // 确定 startOffset 和 endOffset
        var startOffset = 0, endOffset = raSelectedText.length;
        if (raSelectionRange) {
            try {
                startOffset = raSelectionRange.startOffset;
                endOffset = raSelectionRange.endOffset;
            } catch(e) {}
        }

        var noteData = {
            bookIndex: raCurrentBook,
            chapter: chapter,
            paraIndex: paraIdx,
            startOffset: startOffset,
            endOffset: endOffset,
            selectedText: raSelectedText,
            markType: raCurrentMarkStyle,
            note: ta ? ta.value.trim() : '',
            time: new Date().toLocaleString()
        };

        var notes = getNotes();
        notes.push(noteData);
        saveNotes(notes);

        // 应用标记到文本
        applyMarkToContent(noteData);
        raPendingParagraph.classList.add('ra-has-note');
        closeNoteInput();
    };

    function applyMarkToContent(noteData) {
        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var p = contentEl.querySelector('[data-para-index="' + noteData.paraIndex + '"]');
        if (!p) return;
        // 尝试用 Range 包裹选中文字
        try {
            if (raSelectionRange && p.contains(raSelectionRange.startContainer)) {
                var mark = document.createElement('mark');
                mark.className = 'ra-mark-' + noteData.markType;
                mark.setAttribute('data-note-idx', getNotes().length - 1);
                raSelectionRange.surroundContents(mark);
                initMarkClick(mark);
                return;
            }
        } catch(e) {}
        // fallback: 在段落文本中查找并包裹
        wrapTextInPara(p, noteData.selectedText, noteData.markType, getNotes().length - 1);
    }

    function wrapTextInPara(p, text, markType, noteIdx) {
        var html = p.innerHTML;
        var idx = html.indexOf(escapeHtml(text));
        if (idx === -1) return;
        var before = html.substring(0, idx);
        var matched = html.substring(idx, idx + escapeHtml(text).length);
        var after = html.substring(idx + escapeHtml(text).length);
        p.innerHTML = before + '<mark class="ra-mark-' + markType + '" data-note-idx="' + noteIdx + '">' + matched + '</mark>' + after;
        var mark = p.querySelector('mark[data-note-idx="' + noteIdx + '"]');
        if (mark) initMarkClick(mark);
    }

    function initMarkClick(mark) {
        mark.addEventListener('click', function(e) {
            e.stopPropagation();
            raClickedMark = mark;
            var menu = document.getElementById('ra-mark-click-menu');
            if (!menu) return;
            var rect = mark.getBoundingClientRect();
            menu.style.display = 'block';
            menu.style.top = Math.max(10, rect.bottom + 6) + 'px';
            menu.style.left = Math.max(10, Math.min(window.innerWidth - 160, rect.left)) + 'px';
        });
    }

    window.closeMarkClickMenu = function() {
        var menu = document.getElementById('ra-mark-click-menu');
        if (menu) menu.style.display = 'none';
        raClickedMark = null;
    };

    window.viewMarkNote = function() {
        if (!raClickedMark) { closeMarkClickMenu(); return; }
        var idx = parseInt(raClickedMark.getAttribute('data-note-idx'));
        var notes = getNotes();
        var note = notes[idx];
        closeMarkClickMenu();
        if (note && note.note) {
            alert(note.note);
        }
    };

    window.deleteCurrentMark = function() {
        if (!raClickedMark) { closeMarkClickMenu(); return; }
        var idx = parseInt(raClickedMark.getAttribute('data-note-idx'));
        // 解包标记
        var parent = raClickedMark.parentNode;
        while (raClickedMark.firstChild) { parent.insertBefore(raClickedMark.firstChild, raClickedMark); }
        parent.removeChild(raClickedMark);
        // 删除笔记数据
        var notes = getNotes();
        if (notes[idx]) { notes.splice(idx, 1); saveNotes(notes); }
        closeMarkClickMenu();
    };

    function findChapterForPara(paraIdx) {
        var ch = '未知章节';
        for (var i = raChapters.length - 1; i >= 0; i--) {
            if (raChapters[i].paraIndex <= paraIdx) { ch = raChapters[i].title; break; }
        }
        return ch;
    }

    function restoreNoteMarks(bookIndex) {
        var notes = getNotes().filter(function(n) { return n.bookIndex === bookIndex; });
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            var p = raParaMap[note.paraIndex];
            if (!p) continue;
            p.classList.add('ra-has-note');
            if (note.markType && note.selectedText) {
                wrapTextInPara(p, note.selectedText, note.markType, i);
            }
        }
    }

    window.openNotesPanel = function() {
        hideReadingMenu();
        var panel = document.getElementById('notes-panel');
        var overlay = document.getElementById('notes-overlay');
        var list = document.getElementById('notes-list');
        if (!panel || !list) return;

        var notes = getNotes().filter(function(n) { return n.bookIndex === raCurrentBook; });
        list.innerHTML = '';
        if (notes.length === 0) {
            list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999;font-size:14px;">暂无笔记</div>';
        } else {
            var markColorMap = {
                'highlight-yellow':'rgba(255,235,59,0.6)', 'highlight-green':'rgba(129,199,132,0.6)',
                'highlight-pink':'rgba(244,143,177,0.6)', 'highlight-blue':'rgba(100,181,246,0.6)',
                'underline-solid':'#bf9e6a', 'underline-dashed':'#bf9e6a', 'underline-wavy':'#bf9e6a',
                'strikethrough':'#e57373', 'box':'#bf9e6a'
            };
            for (var i = 0; i < notes.length; i++) {
                (function(note, idx) {
                    var item = document.createElement('div');
                    item.className = 'ra-note-item';
                    var colorDot = note.markType ? '<span class="ra-note-color-dot" style="background:' + (markColorMap[note.markType] || '#DDD') + ';"></span>' : '';
                    var excerptClass = note.markType ? ' ra-mark-' + note.markType : '';
                    item.innerHTML =
                        '<div class="ra-note-chapter">' + colorDot + escapeHtml(note.chapter || '') + '</div>' +
                        '<div class="ra-note-excerpt"><span class="' + excerptClass + '">"' + escapeHtml(note.selectedText || '') + '"</span></div>' +
                        '<div class="ra-note-content">' + escapeHtml(note.note || '') + '</div>' +
                        '<div class="ra-note-time">' + escapeHtml(note.time || '') + '</div>';
                    item.onclick = function() {
                        closeNotesPanel();
                        var body = document.getElementById('reading-body');
                        var contentEl = document.getElementById('reading-content');
                        if (body && contentEl) {
                            var p = contentEl.querySelector('[data-para-index="' + note.paraIndex + '"]');
                            if (p) {
                                body.scrollTop = p.offsetTop - 60;
                                // 闪烁高亮
                                var mark = p.querySelector('mark[data-note-idx="' + idx + '"]');
                                if (mark) {
                                    mark.classList.add('ra-mark-flash');
                                    setTimeout(function() { mark.classList.remove('ra-mark-flash'); }, 1500);
                                }
                            }
                        }
                    };
                    list.appendChild(item);
                })(notes[i], i);
            }
        }
        panel.classList.add('show');
        if (overlay) overlay.classList.add('show');
    };

    window.closeNotesPanel = function() {
        var panel = document.getElementById('notes-panel');
        var overlay = document.getElementById('notes-overlay');
        if (panel) panel.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    // ===== 夜间模式 =====
    window.toggleNightMode = function() {
        var isNight = document.body.classList.toggle('night-mode');
        var s = getSettings();
        s.nightMode = isNight;
        saveSettings(s);
        // JS 直接设置背景色，不依赖 CSS class 覆盖
        var body = document.getElementById('reading-body');
        var page = document.getElementById('reading-page');
        var contentEl = document.getElementById('reading-content');
        if (isNight) {
            if (body) body.style.background = '#1a1814';
            if (page) page.style.background = '#1a1814';
            if (contentEl) contentEl.style.color = '#c8b99a';
        } else {
            var bgColor = s.bgColor || '#F9F8F5';
            var textColor = s.textColor || '#333';
            if (body) body.style.background = bgColor;
            if (page) page.style.background = bgColor;
            if (contentEl) contentEl.style.color = textColor;
        }
        var btn = document.getElementById('night-mode-btn');
        if (btn) {
            var span = btn.querySelector('span');
            if (span) span.textContent = isNight ? '日间' : '夜间';
        }
    };

    (function() {
        var s = getSettings();
        if (s.nightMode) { document.body.classList.add('night-mode'); }
    })();

    // ===== 批注功能 (Step 14 完整版) =====

    // 更新顶部角色头像显示
    function updateReadingAvatar() {
        var el = document.getElementById('reading-avatar');
        if (!el) return;
        // 群聊用群名首字，避免显示默认的"群聊"SVG
        if (raCurrentChar && raCurrentChar.avatar && !/群聊/.test(raCurrentChar.avatar)) {
            el.innerHTML = '<img src="' + raCurrentChar.avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        } else if (raCurrentChar && raCurrentChar.name) {
            el.innerHTML = '<span style="font-size:13px;color:#666;">' + escapeHtml(raCurrentChar.name.charAt(0)) + '</span>';
        } else {
            el.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#999" stroke-width="1.5"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#999" stroke-width="1.5" stroke-linecap="round"/></svg>';
        }
        el.onclick = function() { openCharPicker(); };
    }

    // 打开角色选择面板
    window.openCharPicker = function() {
        var panel = document.getElementById('char-picker');
        var overlay = document.getElementById('char-picker-overlay');
        var list = document.getElementById('char-picker-list');
        if (!panel || !list) return;

        list.innerHTML = '';
        var chars = (typeof wcState !== 'undefined' && Array.isArray(wcState.characters))
            ? wcState.characters
            : [];

        if (chars.length === 0) {
            list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999;font-size:14px;">通讯录里还没有角色</div>';
        } else {
            for (var i = 0; i < chars.length; i++) {
                (function(ch) {
                    var item = document.createElement('div');
                    item.className = 'ra-char-item' + (raCurrentChar && raCurrentChar.id === ch.id ? ' selected' : '');
                    // 群聊使用群名首字作为头像，避免显示默认的"群聊"SVG
                    var avatarHtml;
                    if (ch.avatar && !(/群聊/.test(ch.avatar))) {
                        avatarHtml = '<img src="' + ch.avatar + '">';
                    } else if (ch.isGroup || /群聊/.test(ch.avatar || '')) {
                        avatarHtml = '<span style="font-size:20px;font-weight:700;color:#888;">' + escapeHtml((ch.name || '群').charAt(0)) + '</span>';
                    } else {
                        avatarHtml = escapeHtml(ch.name ? ch.name.charAt(0) : '?');
                    }
                    var checkHtml = (raCurrentChar && raCurrentChar.id === ch.id)
                        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#bf9e6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                        : '';
                    item.innerHTML =
                        '<div class="ra-char-avatar-circle">' + avatarHtml + '</div>' +
                        '<div class="ra-char-name">' + escapeHtml(ch.name || '未命名') + '</div>' +
                        '<div class="ra-char-check">' + checkHtml + '</div>';
                    item.onclick = function() {
                        raCurrentChar = { id: ch.id, name: ch.name, avatar: ch.avatar || '', prompt: ch.prompt || '' };
                        localStorage.setItem('ra_currentChar', JSON.stringify(raCurrentChar));
                        updateReadingAvatar();
                        closeCharPicker();
                        // 如果是从"让TA看看"触发选角色，选完后自动继续批注
                        if (raPendingParagraph) { letCharSee(); }
                    };
                    list.appendChild(item);
                })(chars[i]);
            }
        }
        panel.classList.add('show');
        if (overlay) overlay.classList.add('show');
    };

    window.closeCharPicker = function() {
        var panel = document.getElementById('char-picker');
        var overlay = document.getElementById('char-picker-overlay');
        if (panel) panel.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    // 批注提示条
    function showAnnotationToast(charName, paraIdx) {
        raLatestAnnotationParaIdx = paraIdx;
        var toast = document.getElementById('annotation-toast');
        var textEl = document.getElementById('annotation-toast-text');
        if (!toast || !textEl) return;
        textEl.textContent = charName + ' 有新批注 →';
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 3000);
    }

    window.scrollToLatestAnnotation = function() {
        var toast = document.getElementById('annotation-toast');
        if (toast) toast.classList.remove('show');
        if (raLatestAnnotationParaIdx < 0) return;
        var body = document.getElementById('reading-body');
        var contentEl = document.getElementById('reading-content');
        if (!body || !contentEl) return;
        var p = contentEl.querySelector('[data-para-index="' + raLatestAnnotationParaIdx + '"]');
        if (p) body.scrollTop = p.offsetTop - 60;
    };

    // 构建批注气泡
    function buildAnnotationBubble(charName, charAvatar, content, annotationIdx) {
        var bubble = document.createElement('div');
        bubble.className = 'char-annotation';
        var avatarHtml = (charAvatar && !/群聊/.test(charAvatar))
            ? '<img src="' + charAvatar + '">'
            : '<span style="font-size:10px;color:#999;">' + escapeHtml((charName || '?').charAt(0)) + '</span>';
        var repliesHtml = '';
        if (typeof annotationIdx === 'number' && annotationIdx >= 0) {
            var annotations = getAnnotations();
            var ann = annotations[annotationIdx];
            if (ann && ann.replies && ann.replies.length > 0) {
                for (var r = 0; r < ann.replies.length; r++) {
                    repliesHtml += '<div style="margin-top:8px;padding-left:12px;border-left:2px solid #E0E0E0;font-size:12px;color:#888;">' + escapeHtml(ann.replies[r].content) + '</div>';
                }
            }
        }
        var replyBtn = typeof annotationIdx === 'number' ? '<div style="margin-top:6px;text-align:right;"><button onclick="replyToAnnotation(' + annotationIdx + ',this)" style="border:none;background:none;color:#bf9e6a;font-size:12px;cursor:pointer;">回复</button></div>' : '';
        bubble.innerHTML =
            '<div class="char-annotation-header"><div class="char-annotation-avatar">' + avatarHtml + '</div><div class="char-annotation-name">' + escapeHtml(charName || '角色') + '</div></div>' +
            '<div>' + escapeHtml(content) + '</div>' +
            repliesHtml + replyBtn;
        if (typeof annotationIdx === 'number') bubble.setAttribute('data-ann-idx', annotationIdx);
        return bubble;
    }

    window.letCharSee = function() {
        // 保存段落引用后再关菜单
        var pendingPara = raPendingParagraph;
        var selectedTxt = raSelectedText;
        closeParagraphMenu();
        if (!pendingPara) return;

        if (!raCurrentChar || !raCurrentChar.name) {
            raPendingParagraph = pendingPara; // 保留引用供选角色后使用
            openCharPicker();
            return;
        }

        var paraIdx = parseInt(pendingPara.getAttribute('data-para-index'));
        var text = pendingPara.textContent;

        // 显示浮动提示
        showAnnotatingToast(raCurrentChar.name);

        var books = getBooks();
        var bookName = (books[raCurrentBook] && books[raCurrentBook].name) || '一本书';
        var charPersona = raCurrentChar.prompt || '';
        var sysPrompt = charPersona +
            '\n你现在正在和用户一起读《' + bookName + '》，用户把正在读的段落分享给你，请以同读者的视角自然回应，像朋友间随口说的反应，不要分析，不要总结，可以有情绪、可以提问、可以猜后续，回应简短即可。';

        var charName = raCurrentChar.name;
        var charAvatar = raCurrentChar.avatar;

        callReadingAPI(sysPrompt, text, function(reply) {
            hideAnnotatingToast();
            // 先存数据，再建气泡（确保有正确的 index 用于回复按钮）
            var annotations = getAnnotations();
            annotations.push({
                bookIndex: raCurrentBook, paraIndex: paraIdx,
                charName: charName, charAvatar: charAvatar,
                content: reply, time: new Date().toLocaleString()
            });
            saveAnnotations(annotations);
            var annIdx = annotations.length - 1;

            var finalBubble = buildAnnotationBubble(charName, charAvatar, reply, annIdx);
            var contentEl = document.getElementById('reading-content');
            if (contentEl) {
                var p = contentEl.querySelector('[data-para-index="' + paraIdx + '"]');
                if (p) p.parentNode.insertBefore(finalBubble, p.nextSibling);
            }
            showAnnotationToast(charName, paraIdx);
        }, function(err) {
            hideAnnotatingToast();
            alert('批注失败: ' + err);
        });
    };

    // 正在批注中 仿书信浮动提示
    var raWriteTimer = null;
    var raWriteText = '';
    var raWriteIndex = 0;
    function showAnnotatingToast(charName) {
        hideAnnotatingToast();
        var toast = document.createElement('div');
        toast.id = 'ra-annotating-toast';
        toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:999;pointer-events:none;';

        // 信纸卡片
        toast.innerHTML =
            '<div style="background:linear-gradient(135deg,#fdf6e8,#f7eeda);border:1px solid #d4c5a0;border-radius:10px;padding:14px 22px 14px 36px;box-shadow:0 4px 20px rgba(80,50,20,0.15),inset 0 0 60px rgba(139,115,85,0.06);position:relative;max-width:280px;">' +
                // 左边红色竖线装饰
                '<div style="position:absolute;left:12px;top:10px;bottom:10px;width:2px;background:linear-gradient(to bottom,#c44,#c44 60%,transparent);border-radius:1px;"></div>' +
                // 红色横线装饰（信纸风格）
                '<div style="position:absolute;left:16px;right:12px;bottom:8px;height:1px;background:rgba(180,150,120,0.3);"></div>' +
                '<div style="position:absolute;left:16px;right:12px;bottom:12px;height:1px;background:rgba(180,150,120,0.2);"></div>' +
                // 名字行
                '<div style="font-size:11px;color:#8B7355;margin-bottom:6px;letter-spacing:1px;">致 ' + escapeHtml(charName) + '：</div>' +
                // 写字动画文本
                '<div id="ra-write-text" style="font-size:13px;color:#5a4630;line-height:1.6;min-height:20px;"></div>' +
                // 羽毛笔图标
                '<div style="position:absolute;right:14px;bottom:10px;opacity:0.6;">' +
                    '<svg width="18" height="18" viewBox="0 0 24 24" style="animation:ra-pen-bob 2s ease-in-out infinite;">' +
                        '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#8B7355"/>' +
                    '</svg>' +
                '</div>' +
            '</div>';

        document.body.appendChild(toast);

        // 写字逐字动画
        raWriteText = charName + ' 正在批注中...';
        raWriteIndex = 0;
        var textEl = document.getElementById('ra-write-text');
        if (textEl) textEl.textContent = '';
        raWriteTimer = setInterval(function() {
            var el = document.getElementById('ra-write-text');
            if (!el) { clearInterval(raWriteTimer); return; }
            if (raWriteIndex < raWriteText.length) {
                el.textContent += raWriteText[raWriteIndex];
                raWriteIndex++;
            } else {
                // 写完后再从头循环
                raWriteIndex = 0;
                el.textContent = '';
            }
        }, 120);

        // 注入动画 keyframes
        if (!document.getElementById('ra-write-style')) {
            var s = document.createElement('style');
            s.id = 'ra-write-style';
            s.textContent = '@keyframes ra-pen-bob{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-3px) rotate(5deg)}}';
            document.head.appendChild(s);
        }
    }

    function hideAnnotatingToast() {
        if (raWriteTimer) { clearInterval(raWriteTimer); raWriteTimer = null; }
        var t = document.getElementById('ra-annotating-toast');
        if (t) t.remove();
    }

    async function callReadingAPI(systemPrompt, userMessage, onSuccess, onError) {
        try {
            var apiConfig = await getActiveApiConfig('chat');
            if (!apiConfig || !apiConfig.key) { onError('请先在主设置中配置 API'); return; }
            var res = await fetch(apiConfig.baseUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiConfig.key
                },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 1000,
                    temperature: parseFloat(apiConfig.temp) || 0.8
                })
            });
            var data = await res.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                onSuccess(data.choices[0].message.content);
            } else if (data.error) {
                onError(data.error.message || 'API 错误');
            } else {
                onError('未知响应格式: ' + JSON.stringify(data).substring(0, 200));
            }
        } catch(err) {
            onError(err.message || '网络错误');
        }
    }

    function restoreAnnotationsForBook(bookIndex) {
        var allAnnotations = getAnnotations();
        for (var i = 0; i < allAnnotations.length; i++) {
            var a = allAnnotations[i];
            if (a.bookIndex !== bookIndex) continue;
            var p = raParaMap[a.paraIndex];
            if (p) {
                var bubble = buildAnnotationBubble(a.charName || '角色', a.charAvatar || '', a.content || a.text || '', i);
                p.parentNode.insertBefore(bubble, p.nextSibling);
            }
        }
    }

    // 回复批注 (Step 22)
    window.replyToAnnotation = function(annIdx, btn) {
        var annotations = getAnnotations();
        var ann = annotations[annIdx];
        if (!ann) return;

        var replyText = prompt('输入你的回复:');
        if (!replyText || !replyText.trim()) return;

        var contentEl = document.getElementById('reading-content');
        var p = raParaMap[ann.paraIndex];
        var originalText = p ? p.textContent : '';
        var charName = ann.charName || '角色';

        var charPersona = '';
        if (raCurrentChar && raCurrentChar.prompt) charPersona = raCurrentChar.prompt;
        var books = getBooks();
        var bookName = (books[raCurrentBook] && books[raCurrentBook].name) || '一本书';

        var sysPrompt = charPersona + '\n你现在正在和用户一起读《' + bookName + '》。';
        var userMsg = '原文段落：' + originalText + '\n\n你之前的批注：' + ann.content + '\n\n用户回复你说：' + replyText.trim() + '\n\n请继续以你的角色自然回应，简短即可。';

        var bubble = btn.closest('.char-annotation');
        showAnnotatingToast(charName);

        callReadingAPI(sysPrompt, userMsg, function(reply) {
            hideAnnotatingToast();
            var replyDiv = document.createElement('div');
            replyDiv.style.cssText = 'margin-top:8px;padding-left:12px;border-left:2px solid #E0E0E0;font-size:12px;color:#888;';
            replyDiv.textContent = reply;
            // 把回复插入到按钮之前
            if (bubble && btn.parentNode) {
                btn.parentNode.insertBefore(replyDiv, btn);
            }
            if (!ann.replies) ann.replies = [];
            ann.replies.push({ content: reply, time: new Date().toLocaleString() });
            annotations[annIdx] = ann;
            saveAnnotations(annotations);
        }, function(err) {
            hideAnnotatingToast();
            alert('回复失败: ' + err);
        });
    };

    // ===== 设置面板 (Step 15 完整版) =====
    window.openSettingsPanel = function() {
        hideReadingMenu();
        var panel = document.getElementById('reading-settings-panel');
        var overlay = document.getElementById('settings-panel-overlay');
        if (panel) panel.classList.add('show');
        if (overlay) overlay.classList.add('show');

        var s = getSettings();
        var apiInput = document.getElementById('ra-apikey');
        var fallbackKey = '';
        if (!s.apiKey) { var mk = document.getElementById('apiKey'); if (mk && mk.value) fallbackKey = mk.value; }
        if (apiInput) apiInput.value = s.apiKey || fallbackKey;

        highlightOption('ra-fontsize-options', s.fontSize || 'medium');
        highlightOption('ra-lineheight-options', s.lineHeight || 'normal');
        highlightOption('ra-paddingx-options', s.paddingX || 'medium');
        highlightOption('ra-paraspacing-options', s.paraSpacing || 'normal');
        highlightOption('ra-pagemode-options', s.pageMode || 'scroll');
        highlightOption('ra-annstyle-options', s.annotationStyle || 'line');
        highlightOption('ra-tts-speed-options', String(s.ttsSpeed || 1));

        var fontSelect = document.getElementById('ra-fontfamily-select');
        if (fontSelect) fontSelect.value = s.fontFamily || 'sans';
        var annFontSelect = document.getElementById('ra-annfont-select');
        if (annFontSelect) annFontSelect.value = s.annotationFont || 'inherit';

        var ttsEnabled = document.getElementById('ra-tts-enabled');
        if (ttsEnabled) ttsEnabled.checked = !!s.ttsEnabled;
        var ttsSource = document.getElementById('ra-tts-source');
        if (ttsSource) { ttsSource.value = s.ttsSource || 'system'; onTtsSourceChange(); }

        var mmKey = document.getElementById('ra-tts-minimax-key');
        var mmGroup = document.getElementById('ra-tts-minimax-group');
        var customUrl = document.getElementById('ra-tts-custom-url');
        if (mmKey) mmKey.value = s.ttsKey || '';
        if (mmGroup) mmGroup.value = s.ttsGroupId || '';
        if (customUrl) customUrl.value = s.ttsUrl || '';

        var bgPicker = document.getElementById('ra-bgcolor-picker');
        if (bgPicker) bgPicker.value = s.bgColor || '#faf8f5';
        var textPicker = document.getElementById('ra-textcolor-picker');
        if (textPicker) textPicker.value = s.textColor || '#333333';
        var annBg = document.getElementById('ra-ann-bgcolor');
        if (annBg) annBg.value = s.annotationBgColor || '#FBF9F4';
        var annTc = document.getElementById('ra-ann-textcolor');
        if (annTc) annTc.value = s.annotationTextColor || '#666666';

        renderSavedBgColors();
        loadCustomFontsToSelect();
    };

    window.closeSettingsPanel = function() {
        var panel = document.getElementById('reading-settings-panel');
        var overlay = document.getElementById('settings-panel-overlay');
        if (panel) panel.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    window.saveReadingSettings = function() {
        var s = getSettings();
        var apiInput = document.getElementById('ra-apikey');
        if (apiInput) s.apiKey = apiInput.value;
        var ttsEnabled = document.getElementById('ra-tts-enabled');
        if (ttsEnabled) s.ttsEnabled = ttsEnabled.checked;
        var ttsSource = document.getElementById('ra-tts-source');
        if (ttsSource) s.ttsSource = ttsSource.value;
        var mmKey = document.getElementById('ra-tts-minimax-key');
        if (mmKey) s.ttsKey = mmKey.value;
        var mmGroup = document.getElementById('ra-tts-minimax-group');
        if (mmGroup) s.ttsGroupId = mmGroup.value;
        var customUrl = document.getElementById('ra-tts-custom-url');
        if (customUrl) s.ttsUrl = customUrl.value;
        saveSettings(s);
    };

    window.onTtsSourceChange = function() {
        var src = document.getElementById('ra-tts-source');
        if (!src) return;
        var v = src.value;
        var mm = document.getElementById('ra-tts-minimax-fields');
        var cu = document.getElementById('ra-tts-custom-fields');
        if (mm) mm.style.display = v === 'minimax' ? 'block' : 'none';
        if (cu) cu.style.display = v === 'custom' ? 'block' : 'none';
        saveReadingSettings();
    };

    window.applyFontSize = function(size) {
        var s = getSettings(); s.fontSize = size; saveSettings(s);
        highlightOption('ra-fontsize-options', size);
        var contentEl = document.getElementById('reading-content');
        if (contentEl) { contentEl.style.fontSize = ({ small:'14px', medium:'16px', large:'18px' })[size] || '16px'; }
    };

    window.applyLineHeight = function(h) {
        var s = getSettings(); s.lineHeight = h; saveSettings(s);
        highlightOption('ra-lineheight-options', h);
        var contentEl = document.getElementById('reading-content');
        if (contentEl) { contentEl.style.lineHeight = ({ compact:'1.5', normal:'1.8', loose:'2.2' })[h] || '1.8'; }
    };

    window.applyPaddingX = function(v) {
        var s = getSettings(); s.paddingX = v; saveSettings(s);
        highlightOption('ra-paddingx-options', v);
        var contentEl = document.getElementById('reading-content');
        if (contentEl) { contentEl.style.padding = '20px ' + ({ narrow:'3%', medium:'6%', wide:'10%' })[v] || '6%'; }
    };

    window.applyParaSpacing = function(v) {
        var s = getSettings(); s.paraSpacing = v; saveSettings(s);
        highlightOption('ra-paraspacing-options', v);
        var map = { compact:'8px', normal:'16px', loose:'28px' };
        var ss = document.getElementById('ra-para-spacing-style');
        if (!ss) { ss = document.createElement('style'); ss.id = 'ra-para-spacing-style'; document.head.appendChild(ss); }
        ss.textContent = '#reading-content p { margin-bottom: ' + (map[v] || '16px') + '; }';
    };

    window.applyFontFamily = function(v) {
        var s = getSettings(); s.fontFamily = v; saveSettings(s);
        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var map = { sans: '-apple-system, "Helvetica Neue", Arial, sans-serif', songti: '"SimSun", "STSong", "Songti SC", serif', msyh: '"Microsoft YaHei", "PingFang SC", sans-serif' };
        if (map[v]) { contentEl.style.fontFamily = map[v]; }
        else { contentEl.style.fontFamily = v; } // custom font name
    };

    window.applyTextColor = function(c) {
        var s = getSettings(); s.textColor = c; saveSettings(s);
        var contentEl = document.getElementById('reading-content');
        if (contentEl) contentEl.style.color = c;
    };

    window.applyBgColor = function(c) {
        var s = getSettings(); s.bgColor = c; saveSettings(s);
        if (!s.nightMode) {
            var body = document.getElementById('reading-body');
            var page = document.getElementById('reading-page');
            if (body) body.style.background = c;
            if (page) page.style.background = c;
        }
    };

    function renderSavedBgColors() {
        var container = document.getElementById('ra-saved-bg-colors');
        if (!container) return;
        container.innerHTML = '';
        var s = getSettings();
        var saved = s.savedBgColors || [];
        for (var i = 0; i < saved.length; i++) {
            (function(color, idx) {
                var el = document.createElement('div');
                el.className = 'ra-saved-color-item';
                el.style.background = color;
                el.onclick = function() { applyBgColor(color); };
                container.appendChild(el);
            })(saved[i], i);
        }
    }

    window.saveBgColorPreset = function() {
        var s = getSettings();
        if (!s.savedBgColors) s.savedBgColors = [];
        var c = s.bgColor || '#faf8f5';
        if (s.savedBgColors.indexOf(c) === -1) {
            if (s.savedBgColors.length >= 5) s.savedBgColors.shift();
            s.savedBgColors.push(c);
            saveSettings(s);
        }
        renderSavedBgColors();
    };

    window.applyPageMode = function(mode) {
        var s = getSettings(); s.pageMode = mode; saveSettings(s);
        highlightOption('ra-pagemode-options', mode);
        setupPageMode(mode);
    };

    function setupPageMode(mode) {
        var body = document.getElementById('reading-body');
        var contentEl = document.getElementById('reading-content');
        if (!body || !contentEl) return;
        if (mode === 'smooth') {
            setupPaginatedMode();
        } else {
            teardownPaginatedMode();
        }
    }

    var raPaginatedState = { pages: 1, currentPage: 0, startX: 0, startY: 0, origPadding: '', inited: false };

    function setupPaginatedMode() {
        var body = document.getElementById('reading-body');
        if (!body) return;
        body.style.overflow = 'hidden';
        paginateContent();
        if (!raPaginatedState.inited) {
            raPaginatedState.inited = true;
            body.addEventListener('touchstart', onPageTouchStart, { passive: true });
            body.addEventListener('touchend', onPageTouchEnd, { passive: true });
        }
    }

    function teardownPaginatedMode() {
        var body = document.getElementById('reading-body');
        var contentEl = document.getElementById('reading-content');
        if (!body) return;
        body.style.overflow = '';
        if (contentEl) {
            contentEl.style.transform = '';
            contentEl.style.transition = '';
            contentEl.style.columnWidth = '';
            contentEl.style.columnGap = '';
            contentEl.style.columnFill = '';
            contentEl.style.height = '';
            contentEl.style.width = '';
            // Restore original padding
            if (raPaginatedState.origPadding !== undefined) {
                contentEl.style.padding = raPaginatedState.origPadding;
            }
            // 清除分页模式注入的子元素 padding 样式
            var pps = document.getElementById('ra-page-padding-style');
            if (pps) pps.textContent = '';
        }
    }

    function paginateContent() {
        var body = document.getElementById('reading-body');
        var contentEl = document.getElementById('reading-content');
        if (!body || !contentEl) return;

        var pageW = body.clientWidth;
        var pageH = body.clientHeight;
        if (pageW <= 0 || pageH <= 0) return;

        // Save and read original padding
        var cs = getComputedStyle(contentEl);
        var padL = cs.paddingLeft || '0px';
        var padR = cs.paddingRight || '0px';
        var padT = cs.paddingTop || '0px';
        var padB = cs.paddingBottom || '0px';
        raPaginatedState.origPadding = contentEl.style.padding || '';

        // Remove horizontal padding from container, keep vertical
        contentEl.style.padding = padT + ' 0 ' + padB + ' 0';
        // Set width = viewport width, so each column = viewport width
        contentEl.style.width = pageW + 'px';
        contentEl.style.height = pageH + 'px';
        contentEl.style.columnWidth = pageW + 'px';
        contentEl.style.columnGap = '0px';
        contentEl.style.columnFill = 'auto';

        // 用 CSS 给子元素加水平 padding，避免逐元素循环
        var pps = document.getElementById('ra-page-padding-style');
        if (!pps) { pps = document.createElement('style'); pps.id = 'ra-page-padding-style'; document.head.appendChild(pps); }
        pps.textContent = '#reading-content > * { padding-left: ' + padL + ' !important; padding-right: ' + padR + ' !important; box-sizing: border-box; }';

        setTimeout(function() {
            var totalW = contentEl.scrollWidth;
            raPaginatedState.pages = Math.max(1, Math.round(totalW / pageW));
            raPaginatedState.currentPage = 0;
            contentEl.style.transition = 'transform 0.35s ease-out';
            contentEl.style.transform = 'translateX(0)';
        }, 100);
    }

    function onPageTouchStart(e) {
        raPaginatedState.startX = e.touches[0].clientX;
        raPaginatedState.startY = e.touches[0].clientY;
    }

    function onPageTouchEnd(e) {
        var s = getSettings();
        if (s.pageMode !== 'smooth') return;

        var dx = e.changedTouches[0].clientX - raPaginatedState.startX;
        var dy = e.changedTouches[0].clientY - raPaginatedState.startY;
        // Only respond to horizontal swipes
        if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

        var body = document.getElementById('reading-body');
        if (!body) return;
        var pageW = body.clientWidth;

        if (dx < -50) {
            // Swipe left → next page
            if (raPaginatedState.currentPage < raPaginatedState.pages - 1) {
                raPaginatedState.currentPage++;
            } else {
                showFinishToast();
                return;
            }
        } else if (dx > 50) {
            // Swipe right → previous page
            if (raPaginatedState.currentPage > 0) {
                raPaginatedState.currentPage--;
            }
        }

        var contentEl = document.getElementById('reading-content');
        if (contentEl) {
            contentEl.style.transition = 'transform 0.35s ease-out';
            contentEl.style.transform = 'translateX(-' + (raPaginatedState.currentPage * pageW) + 'px)';
        }
    }

    function showFinishToast() {
        var existing = document.getElementById('ra-finish-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.id = 'ra-finish-toast';
        toast.textContent = '已经看完啦~';
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;padding:14px 28px;border-radius:12px;font-size:15px;z-index:999;pointer-events:none;animation:ra-toast-fade 2s forwards;';
        var style = document.createElement('style');
        style.textContent = '@keyframes ra-toast-fade{0%,60%{opacity:1}100%{opacity:0}}';
        toast.appendChild(style);
        document.body.appendChild(toast);
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2000);
    }

    window.applyAnnotationFont = function(v) {
        var s = getSettings(); s.annotationFont = v; saveSettings(s);
        applyAnnotationStyles();
    };

    window.applyAnnotationStyle = function(v) {
        var s = getSettings(); s.annotationStyle = v; saveSettings(s);
        highlightOption('ra-annstyle-options', v);
        applyAnnotationStyles();
    };

    window.applyAnnotationColors = function() {
        var s = getSettings();
        var bg = document.getElementById('ra-ann-bgcolor');
        var tc = document.getElementById('ra-ann-textcolor');
        if (bg) s.annotationBgColor = bg.value;
        if (tc) s.annotationTextColor = tc.value;
        saveSettings(s);
        applyAnnotationStyles();
    };

    function applyAnnotationStyles() {
        var s = getSettings();
        var els = document.querySelectorAll('.char-annotation');
        var fontMap = { sans:'-apple-system,sans-serif', serif:'Georgia,serif', handwriting:'"Ma Shan Zheng",cursive', inherit:'inherit' };
        for (var i = 0; i < els.length; i++) {
            els[i].className = 'char-annotation';
            var style = s.annotationStyle || 'line';
            if (style !== 'line') els[i].classList.add('ann-style-' + style);
            els[i].style.fontFamily = fontMap[s.annotationFont || 'inherit'] || 'inherit';
            if (s.annotationBgColor && style !== 'minimal') els[i].style.background = s.annotationBgColor;
            if (s.annotationTextColor) els[i].style.color = s.annotationTextColor;
        }
    }

    window.applyTtsSpeed = function(v) {
        var s = getSettings(); s.ttsSpeed = v; saveSettings(s);
        highlightOption('ra-tts-speed-options', String(v));
    };

    // 自定义字体上传
    window.uploadCustomFont = function(target) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ttf,.otf,.woff,.woff2';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var fontName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
            var reader = new FileReader();
            reader.onload = function(ev) {
                var base64 = ev.target.result;
                registerCustomFont(fontName, base64, target);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    window.loadFontFromUrl = function(target) {
        var urlInput = document.getElementById('ra-font-url');
        if (!urlInput || !urlInput.value.trim()) return;
        var url = urlInput.value.trim();
        var fontName = url.split('/').pop().replace(/\.(ttf|otf|woff2?)$/i, '') || 'CustomFont';
        registerCustomFont(fontName, 'url(' + url + ')', target);
        urlInput.value = '';
    };

    function registerCustomFont(fontName, src, target) {
        try {
            var fontSrc = src.startsWith('url(') ? src : 'url(' + src + ')';
            var font = new FontFace(fontName, fontSrc);
            font.load().then(function(loaded) {
                document.fonts.add(loaded);
                var isBase64 = /^data:/.test(src);
                // 本地 base64 字体存 IndexedDB，避免撑爆 localStorage (5MB 限制)
                var savePromise = isBase64 ? idb.set('ra_font_data_' + fontName, src) : Promise.resolve();
                savePromise.then(function() {
                    var s = getSettings();
                    if (!s.customFonts) s.customFonts = [];
                    var existing = s.customFonts.find(function(f) { return f.name === fontName; });
                    if (!existing) {
                        s.customFonts.push({ name: fontName, src: isBase64 ? ('__idb__:' + fontName) : src });
                        saveSettings(s);
                    }
                    loadCustomFontsToSelect();
                    if (target === 'body') applyFontFamily(fontName);
                }).catch(function(err) {
                    alert('字体存储失败: ' + err.message + '\n请尝试使用URL方式加载字体');
                });
            }).catch(function(err) { alert('字体加载失败: ' + err.message); });
        } catch(err) { alert('字体注册失败: ' + err.message); }
    }

    function loadCustomFontsToSelect() {
        var s = getSettings();
        var fonts = s.customFonts || [];
        var select = document.getElementById('ra-fontfamily-select');
        if (!select) return;
        // Remove old custom options
        var opts = select.querySelectorAll('option[data-custom]');
        for (var i = 0; i < opts.length; i++) opts[i].remove();
        // Add custom fonts
        for (var j = 0; j < fonts.length; j++) {
            (function(fontEntry) {
                var opt = document.createElement('option');
                opt.value = fontEntry.name;
                opt.textContent = fontEntry.name;
                opt.setAttribute('data-custom', '1');
                opt.style.fontFamily = fontEntry.name;
                select.appendChild(opt);
                // 注册字体
                if (/^__idb__:/.test(fontEntry.src)) {
                    idb.get('ra_font_data_' + fontEntry.name).then(function(base64) {
                        if (base64) {
                            try {
                                var f = new FontFace(fontEntry.name, 'url(' + base64 + ')');
                                f.load().then(function(l) { document.fonts.add(l); }).catch(function(){});
                            } catch(e) {}
                        }
                    });
                } else if (fontEntry.src && !document.fonts.check('16px "' + fontEntry.name + '"')) {
                    try {
                        var fontSrc = fontEntry.src.startsWith('url(') ? fontEntry.src : 'url(' + fontEntry.src + ')';
                        var f = new FontFace(fontEntry.name, fontSrc);
                        f.load().then(function(l) { document.fonts.add(l); }).catch(function(){});
                    } catch(e) {}
                }
            })(fonts[j]);
        }
        if (s.fontFamily) select.value = s.fontFamily;
    }

    function highlightOption(containerId, activeVal) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var btns = container.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].getAttribute('data-val') === activeVal);
        }
    }

    function applySettings() {
        var s = getSettings();
        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var fsMap = { small:'14px', medium:'16px', large:'18px' };
        var lhMap = { compact:'1.5', normal:'1.8', loose:'2.2' };
        var pxMap = { narrow:'3%', medium:'6%', wide:'10%' };
        contentEl.style.fontSize = fsMap[s.fontSize || 'medium'] || '16px';
        contentEl.style.lineHeight = lhMap[s.lineHeight || 'normal'] || '1.8';
        contentEl.style.padding = '20px ' + (pxMap[s.paddingX || 'medium'] || '6%');
        if (s.textColor) contentEl.style.color = s.textColor;
        if (s.fontFamily) {
            var fMap = { sans:'-apple-system,"Helvetica Neue",Arial,sans-serif', songti:'"SimSun","STSong","Songti SC",serif', msyh:'"Microsoft YaHei","PingFang SC",sans-serif' };
            contentEl.style.fontFamily = fMap[s.fontFamily] || s.fontFamily;
        }
        if (s.paraSpacing) {
            var psMap = { compact:'8px', normal:'16px', loose:'28px' };
            var spacing = psMap[s.paraSpacing] || '16px';
            var ss = document.getElementById('ra-para-spacing-style');
            if (!ss) {
                ss = document.createElement('style');
                ss.id = 'ra-para-spacing-style';
                document.head.appendChild(ss);
            }
            ss.textContent = '#reading-content p { margin-bottom: ' + spacing + '; }';
        }
        // 背景色
        if (!s.nightMode && s.bgColor) {
            var body = document.getElementById('reading-body');
            var page = document.getElementById('reading-page');
            if (body) body.style.background = s.bgColor;
            if (page) page.style.background = s.bgColor;
        }
        // 翻页模式（flip 已废弃，降级为 smooth）
        if (s.pageMode && s.pageMode !== 'scroll') {
            if (s.pageMode === 'flip') { s.pageMode = 'smooth'; saveSettings(s); }
            setupPageMode(s.pageMode);
        }
        // 批注样式
        applyAnnotationStyles();
        // 加载自定义字体
        loadCustomFontsToSelect();
    }

    // ===== 书内搜索 (Step 21) =====
    var raSearchMatches = [];
    var raSearchCurrent = -1;

    window.openSearchBar = function() {
        hideReadingMenu();
        var bar = document.getElementById('reading-search-bar');
        if (bar) { bar.style.display = 'block'; }
        var input = document.getElementById('ra-search-input');
        if (input) { input.value = ''; input.focus(); }
        clearSearchHighlights();
    };

    window.closeSearchBar = function() {
        var bar = document.getElementById('reading-search-bar');
        if (bar) bar.style.display = 'none';
        clearSearchHighlights();
    };

    function clearSearchHighlights() {
        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var marks = contentEl.querySelectorAll('.ra-search-hl');
        for (var i = marks.length - 1; i >= 0; i--) {
            var parent = marks[i].parentNode;
            parent.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
            parent.normalize();
        }
        raSearchMatches = [];
        raSearchCurrent = -1;
    }

    window.onSearchInput = function() {
        clearSearchHighlights();
        var input = document.getElementById('ra-search-input');
        var keyword = input ? input.value.trim() : '';
        var countEl = document.getElementById('ra-search-count');
        if (!keyword) { if (countEl) countEl.textContent = '0处'; return; }

        var contentEl = document.getElementById('reading-content');
        if (!contentEl) return;
        var ps = contentEl.querySelectorAll('p');
        raSearchMatches = [];
        var re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            if (p.querySelector('.char-annotation, mark')) continue; // skip complex nodes
            var text = p.textContent;
            if (!re.test(text)) continue;
            re.lastIndex = 0;
            var html = p.innerHTML;
            var escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var hlRe = new RegExp('(' + escaped + ')', 'gi');
            p.innerHTML = html.replace(hlRe, '<span class="ra-search-hl" style="background:rgba(255,200,0,0.4);border-radius:2px;">$1</span>');
            var hls = p.querySelectorAll('.ra-search-hl');
            for (var j = 0; j < hls.length; j++) raSearchMatches.push(hls[j]);
        }
        if (countEl) countEl.textContent = raSearchMatches.length + '处';
        if (raSearchMatches.length > 0) { raSearchCurrent = 0; focusSearchMatch(); }
    };

    window.searchJump = function(dir) {
        if (raSearchMatches.length === 0) return;
        raSearchCurrent = (raSearchCurrent + dir + raSearchMatches.length) % raSearchMatches.length;
        focusSearchMatch();
    };

    function focusSearchMatch() {
        for (var i = 0; i < raSearchMatches.length; i++) {
            raSearchMatches[i].style.background = i === raSearchCurrent ? 'rgba(255,140,0,0.6)' : 'rgba(255,200,0,0.4)';
        }
        var body = document.getElementById('reading-body');
        if (body && raSearchMatches[raSearchCurrent]) {
            body.scrollTop = raSearchMatches[raSearchCurrent].offsetTop - 100;
        }
        var countEl = document.getElementById('ra-search-count');
        if (countEl) countEl.textContent = (raSearchCurrent + 1) + '/' + raSearchMatches.length;
    }

    // ===== 听书功能 (TTS) =====
    var raCurrentAudio = null;
    window.listenToParagraph = function() {
        closeParagraphMenu();
        if (!raPendingParagraph) return;
        var s = getSettings();
        if (!s.ttsEnabled) { alert('请先在设置中启用听书功能'); return; }
        var text = raPendingParagraph.textContent;
        var speed = s.ttsSpeed || 1;
        var source = s.ttsSource || 'system';

        if (raCurrentAudio) { raCurrentAudio.pause(); raCurrentAudio = null; }
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        if (source === 'system') {
            var utter = new SpeechSynthesisUtterance(text);
            utter.rate = speed;
            utter.lang = 'zh-CN';
            window.speechSynthesis.speak(utter);
        } else if (source === 'minimax') {
            var apiKey = s.ttsKey;
            var groupId = s.ttsGroupId;
            if (!apiKey || !groupId) { alert('请先填写 MiniMax API Key 和 Group ID'); return; }
            fetch('https://api.minimax.chat/v1/t2a_v2?GroupId=' + groupId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                body: JSON.stringify({ model: 'speech-01-turbo', text: text, speed: speed })
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.data && d.data.audio) {
                    raCurrentAudio = new Audio('data:audio/mp3;base64,' + d.data.audio);
                    raCurrentAudio.play();
                }
            }).catch(function(e) { alert('TTS 请求失败'); });
        } else if (source === 'custom') {
            var url = s.ttsUrl;
            if (!url) { alert('请先填写自定义 TTS 接口 URL'); return; }
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, speed: speed })
            }).then(function(r) { return r.blob(); }).then(function(blob) {
                raCurrentAudio = new Audio(URL.createObjectURL(blob));
                raCurrentAudio.play();
            }).catch(function(e) { alert('TTS 请求失败'); });
        }
    };

    // ========== 导出笔记 ==========
    window.exportNotesAsMarkdown = function() {
        if (raCurrentBook === null) return;
        var books = JSON.parse(localStorage.getItem('ra_books') || '[]');
        var book = books[raCurrentBook];
        if (!book) return;
        var bookTitle = book.title || '未知书名';
        var allNotes = JSON.parse(localStorage.getItem('ra_notes') || '[]');
        var allAnnotations = JSON.parse(localStorage.getItem('ra_annotations') || '[]');
        var myNotes = allNotes.filter(function(n) { return n.bookIndex === raCurrentBook; });
        var myAnns = allAnnotations.filter(function(a) { return a.bookIndex === raCurrentBook; });

        if (myNotes.length === 0 && myAnns.length === 0) {
            alert('当前书籍没有笔记或批注');
            return;
        }

        // Group by chapter
        var chapters = {};
        myNotes.forEach(function(n) {
            var ch = n.chapter || '未分章';
            if (!chapters[ch]) chapters[ch] = { notes: [], annotations: [] };
            chapters[ch].notes.push(n);
        });
        myAnns.forEach(function(a) {
            var ch = a.chapter || '未分章';
            if (!chapters[ch]) chapters[ch] = { notes: [], annotations: [] };
            chapters[ch].annotations.push(a);
        });

        var md = '# 《' + bookTitle + '》笔记\n\n';
        var chapterNames = Object.keys(chapters);
        chapterNames.forEach(function(chName) {
            var data = chapters[chName];
            md += '## ' + chName + '\n\n';
            // Notes
            if (data.notes.length > 0) {
                data.notes.forEach(function(n) {
                    if (n.selectedText) {
                        md += '> ' + n.selectedText.replace(/\n/g, '\n> ') + '\n\n';
                    }
                    if (n.note) {
                        md += n.note + '\n\n';
                    }
                    if (n.time) {
                        md += '*' + n.time + '*\n\n';
                    }
                    md += '---\n\n';
                });
            }
            // Annotations
            if (data.annotations.length > 0) {
                md += '### 角色批注\n\n';
                data.annotations.forEach(function(a) {
                    if (a.selectedText || a.paragraphText) {
                        var txt = a.selectedText || a.paragraphText || '';
                        md += '> ' + txt.replace(/\n/g, '\n> ') + '\n\n';
                    }
                    md += '**' + (a.charName || '未知角色') + '**：' + (a.content || '') + '\n\n';
                    if (a.replies && a.replies.length > 0) {
                        a.replies.forEach(function(r) {
                            md += '> 回复：' + r.content + '\n\n';
                        });
                    }
                    if (a.time) {
                        md += '*' + a.time + '*\n\n';
                    }
                    md += '---\n\n';
                });
            }
        });

        // Trigger download
        var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = bookTitle + '_笔记.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ========== 阅读统计 ==========
    window.openReadingStats = function() {
        var statsPage = document.getElementById('reading-stats-page');
        var bookshelfPage = document.getElementById('bookshelf-page');
        if (!statsPage) return;
        bookshelfPage.style.display = 'none';
        statsPage.style.display = 'flex';
        renderReadingStats();
    };

    window.closeReadingStats = function() {
        var statsPage = document.getElementById('reading-stats-page');
        var bookshelfPage = document.getElementById('bookshelf-page');
        if (statsPage) statsPage.style.display = 'none';
        if (bookshelfPage) bookshelfPage.style.display = 'flex';
    };

    function formatReadTime(ms) {
        if (!ms || ms <= 0) return '0分钟';
        var totalMin = Math.floor(ms / 60000);
        if (totalMin < 60) return totalMin + '分钟';
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        return h + '小时' + (m > 0 ? m + '分钟' : '');
    }

    function renderReadingStats() {
        var container = document.getElementById('reading-stats-content');
        if (!container) return;
        var books = JSON.parse(localStorage.getItem('ra_books') || '[]');
        var state = JSON.parse(localStorage.getItem('ra_readingState') || '{}');

        // Calculate totals
        var totalTime = 0;
        var booksRead = 0;
        var bookStats = [];
        books.forEach(function(b, i) {
            var bt = b.readingTime || 0;
            totalTime += bt;
            var prog = b.progress || 0;
            if (prog >= 100) booksRead++;
            bookStats.push({ title: b.title || '未知', progress: prog, time: bt, index: i });
        });

        // Weekly reading data (from per-day records stored in ra_dailyReading)
        var dailyData = JSON.parse(localStorage.getItem('ra_dailyReading') || '{}');
        var today = new Date();
        var weekDays = [];
        var weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
        var maxDayTime = 1; // avoid divide by zero
        for (var d = 6; d >= 0; d--) {
            var dt = new Date(today);
            dt.setDate(dt.getDate() - d);
            var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            var dayTime = dailyData[key] || 0;
            if (dayTime > maxDayTime) maxDayTime = dayTime;
            weekDays.push({ label: weekLabels[dt.getDay()], time: dayTime, key: key });
        }

        var html = '';
        // Summary cards
        html += '<div style="display:flex;gap:12px;margin-bottom:20px;">';
        html += '<div style="flex:1;background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
        html += '<div style="font-size:24px;font-weight:bold;color:#8B7355;">' + formatReadTime(totalTime) + '</div>';
        html += '<div style="font-size:12px;color:#999;margin-top:4px;">总阅读时长</div></div>';
        html += '<div style="flex:1;background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
        html += '<div style="font-size:24px;font-weight:bold;color:#8B7355;">' + booksRead + '</div>';
        html += '<div style="font-size:12px;color:#999;margin-top:4px;">已读完</div></div>';
        html += '<div style="flex:1;background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
        html += '<div style="font-size:24px;font-weight:bold;color:#8B7355;">' + books.length + '</div>';
        html += '<div style="font-size:12px;color:#999;margin-top:4px;">总书数</div></div>';
        html += '</div>';

        // Weekly chart
        html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
        html += '<div style="font-size:14px;font-weight:bold;margin-bottom:12px;color:#333;">本周阅读</div>';
        html += '<div style="display:flex;align-items:flex-end;justify-content:space-around;height:120px;gap:4px;">';
        weekDays.forEach(function(wd) {
            var pct = Math.max(4, (wd.time / maxDayTime) * 100);
            var barColor = wd.time > 0 ? '#8B7355' : '#E0D6C8';
            html += '<div style="display:flex;flex-direction:column;align-items:center;flex:1;">';
            html += '<div style="font-size:10px;color:#999;margin-bottom:4px;">' + (wd.time > 0 ? formatReadTime(wd.time) : '') + '</div>';
            html += '<div style="width:100%;max-width:28px;height:' + pct + '%;background:' + barColor + ';border-radius:4px 4px 0 0;min-height:4px;transition:height .3s;"></div>';
            html += '<div style="font-size:11px;color:#666;margin-top:6px;">' + wd.label + '</div>';
            html += '</div>';
        });
        html += '</div></div>';

        // Per-book progress
        html += '<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
        html += '<div style="font-size:14px;font-weight:bold;margin-bottom:12px;color:#333;">书籍进度</div>';
        if (bookStats.length === 0) {
            html += '<div style="color:#999;text-align:center;padding:20px;">暂无书籍</div>';
        }
        bookStats.forEach(function(bs) {
            html += '<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:13px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + bs.title + '</div>';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">';
            html += '<div style="flex:1;height:4px;background:#EDE8E0;border-radius:2px;overflow:hidden;">';
            html += '<div style="width:' + Math.min(100, bs.progress) + '%;height:100%;background:#8B7355;border-radius:2px;"></div></div>';
            html += '<span style="font-size:11px;color:#999;white-space:nowrap;">' + Math.round(bs.progress) + '%</span>';
            html += '</div></div>';
            html += '<div style="margin-left:12px;font-size:11px;color:#999;white-space:nowrap;">' + formatReadTime(bs.time) + '</div>';
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    // Record daily reading time
    function recordDailyReading(ms) {
        if (!ms || ms <= 0) return;
        var dailyData = JSON.parse(localStorage.getItem('ra_dailyReading') || '{}');
        var today = new Date();
        var key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        dailyData[key] = (dailyData[key] || 0) + ms;
        // Keep only last 30 days
        var keys = Object.keys(dailyData).sort();
        while (keys.length > 30) {
            delete dailyData[keys.shift()];
        }
        localStorage.setItem('ra_dailyReading', JSON.stringify(dailyData));
    }

    // Patch autoSaveReadingState to also record daily reading
    var _origAutoSave = window.autoSaveReadingState;
    window.autoSaveReadingState = function() {
        var prevTime = 0;
        if (raCurrentBook !== null) {
            var books = JSON.parse(localStorage.getItem('ra_books') || '[]');
            if (books[raCurrentBook]) prevTime = books[raCurrentBook].readingTime || 0;
        }
        if (_origAutoSave) _origAutoSave();
        if (raCurrentBook !== null) {
            var books2 = JSON.parse(localStorage.getItem('ra_books') || '[]');
            if (books2[raCurrentBook]) {
                var newTime = books2[raCurrentBook].readingTime || 0;
                var diff = newTime - prevTime;
                if (diff > 0) recordDailyReading(diff);
            }
        }
    };

})();
function openReadingApp() {
    document.getElementById('readingAppModal2').classList.add('active');
    readingRenderBookshelf();
}

function closeReadingApp() {
    document.getElementById('readingAppModal2').classList.remove('active');
}

function readingRenderBookshelf() {
    const grid = document.getElementById('reading-bookshelf-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!wcState.readingBooks || wcState.readingBooks.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #888; padding-top: 50px; font-size: 14px;">书架空空如也...</div>';
        return;
    }

    wcState.readingBooks.forEach(book => {
        const progress = book.progress || 0;
        const card = document.createElement('div');
        card.className = 'reading-book-card';
        card.style.cssText = 'display: flex; flex-direction: column; gap: 8px; cursor: pointer;';
        card.onclick = () => readingOpenBook(book.id);
        
        // 长按添加笔记
        let pressTimer;
        let isLongPress = false;
        
        const startPress = (e) => {
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                // 震动反馈 (如果支持)
                if (navigator.vibrate) navigator.vibrate(50);
                // 暂时用 alert 替代，后续可实现 readingOpenAddNoteModal
                alert(`为《${book.title}》添加笔记功能开发中...`);
            }, 800);
        };
        
        const endPress = (e) => {
            clearTimeout(pressTimer);
        };

        card.onmousedown = startPress;
        card.ontouchstart = startPress;
        card.onmouseup = endPress;
        card.onmouseleave = endPress;
        card.ontouchend = endPress;
        
        // 只有不是长按时才触发点击进入阅读页
        card.onclick = (e) => {
            if (!isLongPress) {
                readingOpenBook(book.id);
            }
        };

        card.innerHTML = `
            <div style="width: 100%; aspect-ratio: 3/4; background: #F4F4F5; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; border: 1px solid rgba(0,0,0,0.05);">
                ${book.cover ? `<img src="${book.cover}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #A1A1A6; font-size: 13px; font-weight: 500;">暂无封面</div>`}
            </div>
            <div style="font-size: 15px; font-weight: 600; color: #1C1C1E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;">${book.title}</div>
            <div style="font-size: 12px; color: #8E8E93; font-weight: 400;">已读 ${progress.toFixed(1)}%</div>
        `;
        grid.appendChild(card);
    });
}

let readingCurrentBookId = null;
let readingCurrentChapterIndex = 0;
let readingStartTime = 0;
let readingTimer = null;

function readingOpenBook(bookId) {
    const book = wcState.readingBooks.find(b => b.id === bookId);
    if (!book) return;

    readingCurrentBookId = bookId;
    readingCurrentChapterIndex = book.currentChapter || 0;

    document.getElementById('reading-view-bookshelf').style.display = 'none';
    document.getElementById('reading-view-reader').style.display = 'flex';

    document.getElementById('reading-current-book-title').innerText = book.title;

    const char = wcState.characters.find(c => c.id === wcState.activeChatId);
    if (char) {
        document.getElementById('reading-char-avatar-img').src = char.avatar;
        document.getElementById('reading-char-avatar-img').style.display = 'block';
    }

    readingRenderChapter();

    // 开始计时
    readingStartTime = Date.now();
    if (readingTimer) clearInterval(readingTimer);
    readingTimer = setInterval(readingUpdateStats, 60000); // 每分钟更新一次
    readingUpdateStats();

    // 全屏沉浸阅读（隐藏系统状态栏）
    const el = document.documentElement;
    if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    }
}

function closeReadingPage() {
    if (readingTimer) clearInterval(readingTimer);

    // 退出全屏
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen();
    }

    // 保存进度
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (book) {
        book.currentChapter = readingCurrentChapterIndex;
        const contentArea = document.getElementById('reading-content-area');
        if (contentArea.scrollHeight > 0) {
            const scrollProgress = contentArea.scrollTop / (contentArea.scrollHeight - contentArea.clientHeight);
            book.progress = (readingCurrentChapterIndex + scrollProgress) / book.chapters.length * 100;
        }
        wcSaveData();
    }

    document.getElementById('reading-view-reader').style.display = 'none';
    document.getElementById('reading-view-bookshelf').style.display = 'flex';
    readingRenderBookshelf();
}

function readingRenderChapter() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book || !book.chapters || book.chapters.length === 0) return;

    const chapter = book.chapters[readingCurrentChapterIndex];
    const contentArea = document.getElementById('reading-content-area');

    contentArea.innerHTML = `
        <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 30px; color: #111;">${chapter.title}</h2>
        <div style="white-space: pre-wrap;">${chapter.content}</div>
    `;

    contentArea.scrollTop = 0;

    // 更新进度条
    const slider = document.getElementById('reading-progress-slider');
    if (slider) {
        slider.value = (readingCurrentChapterIndex / Math.max(1, book.chapters.length - 1)) * 100;
    }
    
    document.getElementById('reading-progress-text').innerText = ((readingCurrentChapterIndex / Math.max(1, book.chapters.length - 1)) * 100).toFixed(2) + '%';
}

function toggleReaderMenu(e) {
    if (e) e.stopPropagation();
    const topBar = document.getElementById('reading-menu-top');
    const bottomMenu = document.getElementById('reading-menu-bottom');
    const overlay = document.getElementById('reading-menu-overlay');
    const header = document.getElementById('reading-reader-header');
    const footer = document.getElementById('reading-reader-footer');

    if (overlay.style.display === 'block') {
        topBar.style.transform = 'translateY(-100%)';
        bottomMenu.style.transform = 'translateY(100%)';
        setTimeout(() => {
            overlay.style.display = 'none';
            header.style.opacity = '0';
            footer.style.opacity = '0';
        }, 300);
    } else {
        overlay.style.display = 'block';
        header.style.opacity = '0';
        footer.style.opacity = '0';
        // 强制重绘
        void topBar.offsetWidth;
        topBar.style.transform = 'translateY(0%)';
        bottomMenu.style.transform = 'translateY(0%)';
        readingUpdateStats();
    }
}

function readingUpdateStats() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book) return;

    // 时长
    const minutes = Math.floor((Date.now() - readingStartTime) / 60000) + (book.readTime || 0);
    document.getElementById('reading-stat-time').innerText = minutes;

    // 进度
    const contentArea = document.getElementById('reading-content-area');
    let scrollProgress = 0;
    if (contentArea.scrollHeight > contentArea.clientHeight) {
        scrollProgress = contentArea.scrollTop / (contentArea.scrollHeight - contentArea.clientHeight);
    }
    const totalProgress = ((readingCurrentChapterIndex + scrollProgress) / Math.max(1, book.chapters.length)) * 100;
    document.getElementById('reading-stat-progress').innerText = totalProgress.toFixed(2) + '%';

    // 速度 (估算)
    const words = book.chapters[readingCurrentChapterIndex]?.content.length || 0;
    const speed = minutes > 0 ? Math.floor(words / Math.max(1, minutes)) : 0;
    document.getElementById('reading-stat-speed').innerText = speed;

    // 笔记数
    const notesCount = book.notes ? book.notes.length : 0;
    document.getElementById('reading-stat-notes').innerText = notesCount;
    
    // 更新底部时间
    const now = new Date();
    document.getElementById('reading-battery-time').innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

function readingPrevChapter() {
    if (readingCurrentChapterIndex > 0) {
        readingCurrentChapterIndex--;
        readingRenderChapter();
    }
}

function readingNextChapter() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (book && readingCurrentChapterIndex < book.chapters.length - 1) {
        readingCurrentChapterIndex++;
        readingRenderChapter();
    }
}

function readingSeekProgress(val) {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book) return;

    const targetIndex = Math.floor((val / 100) * (book.chapters.length - 1));
    if (targetIndex !== readingCurrentChapterIndex) {
        readingCurrentChapterIndex = targetIndex;
        readingRenderChapter();
    }
}

function openReadingToc() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book) return;

    const list = document.getElementById('reading-toc-list');
    list.innerHTML = '';

    book.chapters.forEach((ch, idx) => {
        const item = document.createElement('div');
        item.style.cssText = `padding: 15px 20px; border-bottom: 1px solid #F0F0F0; font-size: 15px; color: ${idx === readingCurrentChapterIndex ? '#111' : '#666'}; font-weight: ${idx === readingCurrentChapterIndex ? '600' : '400'}; cursor: pointer;`;
        item.innerText = ch.title;
        item.onclick = () => {
            readingCurrentChapterIndex = idx;
            readingRenderChapter();
            closeReadingToc();
            toggleReaderMenu();
        };
        list.appendChild(item);
    });

    document.getElementById('reading-toc-overlay').style.display = 'block';
    setTimeout(() => {
        document.getElementById('reading-toc-overlay').style.opacity = '1';
        document.getElementById('reading-toc-sidebar').style.transform = 'translateX(0)';
    }, 10);
}

function closeReadingToc() {
    document.getElementById('reading-toc-sidebar').style.transform = 'translateX(-100%)';
    document.getElementById('reading-toc-overlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('reading-toc-overlay').style.display = 'none';
    }, 300);
}

function openReadingNotes() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book) return;

    const list = document.getElementById('reading-notes-list');
    list.innerHTML = '';

    if (!book.notes || book.notes.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #888; padding-top: 30px; font-size: 14px;">暂无笔记</div>';
    } else {
        book.notes.forEach(note => {
            const item = document.createElement('div');
            item.style.cssText = 'background: #FFF; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); cursor: pointer;';
            item.onclick = () => {
                readingCurrentChapterIndex = note.chapterIndex || 0;
                readingRenderChapter();
                closeReadingNotes();
                toggleReaderMenu();
            };
            item.innerHTML = `
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">${note.chapterTitle}</div>
                <div style="font-size: 14px; color: #333; line-height: 1.5;">${note.content}</div>
                <div style="font-size: 11px; color: #AAA; margin-top: 8px; text-align: right;">${new Date(note.time).toLocaleString()}</div>
            `;
            list.appendChild(item);
        });
    }

    document.getElementById('reading-notes-view').style.transform = 'translateY(0)';
}

function closeReadingNotes() {
    document.getElementById('reading-notes-view').style.transform = 'translateY(100%)';
}

function addReadingNote() {
    const book = wcState.readingBooks.find(b => b.id === readingCurrentBookId);
    if (!book) return;

    const chapterTitle = book.chapters[readingCurrentChapterIndex || 0]?.title || '未知章节';
    
    const content = prompt(`添加笔记 (${chapterTitle}):`);
    if (!content) return;

    if (!book.notes) book.notes = [];

    book.notes.push({
        id: Date.now(),
        chapterIndex: readingCurrentChapterIndex || 0,
        chapterTitle: chapterTitle,
        content: content,
        time: Date.now()
    });

    wcSaveData();
    alert('笔记已保存');
}

let readingIsNightMode = false;
function toggleReadingNightMode() {
    readingIsNightMode = !readingIsNightMode;
    const readerView = document.getElementById('reading-view-reader');
    const contentArea = document.getElementById('reading-content-area');
    const topBar = document.getElementById('reading-menu-top');
    const bottomMenu = document.getElementById('reading-menu-bottom');
    const nightIcon = document.getElementById('reading-night-icon');
    const nightText = document.getElementById('reading-night-text');

    if (readingIsNightMode) {
        readerView.style.background = '#1A1A1A';
        contentArea.style.color = '#A0A0A0';
        topBar.style.background = 'rgba(26, 26, 26, 0.95)';
        bottomMenu.style.background = 'rgba(26, 26, 26, 0.95)';
        topBar.style.color = '#A0A0A0';
        bottomMenu.style.color = '#A0A0A0';
        document.getElementById('reading-current-book-title').style.color = '#A0A0A0';

        // Update stats text color
        ['reading-stat-time', 'reading-stat-progress', 'reading-stat-speed', 'reading-stat-notes'].forEach(id => {
            document.getElementById(id).style.color = '#A0A0A0';
        });

        // Update SVG strokes
        const svgs = bottomMenu.querySelectorAll('svg');
        svgs.forEach(svg => svg.style.stroke = '#A0A0A0');
        topBar.querySelectorAll('svg').forEach(svg => svg.style.stroke = '#A0A0A0');

        nightIcon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>';
        nightText.innerText = '日间';
    } else {
        readerView.style.background = '#F4F1EA';
        contentArea.style.color = '#333';
        topBar.style.background = 'rgba(255, 255, 255, 0.95)';
        bottomMenu.style.background = 'rgba(255, 255, 255, 0.95)';
        topBar.style.color = '#111';
        bottomMenu.style.color = '#111';
        document.getElementById('reading-current-book-title').style.color = '#888';

        // Update stats text color
        ['reading-stat-time', 'reading-stat-progress', 'reading-stat-speed', 'reading-stat-notes'].forEach(id => {
            document.getElementById(id).style.color = '#111';
        });

        // Update SVG strokes
        const svgs = bottomMenu.querySelectorAll('svg');
        svgs.forEach(svg => svg.style.stroke = 'currentColor');
        topBar.querySelectorAll('svg').forEach(svg => svg.style.stroke = 'currentColor');

        nightIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        nightText.innerText = '夜间';
    }
}

function openReadingSettings() {
    wcOpenModal('reading-settings-modal');
}

function changeReadingFontSize(delta) {
    const contentArea = document.getElementById('reading-content-area');
    let currentSize = parseInt(window.getComputedStyle(contentArea).fontSize);
    let newSize = currentSize + delta;
    if (newSize >= 12 && newSize <= 30) {
        contentArea.style.fontSize = newSize + 'px';
        document.getElementById('reading-font-size-display').innerText = newSize;
    }
}

function changeReadingBg(bgColor, textColor) {
    const readerView = document.getElementById('reading-view-reader');
    const contentArea = document.getElementById('reading-content-area');
    
    readerView.style.background = bgColor;
    contentArea.style.color = textColor;
    
    // 如果切换了背景，自动关闭夜间模式
    if (readingIsNightMode && bgColor !== '#1A1A1A') {
        toggleReadingNightMode();
    } else if (!readingIsNightMode && bgColor === '#1A1A1A') {
        toggleReadingNightMode();
    }
}

function importLocalBook(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        alert('文件过大，请选择 100MB 以内的文件！\n（当前文件：' + (file.size / 1024 / 1024).toFixed(1) + 'MB）');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const title = file.name.replace('.txt', '');
        
        // 简单的按章节分割 (假设以 "第x章" 开头)
        const chapters = [];
        const lines = content.split('\n');
        let currentChapter = { title: '前言', content: '' };
        
        const chapterRegex = /^第[一二三四五六七八九十百千万0-9]+[章回节卷]/;
        
        lines.forEach(line => {
            if (chapterRegex.test(line.trim())) {
                if (currentChapter.content.trim()) {
                    chapters.push(currentChapter);
                }
                currentChapter = { title: line.trim(), content: '' };
            } else {
                currentChapter.content += line + '\n';
            }
        });
        
        if (currentChapter.content.trim()) {
            chapters.push(currentChapter);
        }

        if (!wcState.readingBooks) wcState.readingBooks = [];
        
        wcState.readingBooks.push({
            id: 'book_' + Date.now(),
            title: title,
            cover: '',
            chapters: chapters,
            currentChapter: 0,
            progress: 0,
            readTime: 0,
            notes: []
        });
        
        wcSaveData();
        readingRenderBookshelf();
        alert('导入成功！');
    };
    reader.readAsText(file);
}
