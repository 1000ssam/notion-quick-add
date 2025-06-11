// Application State
const AppState = {
    apiToken: localStorage.getItem('notion-api-token') || '',
    databases: JSON.parse(localStorage.getItem('notion-databases') || '[]'),
    shortcuts: JSON.parse(localStorage.getItem('notion-shortcuts') || '[]'),
    currentScreen: 'setup',
    currentShortcut: null
};

// Notion API Helper with local proxy
class NotionAPI {
    constructor(token) {
        this.token = token;
        // 로컬 프록시 서버 사용 (CORS 완전 해결!)
        this.baseURL = window.location.origin + '/api/notion';
        this.headers = {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.headers,
                    ...options.headers
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async searchDatabases() {
        return this.request('/search', {
            method: 'POST',
            body: JSON.stringify({
                filter: {
                    value: 'database',
                    property: 'object'
                }
            })
        });
    }

    async getDatabase(databaseId) {
        return this.request(`/databases/${databaseId}`);
    }

    async createPage(databaseId, properties, children = []) {
        return this.request('/pages', {
            method: 'POST',
            body: JSON.stringify({
                parent: {
                    database_id: databaseId
                },
                properties,
                children
            })
        });
    }
}

// Utility Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
    AppState.currentScreen = screenId;
}

function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

function showLoading(show = true) {
    const loadingEl = document.getElementById('loading');
    if (show) {
        loadingEl.classList.remove('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

function saveToStorage() {
    localStorage.setItem('notion-api-token', AppState.apiToken);
    localStorage.setItem('notion-databases', JSON.stringify(AppState.databases));
    localStorage.setItem('notion-shortcuts', JSON.stringify(AppState.shortcuts));
}

// 📅 상대적 날짜 계산 함수 추가
function getRelativeDate(type) {
    const date = new Date();
    switch (type) {
        case 'today':
            return date.toISOString().split('T')[0];
        case 'tomorrow':
            date.setDate(date.getDate() + 1);
            return date.toISOString().split('T')[0];
        case 'day-after-tomorrow':
            date.setDate(date.getDate() + 2);
            return date.toISOString().split('T')[0];
        case 'next-week':
            date.setDate(date.getDate() + 7);
            return date.toISOString().split('T')[0];
        case 'next-month':
            date.setMonth(date.getMonth() + 1);
            return date.toISOString().split('T')[0];
        default:
            return date.toISOString().split('T')[0];
    }
}

// Property Type Helpers - 개선된 날짜 입력
function createPropertyInput(propName, propConfig, defaultValue = null) {
    const { type } = propConfig;
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = propName;
    label.setAttribute('for', `prop-${propName}`);
    formGroup.appendChild(label);

    let input;

    switch (type) {
        case 'title':
        case 'rich_text':
            input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue || '';
            break;

        case 'number':
            input = document.createElement('input');
            input.type = 'number';
            input.value = defaultValue || '';
            break;

        case 'select':
            input = document.createElement('select');
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '선택하세요';
            input.appendChild(defaultOption);
            
            if (propConfig.select && propConfig.select.options) {
                propConfig.select.options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option.name;
                    optionEl.textContent = option.name;
                    if (defaultValue === option.name) {
                        optionEl.selected = true;
                    }
                    input.appendChild(optionEl);
                });
            }
            break;

        case 'multi_select':
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '쉼표로 구분하여 입력 (예: 태그1, 태그2)';
            input.value = Array.isArray(defaultValue) ? defaultValue.join(', ') : (defaultValue || '');
            break;

        case 'date':
            const dateContainer = document.createElement('div');
            dateContainer.className = 'date-container';
            
            input = document.createElement('input');
            input.type = 'date';
            
            // 🔥 개선된 기본값 처리
            if (defaultValue) {
                if (['today', 'tomorrow', 'day-after-tomorrow', 'next-week', 'next-month'].includes(defaultValue)) {
                    input.value = getRelativeDate(defaultValue);
                } else {
                    input.value = defaultValue;
                }
            }
            
            dateContainer.appendChild(input);
            
            // 🎯 더 많은 상대적 날짜 버튼 추가
            const quickButtons = document.createElement('div');
            quickButtons.className = 'date-quick-buttons';
            quickButtons.style.cssText = `
                display: flex;
                gap: 0.5rem;
                margin-top: 0.5rem;
                flex-wrap: wrap;
            `;
            
            const dateOptions = [
                { text: '오늘', type: 'today' },
                { text: '내일', type: 'tomorrow' },
                { text: '모레', type: 'day-after-tomorrow' },
                { text: '1주일 후', type: 'next-week' },
                { text: '1달 후', type: 'next-month' }
            ];
            
            dateOptions.forEach(option => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'date-quick-btn';
                btn.textContent = option.text;
                btn.style.cssText = `
                    padding: 0.25rem 0.5rem;
                    font-size: 0.8rem;
                    border: 1px solid #ddd;
                    background: #f8f9fa;
                    border-radius: 4px;
                    cursor: pointer;
                    color: #495057;
                `;
                
                // 🔧 iOS 호환성을 위한 이벤트 리스너 개선
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = getRelativeDate(option.type);
                });
                
                // hover 효과
                btn.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#e9ecef';
                });
                btn.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = '#f8f9fa';
                });
                
                quickButtons.appendChild(btn);
            });
            
            dateContainer.appendChild(quickButtons);
            formGroup.appendChild(dateContainer);
            return formGroup;

        case 'checkbox':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = defaultValue === true;
            break;

        case 'url':
            input = document.createElement('input');
            input.type = 'url';
            input.value = defaultValue || '';
            break;

        case 'email':
            input = document.createElement('input');
            input.type = 'email';
            input.value = defaultValue || '';
            break;

        case 'phone_number':
            input = document.createElement('input');
            input.type = 'tel';
            input.value = defaultValue || '';
            break;

        default:
            input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue || '';
            break;
    }

    input.id = `prop-${propName}`;
    input.name = propName;
    formGroup.appendChild(input);

    return formGroup;
}

