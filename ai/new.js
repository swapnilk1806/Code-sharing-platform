const EnhancedAIService = require('./enhanced-ai-service');
const PromptManager = require('../prompts');

class NewAIService {
  constructor() {
    this.enhancedAI = new EnhancedAIService();
    this.promptManager = new PromptManager();
    this.analytics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0
    };
  }

  // Initialize the service
  async initialize() {
    try {
      const healthCheck = await this.enhancedAI.healthCheck();
      if (healthCheck.status === 'healthy') {
        console.log('✅ New AI Service initialized successfully');
        return true;
      } else {
        console.error('❌ AI Service health check failed:', healthCheck);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error.message);
      return false;
    }
  }

  // Enhanced code analysis with analytics
  async analyzeCode(code, analysisType = 'general', options = {}) {
    const startTime = Date.now();
    this.analytics.totalRequests++;

    try {
      const prompt = this.promptManager.analyzeCode(code, analysisType);
      const result = await this.enhancedAI.callAI(prompt, options);

      if (result.success) {
        this.analytics.successfulRequests++;
        if (result.cached) {
          this.analytics.cacheHits++;
        }
      } else {
        this.analytics.failedRequests++;
      }

      // Update average response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return {
        ...result,
        analysisType,
        responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.analytics.failedRequests++;
      throw error;
    }
  }

  // Batch code analysis for multiple files
  async batchAnalyze(codes, analysisType = 'general') {
    const requests = codes.map((code, index) => ({
      id: `analysis_${index}`,
      prompt: this.promptManager.analyzeCode(code, analysisType),
      options: { cache: false }
    }));

    return await this.enhancedAI.batchProcess(requests);
  }

  // Real-time code analysis with streaming
  async* streamAnalyzeCode(code, analysisType = 'general') {
    const prompt = this.promptManager.analyzeCode(code, analysisType);
    
    try {
      for await (const chunk of this.enhancedAI.streamResponse(prompt)) {
        yield {
          ...chunk,
          analysisType,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      yield {
        content: `Analysis error: ${error.message}`,
        done: true,
        error: true,
        analysisType
      };
    }
  }

  // Smart code suggestions
  async getCodeSuggestions(code, context = '') {
    const prompt = `Based on this code:
${code}

And this context: ${context}

Provide 3 specific suggestions to improve the code, focusing on:
1. Performance
2. Readability  
3. Best practices

Format as a numbered list with brief explanations.`;

    const result = await this.enhancedAI.callAI(prompt);
    return result;
  }

  // Code completion suggestions
  async getCodeCompletion(prefix, language = 'javascript') {
    const prompt = `Complete this ${language} code snippet:
\`\`\`${language}
${prefix}
\`\`\`

Provide only the completion code without explanations.`;

    const result = await this.enhancedAI.callAI(prompt, {
      temperature: 0.2,
      maxTokens: 500
    });
    
    return result;
  }

  // Code quality scoring
  async scoreCodeQuality(code) {
    const prompt = `Analyze this code and provide a quality score from 1-10 for each category:
1. **Readability**: How easy is the code to understand?
2. **Performance**: How efficient is the code?
3. **Security**: How secure is the code?
4. **Maintainability**: How easy is the code to maintain?
5. **Best Practices**: How well does it follow standards?

Code:
${code}

Respond with JSON format:
{
  "readability": score,
  "performance": score,
  "security": score,
  "maintainability": score,
  "bestPractices": score,
  "overall": score,
  "feedback": "brief summary"
}`;

    const result = await this.enhancedAI.callAI(prompt);
    return result;
  }

  // Learning mode - educational explanations
  async explainForLearning(code, skillLevel = 'intermediate', focusAreas = []) {
    const focusPrompt = focusAreas.length > 0 
      ? `Focus on these areas: ${focusAreas.join(', ')}`
      : '';

    const prompt = this.promptManager.getPrompt('learning', 'explain', {
      code,
      detail_level: skillLevel
    }) + `\n\n${focusPrompt}`;

    const result = await this.enhancedAI.callAI(prompt);
    return result;
  }

  // Code comparison
  async compareCode(code1, code2, description = '') {
    const prompt = `Compare these two code snippets:
${description ? `Context: ${description}\n` : ''}

Code 1:
\`\`\`javascript
${code1}
\`\`\`

Code 2:
\`\`\`javascript
${code2}
\`\`\`

Provide a detailed comparison covering:
1. **Performance differences**
2. **Readability comparison**
3. **Security implications**
4. **Maintainability aspects**
5. **Best practices adherence**
6. **Recommendation**: Which approach is better and why`;

    const result = await this.enhancedAI.callAI(prompt);
    return result;
  }

  // Get service analytics
  getAnalytics() {
    const cacheStats = this.enhancedAI.getCacheStats();
    
    return {
      ...this.analytics,
      cacheStats,
      successRate: this.analytics.totalRequests > 0 
        ? (this.analytics.successfulRequests / this.analytics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheHitRate: this.analytics.totalRequests > 0
        ? (this.analytics.cacheHits / this.analytics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // Reset analytics
  resetAnalytics() {
    this.analytics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0
    };
    console.log('📊 Analytics reset');
  }

  // Update average response time
  updateAverageResponseTime(newTime) {
    const total = this.analytics.totalRequests;
    const current = this.analytics.averageResponseTime;
    this.analytics.averageResponseTime = ((current * (total - 1)) + newTime) / total;
  }

  // Health check with analytics
  async getHealthStatus() {
    const health = await this.enhancedAI.healthCheck();
    const analytics = this.getAnalytics();
    
    return {
      ...health,
      analytics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      version: '2.0.0'
    };
  }

  // Cleanup resources
  async cleanup() {
    this.enhancedAI.clearCache();
    console.log('🧹 New AI Service cleaned up');
  }
}

module.exports = NewAIService;
