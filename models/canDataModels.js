const mongoose = require('mongoose');

const canDataSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        trim: true,
        default: () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Janeiro é 0
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');

            // Formato: YYYYMMDD-HHMMSS
            const formatted = `${year}${month}${day}-${hour}:${minute}:${second}`;
            return `dev-${formatted}`; // Ex: dev-20250405-143022
        }
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    canId: {
        type: String,
        required: true,
        trim: true
    },
    data: {
        type: String,
        required: true
    },
    rtr: {
        type: Boolean,
        default: false
    },
    dlc: {
        type: Number,
        required: true
    }
}, {
    timestamps: true // createdAt, updatedAt
});

// O _id será gerado automaticamente pelo Mongoose
module.exports = mongoose.model('CanData', canDataSchema);