function getPropertyValue(propName, propConfig, formData) {
    const { type } = propConfig;
    const value = formData.get ? formData.get(propName) : formData[propName];

    if (!value && type !== 'checkbox') return null;

    switch (type) {
        case 'title':
            return {
                title: [{
                    text: {
                        content: value
                    }
                }]
            };

        case 'rich_text':
            return {
                rich_text: [{
                    text: {
                        content: value
                    }
                }]
            };

        case 'number':
            return {
                number: parseFloat(value) || null
            };

        case 'select':
            return value ? {
                select: {
                    name: value
                }
            } : null;

        case 'multi_select':
            const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
            return tags.length > 0 ? {
                multi_select: tags.map(tag => ({ name: tag }))
            } : null;

        case 'date':
            return value ? {
                date: {
                    start: value
                }
            } : null;

        case 'checkbox':
            return {
                checkbox: formData.hasOwnProperty ? formData.hasOwnProperty(propName) : formData.has(propName)
            };

        case 'url':
            return value ? {
                url: value
            } : null;

        case 'email':
            return value ? {
                email: value
            } : null;

        case 'phone_number':
            return value ? {
                phone_number: value
            } : null;

        default:
            return value ? {
                rich_text: [{
                    text: {
                        content: value
                    }
                }]
            } : null;
    }
}

