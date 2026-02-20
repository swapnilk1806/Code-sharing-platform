const AIService = require('../ai-service');
const config = require('../config');

class AIController {
  constructor() {
    this.ai = new AIService(config.GEMINI_API_KEY);
  }

  // Main AI analysis endpoint
  async analyzeCode(req, res) {
    try {
      const { code, analysisType = 'general' } = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }

      const result = await this.ai.analyzeCode(code, analysisType);
      
      res.json({
        success: result.success,
        analysis: result.response || null,
        error: result.error || null,
        analysisType: analysisType
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Generate code from requirements
  async generateCode(req, res) {
    try {
      const { language, requirements, codeType = 'function' } = req.body;
      
      if (!language || !requirements) {
        return res.status(400).json({
          success: false,
          error: 'Language and requirements are required'
        });
      }

      const result = await this.ai.generateCode(language, requirements, codeType);
      
      res.json({
        success: result.success,
        generatedCode: result.response || null,
        error: result.error || null,
        language: language,
        codeType: codeType
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Review code with different levels
  async reviewCode(req, res) {
    try {
      const { code, reviewLevel = 'junior' } = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }

      const result = await this.ai.reviewCode(code, reviewLevel);
      
      res.json({
        success: result.success,
        review: result.response || null,
        error: result.error || null,
        reviewLevel: reviewLevel
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Debug code issues
  async debugCode(req, res) {
    try {
      const { code, error, context = '' } = req.body;
      
      if (!code || !error) {
        return res.status(400).json({
          success: false,
          error: 'Code and error are required'
        });
      }

      const result = await this.ai.debugCode(code, error, context);
      
      res.json({
        success: result.success,
        debugInfo: result.response || null,
        error: result.error || null
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Explain code at different detail levels
  async explainCode(req, res) {
    try {
      const { code, detailLevel = 'intermediate' } = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }

      const result = await this.ai.explainCode(code, detailLevel);
      
      res.json({
        success: result.success,
        explanation: result.response || null,
        error: result.error || null,
        detailLevel: detailLevel
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Optimize code
  async optimizeCode(req, res) {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }

      const result = await this.ai.optimizeCode(code);
      
      res.json({
        success: result.success,
        optimizedCode: result.response || null,
        error: result.error || null
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Refactor code
  async refactorCode(req, res) {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }

      const result = await this.ai.refactorCode(code);
      
      res.json({
        success: result.success,
        refactoredCode: result.response || null,
        error: result.error || null
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Custom prompt endpoint
  async customPrompt(req, res) {
    try {
      const { template, variables } = req.body;
      
      if (!template) {
        return res.status(400).json({
          success: false,
          error: 'Template is required'
        });
      }

      const result = await this.ai.customPrompt(template, variables || {});
      
      res.json({
        success: result.success,
        response: result.response || null,
        error: result.error || null
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get available AI services
  getAvailableServices(req, res) {
    try {
      const services = {
        analysisTypes: this.ai.getAnalysisTypes(),
        reviewLevels: this.ai.getReviewTypes(),
        learningTypes: this.ai.getLearningTypes(),
        codeTypes: ['function', 'class', 'api', 'test'],
        detailLevels: ['beginner', 'intermediate', 'advanced']
      };

      res.json({
        success: true,
        services: services
      });

    } catch (error) {
      console.error('AI Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = AIController;
