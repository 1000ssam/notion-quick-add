// Application State
const AppState = {
    apiToken: localStorage.getItem('notion-api-token') || '',
    databases: JSON.parse(localStorage.getItem('notion-databases') || '[]'),
    shortcuts: JSON.parse(localStorage.getItem('notion-shortcuts') || '[]'),
    currentScreen: 'setup',
    currentShortcut: null
};

// Notion API Helper
class NotionAPI {
    constructor(token) {
        this.token = token;
        this.baseURL = 'https://api.notion.com/v1';
        this.headers = {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
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

// Property Type Helpers
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
            
            propConfig.select.options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.name;
                optionEl.textContent = option.name;
                if (defaultValue === option.name) {
                    optionEl.selected = true;
                }
                input.appendChild(optionEl);
            });
            break;

        case 'multi_select':
            // For simplicity, we'll use a text input with comma-separated values
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '쉼표로 구분하여 입력 (예: 태그1, 태그2)';
            input.value = Array.isArray(defaultValue) ? defaultValue.join(', ') : (defaultValue || '');
            break;

        case 'date':
            const dateContainer = document.createElement('div');
            input = document.createElement('input');
            input.type = 'date';
            
            if (defaultValue) {
                if (defaultValue === 'today') {
                    input.value = new Date().toISOString().split('T')[0];
                } else if (defaultValue === 'tomorrow') {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    input.value = tomorrow.toISOString().split('T')[0];
                } else if (defaultValue === 'day-after-tomorrow') {
                    const dayAfter = new Date();
                    dayAfter.setDate(dayAfter.getDate() + 2);
                    input.value = dayAfter.toISOString().split('T')[0];
                } else {
                    input.value = defaultValue;
                }
            }
            
            dateContainer.appendChild(input);
            
            const quickButtons = document.createElement('div');
            quickButtons.className = 'date-quick-buttons';
            
            ['오늘', '내일', '모레'].forEach((text, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'date-quick-btn';
                btn.textContent = text;
                btn.onclick = () => {
                    const date = new Date();
                    date.setDate(date.getDate() + index);
                    input.value = date.toISOString().split('T')[0];
                };
                quickButtons.appendChild(btn);
            });
            
            dateContainer.appendChild(quickButtons);
            formGroup.appendChild(dateContainer);
            formGroup.appendChild(document.createElement('br'));
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
    const value = formData.get(propName);

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
                checkbox: formData.has(propName)
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

    hideError();
    showLoading(true);

    try {
        const api = new NotionAPI(token);
        const result = await api.searchDatabases();
        
        AppState.apiToken = token;
        AppState.databases = result.results;
        saveToStorage();
        
        showLoading(false);
        renderDatabaseList();
        showScreen('database-screen');
    } catch (error) {
        showLoading(false);
        showError(`토큰 확인 실패: ${error.message}`);
    }
}