// Event Handlers
async function handleTokenVerification() {
    const tokenInput = document.getElementById('api-token');
    const token = tokenInput.value.trim();

    if (!token) {
        showError('API 토큰을 입력해주세요.');
        return;
    }

    if (!token.startsWith('secret_') && !token.startsWith('ntn_')) {
        showError('올바른 Notion API 토큰 형식이 아닙니다. secret_ 또는 ntn_으로 시작해야 합니다.');
        return;
    }

    hideError();
    showLoading(true);

    try {
        const api = new NotionAPI(token);
        
        console.log('Testing token...');
        await api.request('/users/me');
        console.log('Token is valid, searching for databases...');
        
        const result = await api.searchDatabases();
        
        AppState.apiToken = token;
        AppState.databases = result.results;
        saveToStorage();
        
        showLoading(false);
        renderDatabaseList();
        showScreen('database-screen');
    } catch (error) {
        showLoading(false);
        console.error('Token verification error:', error);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showError('토큰이 유효하지 않습니다. Notion에서 새로 생성한 Integration 토큰인지 확인해주세요.');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
            showError('토큰 권한이 부족합니다. Integration이 워크스페이스에 연결되어 있는지 확인해주세요.');
        } else {
            showError(`토큰 확인 실패: ${error.message}`);
        }
    }
}

