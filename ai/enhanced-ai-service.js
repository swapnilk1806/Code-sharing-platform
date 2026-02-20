const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

class EnhancedAIService {
  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.genAI = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
    this.cache = new Map(); // Simple in-memory cache
    this.requestQueue = [];
    this.isProcessing = false;
  }

  // Enhanced AI call with caching and rate limiting
  async callAI(prompt, options = {}) {
    try {
      if (!this.genAI) {
        throw new Error('AI service not initialized - missing API key');
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(prompt, options);
      if (this.cache.has(cacheKey)) {
        console.log('📋 Returning cached response');
        return this.cache.get(cacheKey);
      }

      // Add to queue for rate limiting
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ prompt, options, resolve, reject });
        this.processQueue();
      });

    } catch (error) {
      console.error('Enhanced AI Service Error:', error.message);
      return {
        success: false,
        error: error.message,
        cached: false
      };
    }
  }

  // Process request queue with rate limiting
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const { prompt, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.makeAIRequest(prompt, options);
        
        // Cache successful responses
        if (result.success && options.cache !== false) {
          const cacheKey = this.generateCacheKey(prompt, options);
          this.cache.set(cacheKey, result);
          
          // Limit cache size
          if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }
        
        resolve(result);
        
        // Rate limiting delay
        await this.delay(1000); // 1 second between requests
        
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessing = false;
  }

  // Make actual AI request
  async makeAIRequest(prompt, options = {}) {
    try {
      const response = await this.genAI.models.generateContent({
        model: options.model || 'gemini-2.0-flash',
        contents: prompt,
        generationConfig: {
          temperature: options.temperature || 0.3,
          maxOutputTokens: options.maxTokens || 2048,
          topP: options.topP || 0.8,
          topK: options.topK || 40,
        },
      });

      return {
        success: true,
        response: response.text,
        model: options.model || 'gemini-2.0-flash',
        cached: false,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI Request Error:', error.message);
      return {
        success: false,
        error: error.message,
        cached: false
      };
    }
  }

  // Generate cache key
  generateCacheKey(prompt, options) {
    const keyData = {
      prompt: prompt.substring(0, 200), // First 200 chars
      model: options.model || 'gemini-2.0-flash',
      temperature: options.temperature || 0.3
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  // Simple delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🧹 AI cache cleared');
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Batch processing for multiple requests
  async batchProcess(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await this.callAI(request.prompt, request.options);
        results.push({
          id: request.id,
          success: result.success,
          response: result.response,
          error: result.error
        });
      } catch (error) {
        results.push({
          id: request.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Stream response for long content
  async* streamResponse(prompt, options = {}) {
    try {
      if (!this.genAI) {
        throw new Error('AI service not initialized');
      }

      const response = await this.genAI.models.generateContentStream({
        model: options.model || 'gemini-2.0-flash',
        contents: prompt,
        generationConfig: {
          temperature: options.temperature || 0.3,
          maxOutputTokens: options.maxTokens || 4096,
        },
      });

      for await (const chunk of response.stream) {
        if (chunk.text()) {
          yield {
            content: chunk.text(),
            done: false
          };
        }
      }
      
      yield { content: '', done: true };

    } catch (error) {
      yield {
        content: `Error: ${error.message}`,
        done: true,
        error: true
      };
    }
  }

  // Health check
  async healthCheck() {
    try {
      const testPrompt = "Respond with 'OK' if you can read this.";
      const result = await this.callAI(testPrompt, { cache: false });
      
      return {
        status: result.success ? 'healthy' : 'unhealthy',
        apiKey: !!this.apiKey,
        cacheSize: this.cache.size,
        queueLength: this.requestQueue.length,
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

module.exports = EnhancedAIService;
