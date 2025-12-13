// GitHub Configuration (original ToDoApp settings)
// This will be adapted later to point to the ToThread backend instead of GitHub.

const CONFIG = {
    // Your GitHub username and repository
    REPO_OWNER: 'Straightly',
    REPO_NAME: 'attention',
    
    // Branch to commit to
    BRANCH: 'main',
    
    // The single JSON file to manage
    TODO_FILE: 'ToDos/List.json',
    
    // API base URL (will be changed later for ToThread backend)
    API_BASE: 'https://api.github.com',
    
    // LocalStorage key for token
    TOKEN_STORAGE_KEY: 'github_token_attention'
};