function renderDatabaseList() {
    const listEl = document.getElementById('database-list');
    listEl.innerHTML = '';

    if (AppState.databases.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <h3>데이터베이스를 찾을 수 없습니다</h3>
                <p>Integration을 데이터베이스에 연결했는지 확인해주세요.</p>
                <p><strong>확인 방법:</strong></p>
                <ol style="text-align: left; margin-top: 1rem;">
                    <li>Notion에서 데이터베이스 페이지 열기</li>
                    <li>페이지 우상단 ⋯ 클릭</li>
                    <li>"연결 추가" 선택</li>
                    <li>생성한 Integration 선택</li>
                </ol>
            </div>
        `;
        return;
    }

    AppState.databases.forEach(db => {
        const item = document.createElement('div');
        item.className = 'database-item';
        item.innerHTML = `
            <h3>${db.title?.[0]?.text?.content || '제목 없음'}</h3>
            <p>속성 ${Object.keys(db.properties || {}).length}개</p>
        `;
        item.onclick = () => selectDatabase(db);
        listEl.appendChild(item);
    });
}

async function selectDatabase(database) {
    try {
        showLoading(true);
        const api = new NotionAPI(AppState.apiToken);
        const dbDetails = await api.getDatabase(database.id);
        
        showLoading(false);
        renderShortcutConfig(dbDetails);
        showScreen('shortcut-screen');
    } catch (error) {
        showLoading(false);
        showError(`데이터베이스 정보 로드 실패: ${error.message}`);
    }
}

function renderShortcutConfig(database) {
    const configEl = document.getElementById('shortcut-config');
    const properties = database.properties;
    
    configEl.innerHTML = `
        <form id="shortcut-form">
            <div class="form-group">
                <label for="shortcut-name">단축어 이름</label>
                <input type="text" id="shortcut-name" placeholder="예: 일기 쓰기" required>
            </div>
            
            <div class="form-group">
                <label>포함할 속성들</label>
                <div id="properties-list"></div>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="include-content"> 페이지 본문 입력 포함
                </label>
            </div>
            
            <!-- 🔧 iOS 호환성을 위한 버튼 타입 명시 -->
            <button type="button" id="create-shortcut-btn" class="btn-primary">단축어 생성</button>
        </form>
    `;
    
    const propertiesList = document.getElementById('properties-list');
    
    Object.entries(properties).forEach(([propName, propConfig]) => {
        const div = document.createElement('div');
        div.className = 'property-item';
        div.innerHTML = `
            <label>
                <input type="checkbox" name="property" value="${propName}" data-type="${propConfig.type}">
                ${propName} (${propConfig.type})
            </label>
            <div class="property-default" style="display: none;">
                <label for="default-${propName}">기본값:</label>
                <div id="default-input-${propName}"></div>
            </div>
        `;
        
        const checkbox = div.querySelector('input[type="checkbox"]');
        const defaultDiv = div.querySelector('.property-default');
        const defaultContainer = div.querySelector(`#default-input-${propName}`);
        
        // 🔧 iOS 호환성을 위한 이벤트 리스너 개선
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                defaultDiv.style.display = 'block';
                const defaultInput = createPropertyInput(`default-${propName}`, propConfig);
                defaultContainer.innerHTML = '';
                
                // 🎯 날짜 타입의 경우 기본값 선택 드롭다운 추가
                if (propConfig.type === 'date') {
                    const selectWrapper = document.createElement('div');
                    selectWrapper.style.marginBottom = '0.5rem';
                    
                    const select = document.createElement('select');
                    select.style.cssText = 'width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;';
                    
                    const options = [
                        { value: '', text: '직접 입력' },
                        { value: 'today', text: '오늘' },
                        { value: 'tomorrow', text: '내일' },
                        { value: 'day-after-tomorrow', text: '모레' },
                        { value: 'next-week', text: '1주일 후' },
                        { value: 'next-month', text: '1달 후' }
                    ];
                    
                    options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.text;
                        select.appendChild(option);
                    });
                    
                    const dateInput = defaultInput.querySelector('input[type="date"]');
                    
                    select.addEventListener('change', function() {
                        if (this.value) {
                            dateInput.value = getRelativeDate(this.value);
                        }
                    });
                    
                    selectWrapper.appendChild(select);
                    defaultContainer.appendChild(selectWrapper);
                }
                
                const inputElement = defaultInput.querySelector('input, select, textarea');
                if (inputElement) {
                    defaultContainer.appendChild(inputElement.parentNode || inputElement);
                }
            } else {
                defaultDiv.style.display = 'none';
            }
        });
        
        propertiesList.appendChild(div);
    });
    
    // 🔧 iOS Safari 전용 이벤트 핸들링
    const createBtn = document.getElementById('create-shortcut-btn');
    
    // 여러 이벤트 방식 동시 적용 (iOS Safari 호환성 극대화)
    function handleCreateShortcut(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🔥 버튼 클릭됨!'); // 디버그 로그
        
        // 폼 데이터 직접 수집 (FormData 대신)
        const shortcutName = document.getElementById('shortcut-name').value.trim();
        const checkboxes = document.querySelectorAll('input[name="property"]:checked');
        const selectedProperties = Array.from(checkboxes).map(cb => cb.value);
        const includeContent = document.getElementById('include-content').checked;
        
        console.log('📝 수집된 데이터:', { shortcutName, selectedProperties, includeContent });
        
        if (!shortcutName || selectedProperties.length === 0) {
            alert('단축어 이름과 최소 하나의 속성을 선택해주세요.');
            return;
        }
        
        createShortcutDirectly(database, shortcutName, selectedProperties, includeContent);
    }
    
    // iOS Safari 호환성을 위한 다중 이벤트 등록
    createBtn.addEventListener('click', handleCreateShortcut);
    createBtn.addEventListener('touchend', handleCreateShortcut);
    
    // 추가: Enter 키 지원
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement.closest('#shortcut-form')) {
            e.preventDefault();
            handleCreateShortcut(e);
        }
    });
}

// 🔧 단순화된 단축어 생성 함수
function createShortcutDirectly(database, shortcutName, selectedProperties, includeContent) {
    console.log('🚀 createShortcutDirectly 호출됨');
    
    try {
        const shortcut = {
            id: Date.now().toString(),
            name: shortcutName,
            databaseId: database.id,
            databaseName: database.title?.[0]?.text?.content || '제목 없음',
            properties: {},
            includeContent,
            icon: '📝',
            color: '#667eea'
        };
        
        selectedProperties.forEach(propName => {
            const propConfig = database.properties[propName];
            const defaultInput = document.querySelector(`#default-input-${propName} input, #default-input-${propName} select`);
            
            shortcut.properties[propName] = {
                type: propConfig.type,
                config: propConfig,
                defaultValue: defaultInput ? defaultInput.value : null
            };
        });
        
        AppState.shortcuts.push(shortcut);
        saveToStorage();
        
        console.log('✅ 단축어 저장 완료:', shortcut);
        
        // 🎉 성공 메시지 표시
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        successMsg.textContent = '✅ 단축어가 생성되었습니다!';
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            if (document.body.contains(successMsg)) {
                document.body.removeChild(successMsg);
            }
            renderShortcutsList();
            showScreen('main-screen');
        }, 1500);
        
    } catch (error) {
        console.error('❌ 단축어 생성 실패:', error);
        alert(`단축어 생성 실패: ${error.message}`);
    }
}

