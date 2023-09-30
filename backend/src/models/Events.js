const mongoose = require('mongoose');

const eventsSchema = new mongoose.Schema({
    eventId: mongoose.Types.ObjectId,
    startTime: String,
    endTime: String,
    description: String,
    subdescription: String
});

module.exports = mongoose.model('Events', eventsSchema);
