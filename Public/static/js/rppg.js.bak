// Enhanced rPPG processing with complete signal processing
const SAMPLING_RATE = 30; // 30 fps camera
const MIN_SAMPLES_FOR_PREDICTION = 100; // ~3.3 seconds of data
const BUFFER_MAX_SIZE = 150; // Keep 5 seconds max
const SMOOTHING_WINDOW = 5; // Number of frames for moving average

const rPPG = {
    buffer: [],
    previousValues: [],
    
    addToBuffer: function(value) {
        // Validate input
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn('Invalid rPPG value:', value);
            return this.buffer.length;
        }
        
        // Apply simple smoothing
        this.previousValues.push(value);
        if (this.previousValues.length > SMOOTHING_WINDOW) {
            this.previousValues.shift();
        }
        const smoothedValue = this.previousValues.reduce((a, b) => a + b, 0) / this.previousValues.length;
        
        // Check for sudden drops/spikes (20% change from last value)
        if (this.buffer.length > 0) {
            const lastValue = this.buffer[this.buffer.length - 1];
            const change = Math.abs((smoothedValue - lastValue) / lastValue);
            if (change > 0.2) {
                console.warn('Abnormal rPPG change:', { lastValue, smoothedValue, change });
                return this.buffer.length; // Skip this value
            }
        }
        
        this.buffer.push(smoothedValue);
        
        // Maintain buffer size
        if (this.buffer.length > BUFFER_MAX_SIZE) {
            this.buffer.shift();
        }
        
        console.log(`Added rPPG value: ${smoothedValue.toFixed(2)}. Buffer size: ${this.buffer.length}`);
        return this.buffer.length;
    },
    
    clearBuffer: function() {
        this.buffer = [];
        this.previousValues = [];
    },
    
    isReadyForPrediction: function() {
        return this.buffer.length >= MIN_SAMPLES_FOR_PREDICTION;
    },

    prepareSignalForML: function(buffer) {
        // Apply bandpass filter (0.7-4Hz)
        const filtered = this.applyBandpassFilter(buffer, 0.7, 4.0, SAMPLING_RATE);
        
        // Normalize signal
        const mean = this.mean(filtered);
        const std = this.std(filtered);
        return filtered.map(val => (val - mean) / (std || 1));
    },

    extractFeatures: function() {
    if (!this.isReadyForPrediction()) {
        throw new Error(`Need at least ${MIN_SAMPLES_FOR_PREDICTION} samples (has ${this.buffer.length})`);
    }
    
    const signal = this.prepareSignalForML(this.buffer);
    
    // Time domain features
    const mean = this.mean(signal);
    const stdDev = this.std(signal);
    const rms = this.rms(signal);
    
    // Peak detection
    const min_distance = Math.floor(0.4 * SAMPLING_RATE); // 0.4s minimum between peaks
    const peaks = this.findPeaks(signal, min_distance);
    const peakIntervals = peaks.length > 1 ? 
        peaks.slice(1).map((p, i) => (p - peaks[i]) / SAMPLING_RATE) : 
        [0];
    
    // Frequency domain features
    const { dominantFreq, totalPower, peakPower } = this.calculateFrequencyFeatures(signal);
    
    // Return features in exact order expected by ML model
    return [
        mean,         // mean_amplitude
        stdDev,       // std_amplitude
        rms,          // rms_amplitude
        peaks.length, // num_peaks
        this.mean(peakIntervals),  // mean_peak_interval
        this.std(peakIntervals),   // std_peak_interval
        this.calculateSkewness(signal),  // skewness
        this.calculateKurtosis(signal),  // kurtosis
        dominantFreq, // dominant_frequency
        totalPower,   // total_power
        peakPower     // peak_power
    ];
},
    
    // Signal processing helper methods
    applyBandpassFilter: function(signal, lowcut, highcut, fs) {
        // Simple IIR bandpass implementation
        const dt = 1/fs;
        const RC_low = 1/(2*Math.PI*highcut);
        const RC_high = 1/(2*Math.PI*lowcut);
        
        const alpha_low = dt/(dt + RC_low);
        const alpha_high = RC_high/(RC_high + dt);
        
        let filtered = signal.slice();
        
        // Highpass filter
        for (let i = 1; i < filtered.length; i++) {
            filtered[i] = alpha_high * (filtered[i-1] + signal[i] - signal[i-1]);
        }
        
        // Lowpass filter
        for (let i = 1; i < filtered.length; i++) {
            filtered[i] = filtered[i-1] + alpha_low * (filtered[i] - filtered[i-1]);
        }
        
        return filtered;
    },
    
    findPeaks: function(signal, minDistance) {
        const peaks = [];
        for (let i = 1; i < signal.length - 1; i++) {
            if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
                if (!peaks.length || (i - peaks[peaks.length-1]) >= minDistance) {
                    peaks.push(i);
                }
            }
        }
        return peaks;
    },
    
    // Statistical helper methods
    mean: function(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    },
    
    std: function(arr) {
        const m = this.mean(arr);
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
    },
    
    rms: function(arr) {
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b, 2), 0) / arr.length);
    },
    
    calculateSkewness: function(arr) {
        const m = this.mean(arr);
        const s = this.std(arr);
        if (s === 0) return 0;
        return arr.reduce((sum, x) => sum + Math.pow((x - m)/s, 3), 0) / arr.length;
    },
    
    calculateKurtosis: function(arr) {
        const m = this.mean(arr);
        const s = this.std(arr);
        if (s === 0) return 0;
        return arr.reduce((sum, x) => sum + Math.pow((x - m)/s, 4), 0) / arr.length - 3;
    },
    
    calculateFrequencyFeatures: function(signal) {
        // Simple FFT implementation
        const fft = (real) => {
            const n = real.length;
            const imag = new Array(n).fill(0);
            for (let k = 0; k < n; k++) {
                for (let t = 0; t < n; t++) {
                    const angle = 2 * Math.PI * t * k / n;
                    imag[k] -= real[t] * Math.sin(angle);
                }
            }
            return imag;
        };
        
        const spectrum = fft(signal);
        const powerSpectrum = spectrum.map(x => x * x);
        const maxIndex = powerSpectrum.indexOf(Math.max(...powerSpectrum));
        const dominantFreq = (maxIndex * SAMPLING_RATE) / signal.length;
        
        return {
            dominantFreq,
            totalPower: powerSpectrum.reduce((a, b) => a + b, 0),
            peakPower: Math.max(...powerSpectrum)
        };
    },
    
    // ROI extraction methods
    extractForeheadROI: function(landmarks) {
        if (!landmarks || landmarks.length < 25) {
            console.warn('Invalid landmarks data - not enough points');
            return null;
        }

        const foreheadPoints = landmarks.slice(19, 25);
        const xs = foreheadPoints.map(p => p.x);
        const ys = foreheadPoints.map(p => p.y);

        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.max(...xs);
        const minY = Math.max(0, Math.min(...ys) - 30);
        const maxY = minY + 30;

        if (minX >= maxX || minY >= maxY) {
            console.warn('Invalid ROI dimensions');
            return null;
        }
        
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    
    extractGreenMean: function(ctx, roi) {
        if (!roi || roi.width <= 0 || roi.height <= 0) {
            console.warn('Invalid ROI - skipping frame');
            return 0;
        }
        
        try {
            const imageData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
            let sumGreen = 0;
            let count = 0;

            for (let i = 0; i < imageData.data.length; i += 4) {
                sumGreen += imageData.data[i + 1]; // Green channel
                count++;
            }
            return count > 0 ? sumGreen / count : 0;
        } catch (e) {
            console.warn('ROI extraction failed:', e);
            return 0;
        }
    }
};

// Export for browser
window.rPPG = rPPG;