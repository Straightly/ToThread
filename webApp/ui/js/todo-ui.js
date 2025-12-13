// UI Controller (copied from ToDoApp)
class TodoUI {
    constructor(manager, writingManager) {
        this.manager = manager;
        this.writingManager = writingManager;
        this.showCompleted = false;
        this.selectedTags = new Set(); // Track active tag filters
        this.setupElements();
        this.attachEventListeners();
        // Auth (Google ID token) is handled outside via ToThreadAuth in app.js.
        // At this point we assume we're already authenticated and can show the app.
        this.showApp();
        this.loadFile();
    }

    setupElements() {
        this.setupSection = document.getElementById('setup-section');
        this.appSection = document.getElementById('app-section');
        this.refreshFileBtn = document.getElementById('refresh-file');
        this.todoList = document.getElementById('todo-list');
        this.newTodoInput = document.getElementById('new-todo');
        this.addTodoBtn = document.getElementById('add-todo-btn');
        this.saveChangesBtn = document.getElementById('save-changes');
        this.changesIndicator = document.getElementById('changes-indicator');
        this.status = document.getElementById('status');
        this.rawWritingText = document.getElementById('raw-writing-text');
        this.saveWritingBtn = document.getElementById('save-writing-btn');
        this.writingStatus = document.getElementById('writing-status');
        this.showCompletedToggle = document.getElementById('show-completed-toggle');
        this.tagFilters = document.getElementById('tag-filters');
    }

    attachEventListeners() {
        this.refreshFileBtn.addEventListener('click', () => this.loadFile());
        this.addTodoBtn.addEventListener('click', () => this.addTodo());
        this.newTodoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
        this.saveChangesBtn.addEventListener('click', () => this.saveChanges());
        this.saveWritingBtn.addEventListener('click', () => this.saveRawWriting());
        this.showCompletedToggle.addEventListener('change', () => this.toggleShowCompleted());
    }

    showApp() {
        this.setupSection.style.display = 'none';
        this.appSection.style.display = 'block';
    }

    async loadFile() {
        this.showStatus('Loading...', 'info');
        this.refreshFileBtn.disabled = true;
        
        try {
            await this.manager.loadFile();
            this.renderTodos();
            this.showStatus(`✅ Loaded: ToDos/List.json`, 'success');
        } catch (error) {
            this.showStatus(`❌ ${error.message}`, 'error');
        } finally {
            this.refreshFileBtn.disabled = false;
        }
    }

    toggleShowCompleted() {
        this.showCompleted = this.showCompletedToggle.checked;
        this.renderTodos();
    }

