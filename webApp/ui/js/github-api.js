// GitHub API Helper (copied from ToDoApp)
class GitHubAPI {
    constructor(config) {
        this.config = config;
        this.baseUrl = `${config.API_BASE}/repos/${config.REPO_OWNER}/${config.REPO_NAME}`;
        this.filePath = config.TODO_FILE;
    }

    async request(endpoint, options = {}) {
        const token = TokenManager.get();
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, { ...options, headers });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `GitHub API error: ${response.status}`);
        }
        
        return response.json();
    }

    async getFile() {
        const data = await this.request(`/contents/${this.filePath}?ref=${this.config.BRANCH}`);
        // Decode base64 and handle UTF-8 properly
        const content = decodeURIComponent(escape(atob(data.content)));
        return { content, sha: data.sha };
    }

    async updateFile(content, message, sha) {
        const encodedContent = btoa(unescape(encodeURIComponent(content))); // Encode to base64
        return await this.request(`/contents/${this.filePath}`, {
            method: 'PUT',
            body: JSON.stringify({
                message,
                content: encodedContent,
                sha,
                branch: this.config.BRANCH
            })
        });
    }

    async testConnection() {
        try {
            await this.request('');
            return true;
        } catch (error) {
            throw new Error(`Connection failed: ${error.message}`);
        }
    }
}