function renderDatabaseList() {
    const listEl = document.getElementById('database-list');
    listEl.innerHTML = '';

    AppState.databases.forEach(db => {
        const item = document.createElement('div');
        item.className = 'database-item';
        item.innerHTML = `
            <h3>${db.title?.[0]?.text?.content || '제목 없음'}</h3>
            <p>ID: ${db.id}</p>
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
                <label>페이지 콘텐츠</label>
                <label>
                    <input type="checkbox" id="include-content"> 페이지 본문 입력 포함
                </label>
            </div>
            
            <button type="submit" class="btn-primary">단축어 생성</button>
        </form>
    `;
    
    const propertiesList = document.getElementById('properties-list');
    
    Object.entries(properties).forEach(([propName, propConfig]) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label>
                <input type="checkbox" name="property" value="${propName}" data-type="${propConfig.type}">
                ${propName} (${propConfig.type})
            </label>
            <div class="property-default" style="margin-left: 20px; display: none;">
                <label for="default-${propName}">기본값:</label>
                <div id="default-input-${propName}"></div>
            </div>
        `;
        
        const checkbox = div.querySelector('input[type="checkbox"]');
        const defaultDiv = div.querySelector('.property-default');
        const defaultContainer = div.querySelector(`#default-input-${propName}`);
        
        checkbox.onchange = () => {
            if (checkbox.checked) {
                defaultDiv.style.display = 'block';
                const defaultInput = createPropertyInput(`default-${propName}`, propConfig);
                defaultContainer.innerHTML = '';
                defaultContainer.appendChild(defaultInput.querySelector('input, select, textarea'));
            } else {
                defaultDiv.style.display = 'none';
            }
        };
        
        propertiesList.appendChild(div);
    });
    
    document.getElementById('shortcut-form').onsubmit = (e) => {
        e.preventDefault();
        createShortcut(database);
    };
}

function createShortcut(database) {
    const form = document.getElementById('shortcut-form');
    const formData = new FormData(form);
    
    const shortcutName = formData.get('shortcut-name');
    const selectedProperties = formData.getAll('property');
    const includeContent = formData.has('include-content');
    
    if (!shortcutName || selectedProperties.length === 0) {
        showError('단축어 이름과 최소 하나의 속성을 선택해주세요.');
        return;
    }
    
    const shortcut = {
        id: Date.now().toString(),
        name: shortcutName,
        databaseId: database.id,
        databaseName: database.title?.[0]?.text?.content || '제목 없음',
        properties: {},
        includeContent,
        icon: '📝',
        color: '#3182ce'
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
    
    renderShortcutsList();
    showScreen('main-screen');
}

function renderShortcutsList() {
    const listEl = document.getElementById('shortcuts-list');
    listEl.innerHTML = '';

    AppState.shortcuts.forEach(shortcut => {
        const item = document.createElement('div');
        item.className = 'shortcut-item';
        item.innerHTML = `
            <div class="shortcut-icon" style="background-color: ${shortcut.color}">
                ${shortcut.icon}
            </div>
            <div class="shortcut-info">
                <h3>${shortcut.name}</h3>
                <p>${shortcut.databaseName}</p>
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
    
    // Add submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = '노션에 추가';
    formEl.appendChild(submitBtn);
    
    formEl.onsubmit = (e) => {
        e.preventDefault();
        handleFormSubmit(shortcut);
    };
}

async function handleFormSubmit(shortcut) {
    const formEl = document.getElementById('data-form');
    const formData = new FormData(formEl);
    
    showLoading(true);
    hideError();
    
    try {
        const api = new NotionAPI(AppState.apiToken);
        
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
        if (shortcut.includeContent) {
            const content = formData.get('page-content');
            if (content) {
                children.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{
                            type: 'text',
                            text: {
                                content: content
                            }
                        }]
                    }
                });
            }
        }
        
        // Create page
        const result = await api.createPage(shortcut.databaseId, properties, children);
        
        showLoading(false);
        
        // Show success message and go back
        alert('노션에 성공적으로 추가되었습니다!');
        showScreen('main-screen');
        
    } catch (error) {
        showLoading(false);
        showError(`페이지 생성 실패: ${error.message}`);
    }
}

// Initialize App
function initApp() {
    // Check if we have a saved token
    if (AppState.apiToken) {
        if (AppState.shortcuts.length > 0) {
            renderShortcutsList();
            showScreen('main-screen');
        } else {
            renderDatabaseList();
            showScreen('database-screen');
        }
    } else {
        showScreen('setup-screen');
    }
    
    // Set up event listeners
    document.getElementById('verify-token').onclick = handleTokenVerification;
    document.getElementById('back-btn').onclick = () => showScreen('main-screen');
    document.getElementById('add-shortcut').onclick = () => {
        renderDatabaseList();
        showScreen('database-screen');
    };
    
    // Handle URL parameters for shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    const shortcutId = urlParams.get('shortcut');
    if (shortcutId) {
        const shortcut = AppState.shortcuts.find(s => s.id === shortcutId);
        if (shortcut) {
            openShortcut(shortcut);
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