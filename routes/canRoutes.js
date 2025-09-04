const express = require('express');
const router = express.Router();
const canController = require('../controllers/canController');

// Rotas
router.post('/', canController.createCanData);           // POST /api/can
router.get('/', canController.getAllCanData);            // GET /api/can
router.get('/:id', canController.getCanDataById);        // GET /api/can/:id
router.delete('/:id', canController.deleteCanData);      // DELETE /api/can/:id

module.exports = router;