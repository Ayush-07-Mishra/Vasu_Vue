/**
 * VasoVue rPPG Processing Module
 * Handles green channel extraction and signal processing
 */

export class VasoVueRPPG {
    constructor() {
        this.samples = [];
        this.timestamps = [];
        this.maxSamples = 1000; // Keep larger buffer for processing
        this.sampleRate = 30; // Assumed 30 FPS
        this.isRecording = false;
        this.startTime = null;
        
        // Signal processing parameters
        this.windowSize = 10; // Moving average window
        this.previousValues = [];
        
        // Quality metrics
        this.signalQuality = 0;
        this.noiseLevel = 0;
        
        this.callbacks = {
            onSampleAdded: null,
            onQualityUpdate: null
        };
    }

    startRecording() {
        this.samples = [];
        this.timestamps = [];
        this.previousValues = [];
        this.isRecording = true;
        this.startTime = Date.now();
        console.log('🔴 Started rPPG recording');
    }

    stopRecording() {
        this.isRecording = false;
        console.log('⏹️ Stopped rPPG recording');
        return {
            samples: [...this.samples],
            timestamps: [...this.timestamps],
            duration: this.startTime ? Date.now() - this.startTime : 0,
            sampleRate: this.sampleRate,
            quality: this.signalQuality
        };
    }

    extractGreenChannel(roi, videoElement) {
        if (!roi || !videoElement) return null;
        
        try {
            // Create a temporary canvas for pixel extraction
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = roi.width;
            tempCanvas.height = roi.height;
            
            // Draw the ROI region from video
            tempCtx.drawImage(
                videoElement,
                roi.x, roi.y, roi.width, roi.height,
                0, 0, roi.width, roi.height
            );
            
            const imageData = tempCtx.getImageData(0, 0, roi.width, roi.height);
            const data = imageData.data;
            
            let greenSum = 0;
            let pixelCount = 0;
            
            // Extract green channel values (every 4th element starting from index 1)
            for (let i = 1; i < data.length; i += 4) {
                greenSum += data[i];
                pixelCount++;
            }
            
            const greenMean = pixelCount > 0 ? greenSum / pixelCount : 0;
            
            // Validate the extracted value
            if (isNaN(greenMean) || greenMean <= 0 || greenMean > 255) {
                return null;
            }
            
            return greenMean;
            
        } catch (error) {
            console.warn('Green channel extraction failed:', error);
            return null;
        }
    }

    addSample(greenValue, roi = null) {
        if (!this.isRecording || greenValue === null || isNaN(greenValue)) {
            return false;
        }
        
        const timestamp = Date.now();
        
        // Apply moving average smoothing
        this.previousValues.push(greenValue);
        if (this.previousValues.length > this.windowSize) {
            this.previousValues.shift();
        }
        
        const smoothedValue = this.previousValues.reduce((sum, val) => sum + val, 0) / this.previousValues.length;
        
        // Quality check - detect sudden spikes or drops
        if (this.samples.length > 0) {
            const lastValue = this.samples[this.samples.length - 1];
            const change = Math.abs((smoothedValue - lastValue) / lastValue);
            
            // Skip values with extreme changes (>50%)
            if (change > 0.5) {
                console.warn('Extreme rPPG change detected, skipping sample');
                return false;
            }
        }
        
        // Add to buffers
        this.samples.push(smoothedValue);
        this.timestamps.push(timestamp);
        
        // Maintain buffer size
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
            this.timestamps.shift();
        }
        
        // Update signal quality
        this.updateSignalQuality();
        
        // Trigger callbacks
        if (this.callbacks.onSampleAdded) {
            this.callbacks.onSampleAdded(smoothedValue, this.samples.length);
        }
        
        if (this.callbacks.onQualityUpdate) {
            this.callbacks.onQualityUpdate(this.signalQuality);
        }
        
        return true;
    }

    updateSignalQuality() {
        if (this.samples.length < 30) {
            this.signalQuality = 0;
            return;
        }
        
        // Calculate signal-to-noise ratio as quality metric
        const recentSamples = this.samples.slice(-30);
        const mean = recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
        const variance = recentSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSamples.length;
        const stdDev = Math.sqrt(variance);
        
        // Simple SNR calculation
        const snr = mean / (stdDev + 1e-6);
        
        // Normalize to 0-100 scale
        this.signalQuality = Math.min(100, Math.max(0, (snr - 5) * 10));
        this.noiseLevel = stdDev;
    }

    getWaveformData(maxPoints = 150) {
        if (this.samples.length === 0) return [];
        
        const step = Math.max(1, Math.floor(this.samples.length / maxPoints));
        const waveformData = [];
        
        for (let i = 0; i < this.samples.length; i += step) {
            waveformData.push(this.samples[i]);
        }
        
        return waveformData;
    }

    generateWaveformPath(width = 320, height = 80, maxPoints = 150) {
        const data = this.getWaveformData(maxPoints);
        
        if (data.length === 0) {
            return `M0,${height/2} L${width},${height/2}`;
        }
        
        // Normalize data to fit height
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        
        const stepX = width / (data.length - 1 || 1);
        const centerY = height / 2;
        const amplitude = height * 0.3; // Use 30% of height for amplitude
        
        let path = '';
        
        data.forEach((value, index) => {
            const x = index * stepX;
            const normalizedValue = (value - min) / range;
            const y = centerY - (normalizedValue - 0.5) * amplitude;
            
            if (index === 0) {
                path += `M${x},${y}`;
            } else {
                path += ` L${x},${y}`;
            }
        });
        
        return path;
    }

    getSampleCount() {
        return this.samples.length;
    }

    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            duration: this.startTime ? Date.now() - this.startTime : 0,
            sampleRate: this.sampleRate,
            sampleCount: this.samples.length,
            signalQuality: this.signalQuality,
            samples: this.samples.map((value, index) => ({
                index,
                timestamp: this.timestamps[index],
                greenValue: value,
                relativeTime: this.timestamps[index] - (this.startTime || this.timestamps[0])
            })),
            metadata: {
                device: navigator.userAgent,
                windowSize: this.windowSize,
                maxSamples: this.maxSamples
            }
        };
        
        return data;
    }

    exportCSV() {
        const data = this.exportData();
        let csv = 'Index,Timestamp,RelativeTime,GreenValue,SignalQuality\n';
        
        data.samples.forEach(sample => {
            csv += `${sample.index},${sample.timestamp},${sample.relativeTime},${sample.greenValue},${data.signalQuality}\n`;
        });
        
        return csv;
    }

    exportJSON() {
        return JSON.stringify(this.exportData(), null, 2);
    }

    clear() {
        this.samples = [];
        this.timestamps = [];
        this.previousValues = [];
        this.signalQuality = 0;
        this.noiseLevel = 0;
        this.startTime = null;
    }

    // Callback setters
    onSampleAdded(callback) {
        this.callbacks.onSampleAdded = callback;
    }

    onQualityUpdate(callback) {
        this.callbacks.onQualityUpdate = callback;
    }
}

export default VasoVueRPPG;
