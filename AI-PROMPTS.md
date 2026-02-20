# 🤖 AI Prompts & Services

This directory contains specialized AI prompt management and services for the CodeMeet application.

## 📁 Files:

### **`prompts.js`** - Prompt Manager
A comprehensive prompt management system with pre-built templates for:

#### 🔍 **Code Analysis Prompts:**
- **General Analysis**: Overall code quality assessment
- **Security Analysis**: Vulnerability detection
- **Performance Analysis**: Optimization opportunities  
- **Refactoring Suggestions**: Code improvement recommendations

#### 🛠️ **Code Generation Prompts:**
- **Function Generation**: Create functions from requirements
- **Class Generation**: Build complete classes
- **API Generation**: REST API endpoints
- **Test Generation**: Unit test creation

#### 👀 **Code Review Prompts:**
- **Junior Review**: Educational feedback for beginners
- **Senior Review**: Technical deep-dive analysis
- **PR Review**: Pull request evaluation

#### 🐛 **Debugging Prompts:**
- **Error Analysis**: Root cause identification
- **Logic Debugging**: Logic flow issues

#### 📚 **Learning Prompts:**
- **Code Explanation**: Different detail levels
- **Code Optimization**: Performance improvements
- **Code Refactoring**: Clean code demonstrations

### **`ai-service.js`** - AI Service Wrapper
Service layer that integrates with Google Gemini AI:

#### **Features:**
- ✅ **Code Analysis**: Multiple analysis types
- ✅ **Code Generation**: Various code types
- ✅ **Code Review**: Different review levels
- ✅ **Debugging**: Error resolution
- ✅ **Learning**: Code explanation
- ✅ **Custom Prompts**: Flexible prompt system

#### **Methods:**
```javascript
// Analyze code
await aiService.analyzeCode(code, 'security');

// Generate code
await aiService.generateCode('javascript', 'Create a sorting function');

// Review code
await aiService.reviewCode(code, 'senior');

// Debug issues
await aiService.debugCode(code, error, context);

// Explain code
await aiService.explainCode(code, 'beginner');

// Custom prompts
await aiService.customPrompt(template, variables);
```

## 🚀 **Usage Examples:**

### **Basic Code Analysis:**
```javascript
const AIService = require('./ai-service');
const ai = new AIService(process.env.GEMINI_API_KEY);

const result = await ai.analyzeCode(`
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
`, 'performance');
```

### **Security Analysis:**
```javascript
const securityResult = await ai.analyzeCode(userInput, 'security');
```

### **Code Generation:**
```javascript
const newFunction = await ai.generateCode('python', 
  'Create a function that validates email addresses');
```

### **Educational Review:**
```javascript
const review = await ai.reviewCode(studentCode, 'junior');
```

## 🎯 **Integration with Room.js:**

Update your Socket.IO handler to use the new AI service:

```javascript
const AIService = require('./ai-service');
const ai = new AIService(config.GEMINI_API_KEY);

// In room.js
async handleAIAnalyze(socket, roomId, code) {
  try {
    const result = await ai.analyzeCode(code, 'general');
    if (result.success) {
      this.io.to(roomId).emit('ai-response', { 
        analysis: result.response 
      });
    } else {
      this.io.to(roomId).emit('ai-error', { 
        error: result.error 
      });
    }
  } catch (err) {
    console.error('AI analysis error:', err);
    this.io.to(roomId).emit('ai-error', { 
      error: 'Failed to analyze code' 
    });
  }
}
```

## 🔧 **Configuration:**

Add to your `.env` file:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

## 📊 **Available Analysis Types:**
- `general` - Overall code quality
- `security` - Security vulnerabilities  
- `performance` - Performance issues
- `refactor` - Refactoring opportunities

## 🎓 **Available Review Levels:**
- `junior` - Educational feedback
- `senior` - Technical analysis
- `pr` - Pull request review

## 🌟 **Benefits:**
1. **Consistent Prompts**: Standardized AI interactions
2. **Flexible System**: Easy to add new prompt types
3. **Educational**: Different detail levels for learning
4. **Comprehensive**: Covers all major code scenarios
5. **Maintainable**: Clean separation of concerns

This specialized prompt system enhances the AI capabilities of your CodeMeet application! 🚀
