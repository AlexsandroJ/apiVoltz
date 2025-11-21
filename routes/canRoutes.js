const express = require('express');
const router = express.Router();

const {
  createVehicleData,
  getLatestVehicleData,
  getVehicleHistory,
  getVehicleDataByDeviceId,
  addCanMessage,
  getRecentCanData,
  exportAllCanDataAsCsv
} = require('../controllers/canController');

router.post('/', createVehicleData);

router.get('/latest', getLatestVehicleData);

router.get('/history', getVehicleHistory);

router.get('/device/:deviceId', getVehicleDataByDeviceId);

router.post('/can/:deviceId', addCanMessage);

router.get('/can-data', getRecentCanData);

router.get('/export-can-data-csv', exportAllCanDataAsCsv);

module.exports = router;