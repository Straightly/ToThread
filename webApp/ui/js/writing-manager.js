// Writing Manager for Raw Writings (copied from ToDoApp)
class WritingManager {
    constructor(api) {
        this.api = api;
        this.templatePath = 'Writing/RawWrittings/_TEMPLATE.md';
        this.writingsFolder = 'Writing/RawWrittings';
    }

    generateFileName(content) {
        const words = content
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 5)
            .map(word => word.replace(/[^a-zA-Z0-9]/g, ''))
            .filter(word => word.length > 0)
            .join('');
        const baseName = words.substring(0, 40);
        const timestamp = new Date().getTime();
        return `${baseName}_${timestamp}.md`;
    }

    getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    extractTags(content) {
        const keywords = ['time', 'art', 'philosophy', 'security', 'ai', 'agent', 'writing', 'idea'];
        const contentLower = content.toLowerCase();
        const foundTags = keywords.filter(keyword => contentLower.includes(keyword));
        if (foundTags.length === 0) {
            return '#idea #raw-thought';
        }
        return foundTags.map(tag => `#${tag}`).join(' ');
    }

    generateTitle(content) {
        const firstSentence = content.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 60) {
            return firstSentence.substring(0, 57) + '...';
        }
        return firstSentence;
    }

    fillTemplate(content) {
        const title = this.generateTitle(content);
        const date = this.getCurrentDate();
        const tags = this.extractTags(content);
        
        return `---
title: ${title}
date: ${date}
tags: ${tags}
context: Captured via web app
status: raw-idea
---

## Initial Spark

${content.trim()}

## Key Concepts

- [To be filled in later]

## Questions to Explore

- [To be filled in later]

## Potential Connections

- [To be filled in later]

## Next Steps

- Review and expand this raw idea
- Add key concepts and questions
- Connect to related writings
`;
    }

    async saveWriting(content, commitMessage) {
        try {
            const fileName = this.generateFileName(content);
            const filePath = `${this.writingsFolder}/${fileName}`;
            const filledContent = this.fillTemplate(content);
            const encodedContent = btoa(unescape(encodeURIComponent(filledContent)));
            const response = await this.api.request(`/contents/${filePath}`, {
                method: 'PUT',
                body: JSON.stringify({
                    message: commitMessage,
                    content: encodedContent,
                    branch: this.api.config.BRANCH
                })
            });
            return {
                success: true,
                fileName: fileName,
                path: filePath,
                response: response
            };
        } catch (error) {
            throw new Error(`Failed to save writing: ${error.message}`);
        }
    }
}