function renderShortcutsList() {
    const listEl = document.getElementById('shortcuts-list');
    listEl.innerHTML = '';

    if (AppState.shortcuts.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <h3>아직 단축어가 없습니다</h3>
                <p>첫 번째 단축어를 만들어보세요!</p>
            </div>
        `;
        return;
    }

    AppState.shortcuts.forEach(shortcut => {
        const item = document.createElement('div');
        item.className = 'shortcut-item';
        item.style.setProperty('--shortcut-color', shortcut.color);
        item.innerHTML = `
            <div class="shortcut-icon" style="background-color: ${shortcut.color}">
                ${shortcut.icon}
            </div>
            <div class="shortcut-info">
                <h3>${shortcut.name}</h3>
                <p>${shortcut.databaseName} • ${Object.keys(shortcut.properties).length}개 속성</p>
            </div>
        `;
        item.onclick = () => openShortcut(shortcut);
        listEl.appendChild(item);
    });
}

function openShortcut(shortcut) {
    AppState.currentShortcut = shortcut;
    renderDataForm(shortcut);
    showScreen('form-screen');
}

function renderDataForm(shortcut) {
    const titleEl = document.getElementById('form-title');
    const formEl = document.getElementById('data-form');
    
    titleEl.textContent = shortcut.name;
    formEl.innerHTML = '';
    
    // Add property inputs
    Object.entries(shortcut.properties).forEach(([propName, propInfo]) => {
        const inputGroup = createPropertyInput(propName, propInfo.config, propInfo.defaultValue);
        formEl.appendChild(inputGroup);
    });
    
    // Add content input if enabled
    if (shortcut.includeContent) {
        const contentGroup = document.createElement('div');
        contentGroup.className = 'form-group';
        contentGroup.innerHTML = `
            <label for="page-content">페이지 콘텐츠</label>
            <textarea id="page-content" name="page-content" placeholder="페이지 내용을 입력하세요..."></textarea>
        `;
        formEl.appendChild(contentGroup);
    }
    
    // Add submit button - iOS 호환성 개선
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button'; // submit 대신 button 사용
    submitBtn.id = 'submit-data-btn';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = '노션에 추가';
    formEl.appendChild(submitBtn);
    
    // 🔧 iOS 호환성을 위한 이벤트 핸들링
    function handleDataSubmit(e) {
        e.preventDefault();
        e.stopPropagation();
        handleFormSubmitDirectly(shortcut);
    }
    
    submitBtn.addEventListener('click', handleDataSubmit);
    submitBtn.addEventListener('touchend', handleDataSubmit);
}

async function handleFormSubmitDirectly(shortcut) {
    showLoading(true);
    hideError();
    
    try {
        const api = new NotionAPI(AppState.apiToken);
        
        // 직접 데이터 수집 (FormData 대신)
        const formData = {};
        
        Object.keys(shortcut.properties).forEach(propName => {
            const input = document.querySelector(`#prop-${propName}`);
            if (input) {
                if (input.type === 'checkbox') {
                    formData[propName] = input.checked;
                } else {
                    formData[propName] = input.value;
                }
            }
        });
        
        if (shortcut.includeContent) {
            const contentInput = document.getElementById('page-content');
            if (contentInput) {
                formData['page-content'] = contentInput.value;
            }
        }
        
        // Build properties object
        const properties = {};
        Object.entries(shortcut.properties).forEach(([propName, propInfo]) => {
            const value = getPropertyValue(propName, propInfo.config, formData);
            if (value) {
                properties[propName] = value;
            }
        });
        
        // Build children (page content)
        const children = [];
        if (shortcut.includeContent && formData['page-content']) {
            children.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{
                        type: 'text',
                        text: {
                            content: formData['page-content']
                        }
                    }]
                }
            });
        }
        
        // Create page
        const result = await api.createPage(shortcut.databaseId, properties, children);
        
        showLoading(false);
        
        // Show success message and go back
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = `
            <div style="background: rgba(72, 187, 120, 0.9); color: white; padding: 1rem; border-radius: 8px; text-align: center; margin-bottom: 1rem;">
                ✅ 노션에 성공적으로 추가되었습니다!
            </div>
        `;
        formEl.insertBefore(successMsg, formEl.firstChild);
        
        setTimeout(() => {
            showScreen('main-screen');
        }, 1500);
        
    } catch (error) {
        showLoading(false);
        showError(`페이지 생성 실패: ${error.message}`);
    }
}

