const express = require('express');
const AIController = require('./ai-controller');

const router = express.Router();
const aiController = new AIController();

// AI Analysis Routes
router.post('/analyze', aiController.analyzeCode.bind(aiController));
router.post('/generate', aiController.generateCode.bind(aiController));
router.post('/review', aiController.reviewCode.bind(aiController));
router.post('/debug', aiController.debugCode.bind(aiController));
router.post('/explain', aiController.explainCode.bind(aiController));
router.post('/optimize', aiController.optimizeCode.bind(aiController));
router.post('/refactor', aiController.refactorCode.bind(aiController));
router.post('/custom', aiController.customPrompt.bind(aiController));

// Get available AI services
router.get('/services', aiController.getAvailableServices.bind(aiController));

module.exports = router;
