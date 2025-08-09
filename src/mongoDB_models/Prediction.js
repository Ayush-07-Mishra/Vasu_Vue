import mongoose from 'mongoose';

const PredictionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    systolic: { type: Number, required: true },
    diastolic: { type: Number, required: true },
    emotion: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const Prediction = mongoose.model('Prediction', PredictionSchema);

export default Prediction;