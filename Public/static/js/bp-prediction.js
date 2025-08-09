
console.log('📦 bp-prediction.js loaded - ML version');

class BloodPressurePrediction {
    constructor() {
        this.apiEndpoint = '/api/predict';
        this.timeout = 5000;
        this.minSamples = 100;
        this.bufferSize = 300;
        this.rppgBuffer = [];

        if (Array.isArray(window.rppgBuffer)) {
            this.rppgBuffer = [...window.rppgBuffer];
        }
    }

    updateBuffer(newValue) {
        if (typeof newValue !== 'number' || isNaN(newValue)) return;
        
        this.rppgBuffer.push(newValue);
        if (this.rppgBuffer.length > this.bufferSize) {
            this.rppgBuffer.shift();
        }
        
        window.rppgBuffer = [...this.rppgBuffer];
    }

    async predictFromFace(faceData) {
        try {
            if (!faceData) throw new Error('No face data provided');
            
            // Wait for rPPG to be available if needed
            if (!window.rPPG) {
                await new Promise(resolve => {
                    const check = () => {
                        if (window.rPPG) return resolve();
                        setTimeout(check, 100);
                    };
                    check();
                });
            }

            if (!window.rPPG || !window.rPPG.buffer || window.rPPG.buffer.length < this.minSamples) {
                throw new Error(`Insufficient data (${window.rPPG?.buffer?.length || 0}/${this.minSamples} samples)`);
            }
            
            // Extract features and validate
            const featureArray = window.rPPG.extractFeatures();
            if (!Array.isArray(featureArray)) {
                throw new Error('Feature extraction failed - invalid feature array');
            }
            
            const dominantEmotion = this.getDominantEmotion(faceData.expressions);

            // Get prediction from backend
            const prediction = await this.sendToBackend({
                features: featureArray,
                emotion: dominantEmotion
            });
            
            const suggestions = this.generateSuggestions(
                prediction.systolic, 
                prediction.diastolic, 
                dominantEmotion
            );
            
            return {
                systolic: prediction.systolic,
                diastolic: prediction.diastolic,
                emotion: dominantEmotion,
                suggestions
            };
            
        } catch (error) {
            console.error('Prediction error:', error);
            throw error;
        }
    }

    async sendToBackend(data) {
        try {
            // Normalize feature values
        const normalizedFeatures = data.features.map(val => {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        });
        
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            signal: window.rppgBuffer, // send the raw signal
            emotion: data.emotion
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${errorText}`);
        }
        
        return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw new Error(`Prediction failed: ${error.message}`);
        }
    }

    getDominantEmotion(expressions) {
        if (!expressions) return 'neutral';
        return Object.entries(expressions).reduce(
            (max, [emotion, value]) => value > max.value ? { emotion, value } : max,
            { emotion: 'neutral', value: 0 }
        ).emotion;
    }

    generateSuggestions(systolic, diastolic, emotion) {
        const suggestions = [];
        
        if (systolic > 140 || diastolic > 90) {
            suggestions.push('Consider consulting a healthcare professional');
        } else if (systolic > 130 || diastolic > 85) {
            suggestions.push('Monitor your blood pressure regularly');
        } else {
            suggestions.push('Your blood pressure appears normal');
        }
        
        switch(emotion) {
            case 'angry':
                suggestions.push('Try relaxation techniques to reduce stress');
                break;
            case 'sad':
                suggestions.push('Consider activities that improve mood');
                break;
            case 'fearful':
                suggestions.push('Practice mindfulness exercises');
                break;
        }
        
        suggestions.push(
            'Maintain a balanced diet',
            'Get regular exercise',
            'Ensure adequate sleep'
        );
        
        return suggestions;
    }
}

export { BloodPressurePrediction };