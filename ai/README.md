# 🤖 New AI Service Folder

Complete AI service architecture for CodeMeet with enhanced capabilities and analytics.

## 📁 **AI Folder Structure:**

```
ai/
├── ai-controller.js          # REST API endpoints for AI services
├── ai-routes.js             # Express router for AI endpoints
├── enhanced-ai-service.js   # Enhanced AI with caching & rate limiting
└── new.js                   # Main AI service with analytics
```

## 🚀 **AI Services Available:**

### **📊 Analysis Types:**
- `general` - Overall code quality assessment
- `security` - Security vulnerability detection
- `performance` - Performance optimization opportunities
- `refactor` - Refactoring suggestions

### **🔍 Review Levels:**
- `junior` - Educational feedback for beginners
- `senior` - Technical deep-dive analysis
- `pr` - Pull request evaluation

### **📚 Learning Features:**
- `explain` - Code explanations at different levels
- `optimize` - Performance improvements
- `refactor` - Clean code demonstrations

## 🌐 **API Endpoints:**

### **POST /ai/analyze**
```json
{
  "code": "function example() { return true; }",
  "analysisType": "security"
}
```

### **POST /ai/generate**
```json
{
  "language": "javascript",
  "requirements": "Create a sorting function",
  "codeType": "function"
}
```

### **POST /ai/review**
```json
{
  "code": "function example() { return true; }",
  "reviewLevel": "senior"
}
```

### **POST /ai/debug**
```json
{
  "code": "function example() { return true; }",
  "error": "TypeError: Cannot read property",
  "context": "Called with undefined parameter"
}
```

### **POST /ai/explain**
```json
{
  "code": "function example() { return true; }",
  "detailLevel": "beginner"
}
```

### **GET /ai/services**
Returns available AI services and options.

## ⚡ **Enhanced Features:**

### **📋 Caching System:**
- In-memory cache for repeated requests
- Cache size limit (100 entries)
- Cache key generation based on prompt and options

### **⏱️ Rate Limiting:**
- Request queue system
- 1-second delay between requests
- Prevents API overload

### **📈 Analytics:**
- Request tracking
- Success/failure rates
- Cache hit statistics
- Average response times
- Health monitoring

### **🔄 Batch Processing:**
- Multiple code analysis in parallel
- Efficient resource usage
- Batch result aggregation

### **📡 Streaming Support:**
- Real-time response streaming
- Progress updates for long analyses
- Error handling during streams

## 🛠️ **Usage Examples:**

### **Basic Analysis:**
```javascript
const NewAIService = require('./ai/new');
const ai = new NewAIService();

await ai.initialize();
const result = await ai.analyzeCode(code, 'security');
```

### **Batch Analysis:**
```javascript
const codes = [code1, code2, code3];
const results = await ai.batchAnalyze(codes, 'performance');
```

### **Streaming Analysis:**
```javascript
for await (const chunk of ai.streamAnalyzeCode(code, 'general')) {
  console.log('Analysis chunk:', chunk.content);
  if (chunk.done) break;
}
```

### **Code Quality Scoring:**
```javascript
const score = await ai.scoreCodeQuality(code);
console.log('Overall quality:', score.overall);
```

### **Smart Suggestions:**
```javascript
const suggestions = await ai.getCodeSuggestions(code, 'focus on performance');
```

## 🔧 **Integration with App:**

Update your main app to use new AI service:

```javascript
const aiRoutes = require('./ai/ai-routes');
app.use('/ai', aiRoutes);
```

## 📊 **Health Monitoring:**

```javascript
const health = await ai.getHealthStatus();
console.log('AI Service Status:', health);
```

## 🎯 **Benefits:**

1. **🚀 Performance**: Caching and rate limiting
2. **📈 Analytics**: Detailed usage metrics
3. **🔄 Reliability**: Error handling and retries
4. **⚡ Scalability**: Batch processing support
5. **📡 Real-time**: Streaming capabilities
6. **🛡️ Security**: Request validation and limits

This enhanced AI service provides enterprise-grade capabilities for your CodeMeet application! 🎉