    toggleTagFilter(tag) {
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
        } else {
            this.selectedTags.add(tag);
        }
        this.renderTodos();
        this.renderTagFilters();
    }

    renderTagFilters() {
        const allTags = this.manager.getAllTags();
        
        if (allTags.length === 0) {
            this.tagFilters.innerHTML = '<p class="no-tags">No tags yet. Add hashtags to your todos like #work #idea</p>';
            return;
        }

        this.tagFilters.innerHTML = '<div class="tag-filters-label">Filter by tags:</div>';
        const container = document.createElement('div');
        container.className = 'tag-filter-buttons';

        allTags.forEach(tag => {
            const button = document.createElement('button');
            button.className = `tag-filter ${this.selectedTags.has(tag) ? 'active' : ''}`;
            button.textContent = `#${tag}`;
            button.addEventListener('click', () => this.toggleTagFilter(tag));
            container.appendChild(button);
        });

        this.tagFilters.appendChild(container);
    }

    renderTodos() {
        this.todoList.innerHTML = '';
        
        let displayTodos = this.showCompleted 
            ? this.manager.todos 
            : this.manager.todos.filter(todo => !todo.completed);
        
        if (this.selectedTags.size > 0) {
            displayTodos = displayTodos.filter(todo => {
                if (!todo.tags || todo.tags.length === 0) return false;
                return todo.tags.some(tag => this.selectedTags.has(tag));
            });
        }
        
        if (displayTodos.length === 0) {
            const message = this.selectedTags.size > 0
                ? 'No todos match the selected tags.'
                : this.showCompleted 
                    ? 'No todos found. Add one below!' 
                    : 'No active todos. Add one below!';
            this.todoList.innerHTML = `<p style="text-align: center; color: #6c757d; padding: 40px;">${message}</p>`;
            this.renderTagFilters();
            return;
        }
        
        displayTodos.forEach((todo) => {
            const item = document.createElement('div');
            item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            item.dataset.todoId = todo.id;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => this.toggleTodo(todo.id));
            
            const textContainer = document.createElement('div');
            textContainer.className = 'todo-text-container';
            
            if (todo.tags && todo.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'todo-tags';
                todo.tags.forEach(tag => {
                    const tagChip = document.createElement('span');
                    tagChip.className = 'tag-chip';
                    tagChip.textContent = `#${tag}`;
                    tagsContainer.appendChild(tagChip);
                });
                textContainer.appendChild(tagsContainer);
            }
            
            const label = document.createElement('label');
            label.textContent = todo.text;
            label.className = 'todo-label';
            label.addEventListener('dblclick', () => this.startEditing(todo.id, label, textContainer));
            
            textContainer.appendChild(label);
            
            item.appendChild(checkbox);
            item.appendChild(textContainer);
            this.todoList.appendChild(item);
        });
        
        this.renderTagFilters();
        this.updateChangesIndicator();
    }

    toggleTodo(id) {
        this.manager.toggleTodo(id);
        this.renderTodos();
    }

    addTodo() {
        const text = this.newTodoInput.value.trim();
        if (!text) return;
        
        const selectedTagsArray = Array.from(this.selectedTags);
        this.manager.addTodo(text, selectedTagsArray);
        this.newTodoInput.value = '';
        this.renderTodos();
        this.showStatus('✅ Todo added (not saved yet)', 'info');
    }

    startEditing(id, label, container) {
        const currentText = label.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo-edit-input';
        input.value = currentText;
        
        container.innerHTML = '';
        container.appendChild(input);
        input.focus();
        input.select();
        
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                this.manager.updateTodo(id, newText);
                this.showStatus('✅ Todo updated (not saved yet)', 'info');
            }
            this.renderTodos();
        };
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.renderTodos();
            }
        });
        
        input.addEventListener('blur', saveEdit);
    }

    updateChangesIndicator() {
        if (this.manager.hasChanges) {
            this.changesIndicator.textContent = '⚠️ Unsaved changes';
            this.saveChangesBtn.disabled = false;
        } else {
            this.changesIndicator.textContent = '✅ All changes saved';
            this.saveChangesBtn.disabled = true;
        }
    }

    async saveChanges() {
        this.saveChangesBtn.disabled = true;
        this.saveChangesBtn.textContent = '💾 Saving...';
        
        try {
            const timestamp = new Date().toLocaleString();
            await this.manager.saveChanges(`Update todos via web app - ${timestamp}`);
            this.showStatus('✅ Changes saved and committed to GitHub!', 'success');
            this.renderTodos();
        } catch (error) {
            this.showStatus(`❌ ${error.message}`, 'error');
            this.saveChangesBtn.disabled = false;
        } finally {
            this.saveChangesBtn.textContent = '💾 Save & Commit to GitHub';
        }
    }

    showStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                this.status.textContent = '';
                this.status.className = 'status';
            }, 3000);
        }
    }

    showWritingStatus(message, type) {
        this.writingStatus.textContent = message;
        this.writingStatus.className = `status ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                this.writingStatus.textContent = '';
                this.writingStatus.className = 'status';
            }, 5000);
        }
    }

    async saveRawWriting() {
        const content = this.rawWritingText.value.trim();
        
        if (!content) {
            this.showWritingStatus('❌ Please enter some content', 'error');
            return;
        }

        if (this.manager.hasChanges) {
            try {
                const timestamp = new Date().toLocaleString();
                await this.manager.saveChanges(`Auto-save todos before capturing raw writing - ${timestamp}`);
                this.renderTodos();
            } catch (error) {
                this.showWritingStatus(`⚠️ Warning: Could not save todos: ${error.message}`, 'error');
            }
        }

        this.saveWritingBtn.disabled = true;
        this.saveWritingBtn.textContent = '💾 Saving...';
        this.showWritingStatus('Saving raw writing...', 'info');

        try {
            const timestamp = new Date().toLocaleString();
            const result = await this.writingManager.saveWriting(
                content,
                `Add raw writing via web app - ${timestamp}`
            );

            this.showWritingStatus(
                `✅ Saved as ${result.fileName} and committed to GitHub!`,
                'success'
            );
            this.rawWritingText.value = '';
        } catch (error) {
            this.showWritingStatus(`❌ ${error.message}`, 'error');
        } finally {
            this.saveWritingBtn.disabled = false;
            this.saveWritingBtn.textContent = '💾 Save Raw Writing';
        }
    }
}