// Settings Functions
function renderSettings() {
    const tokenDisplay = document.getElementById('token-display');
    if (AppState.apiToken) {
        tokenDisplay.textContent = '●●●●●●●●' + AppState.apiToken.slice(-4);
    }
}

function handleChangeToken() {
    if (confirm('토큰을 변경하면 모든 데이터가 초기화됩니다. 계속하시겠습니까?')) {
        localStorage.clear();
        AppState.apiToken = '';
        AppState.databases = [];
        AppState.shortcuts = [];
        showScreen('setup-screen');
    }
}

function handleClearShortcuts() {
    if (confirm('모든 단축어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        AppState.shortcuts = [];
        saveToStorage();
        renderShortcutsList();
        showScreen('main-screen');
    }
}

function handleClearAllData() {
    if (confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        localStorage.clear();
        AppState.apiToken = '';
        AppState.databases = [];
        AppState.shortcuts = [];
        showScreen('setup-screen');
    }
}

// Initialize App
function initApp() {
    // Check if we have a saved token
    if (AppState.apiToken) {
        if (AppState.shortcuts.length > 0) {
            renderShortcutsList();
            showScreen('main-screen');
        } else if (AppState.databases.length > 0) {
            renderDatabaseList();
            showScreen('database-screen');
        } else {
            // Token exists but no databases, try to fetch them
            handleTokenVerification();
        }
    } else {
        showScreen('setup-screen');
    }
    
    // 🔧 iOS 호환성을 위한 이벤트 리스너 개선
    document.getElementById('verify-token').addEventListener('click', handleTokenVerification);
    document.getElementById('back-btn').addEventListener('click', () => showScreen('main-screen'));
    document.getElementById('config-back-btn').addEventListener('click', () => showScreen('database-screen'));
    document.getElementById('add-shortcut').addEventListener('click', () => {
        renderDatabaseList();
        showScreen('database-screen');
    });
    
    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => {
        renderSettings();
        showScreen('settings-screen');
    });
    document.getElementById('settings-back-btn').addEventListener('click', () => showScreen('main-screen'));
    document.getElementById('change-token').addEventListener('click', handleChangeToken);
    document.getElementById('clear-shortcuts').addEventListener('click', handleClearShortcuts);
    document.getElementById('clear-all-data').addEventListener('click', handleClearAllData);
    
    // Handle URL parameters for shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    const shortcutId = urlParams.get('shortcut');
    const action = urlParams.get('action');
    
    if (shortcutId) {
        const shortcut = AppState.shortcuts.find(s => s.id === shortcutId);
        if (shortcut) {
            openShortcut(shortcut);
        }
    } else if (action === 'new-shortcut') {
        if (AppState.apiToken) {
            renderDatabaseList();
            showScreen('database-screen');
        }
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
