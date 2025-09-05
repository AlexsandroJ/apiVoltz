const express = require('express');
const router = express.Router();

const {
  createVehicleData,
  getLatestVehicleData,
  getVehicleHistory,
  getVehicleDataByDeviceId
} = require('../controllers/canController');

router.post('/', createVehicleData);

router.get('/latest', getLatestVehicleData);

router.get('/history', getVehicleHistory);

router.get('/device/:id', getVehicleDataByDeviceId);

module.exports = router;