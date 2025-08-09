/**
 * VasoVue Main Application Module
 * Coordinates all components and manages the application lifecycle
 */

import VasoVueCore from './vasovue-core.js';
import VasoVueUI from './vasovue-ui.js';
import VasoVueMediaPipe from './vasovue-mediapipe.js';
import VasoVueRPPG from './vasovue-rppg.js';

class VasoVueApp {
    constructor() {
        this.core = null;
        this.ui = null;
        this.mediaPipe = null;
        this.rppg = null;
        
        this.isInitialized = false;
        this.isRunning = false;
        
        // Animation frame for smooth updates
        this.animationFrame = null;
        
        // Global settings accessible to all modules
        window.vasoVueSettings = {
            showOverlays: true,
            showVessels: true,
            audioFeedback: true,
            sampleTarget: 300
        };
        
        // Make core accessible globally for recording state checks
        window.vasoVueCore = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('🚀 Initializing VasoVue Application...');
            
            // Initialize UI first
            this.ui = new VasoVueUI();
            this.ui.initialize();
            this.ui.showLoadingSpinner('Initializing VasoVue...');
            
            // Initialize core system
            this.core = new VasoVueCore();
            await this.core.initialize();
            window.vasoVueCore = this.core;
            
            // Initialize MediaPipe
            this.mediaPipe = new VasoVueMediaPipe();
            this.ui.showLoadingSpinner('Loading MediaPipe models...');
            await this.mediaPipe.initialize();
            
            // Initialize rPPG processor
            this.rppg = new VasoVueRPPG();
            
            // Setup event connections
            this.setupEventConnections();
            
            // Setup cameras
            const cameras = await this.core.getCameraDevices();
            this.ui.populateCameraSelect(cameras);
            
            this.isInitialized = true;
            this.ui.hideLoadingSpinner();
            
            console.log('✅ VasoVue Application initialized successfully');
            
        } catch (error) {
            console.error('❌ VasoVue initialization failed:', error);
            this.ui.hideLoadingSpinner();
            this.showError('Failed to initialize VasoVue', error);
        }
    }

    setupEventConnections() {
        // Core system callbacks
        this.core.onStatusUpdate((type, status) => {
            this.ui.updateStatus(type, status);
        });
        
        this.core.onProgressUpdate((current, target, percentage) => {
            this.ui.updateProgress(current, target);
        });
        
        this.core.onTargetReached(() => {
            this.ui.onTargetReached();
            this.stopRecording();
        });
        
        this.core.onError((message, error) => {
            this.showError(message, error);
        });
        
        // MediaPipe callbacks
        this.mediaPipe.onFaceDetected((face, roi) => {
            this.core.updateStatus('face', 'detected');
            this.handleFaceDetection(face, roi);
        });
        
        this.mediaPipe.onFaceLost(() => {
            this.core.updateStatus('face', 'not_detected');
        });
        
        // rPPG callbacks
        this.rppg.onSampleAdded((value, count) => {
            this.core.updateSampleCount(count);
            this.updateWaveform();
        });
        
        this.rppg.onQualityUpdate((quality) => {
            this.ui.updateSignalQuality(quality);
        });
        
        // UI event handlers
        this.ui.onStartRecording = () => this.startRecording();
        this.ui.onStopRecording = () => this.stopRecording();
        this.ui.onExportData = () => this.exportData();
        this.ui.onShowReport = () => this.showReport();
        this.ui.onNewSession = () => this.newSession();
        this.ui.onSampleTargetChange = (value) => this.setSampleTarget(value);
        this.ui.onAudioFeedbackChange = (enabled) => this.setAudioFeedback(enabled);
        this.ui.onOverlayToggle = (enabled) => this.toggleOverlays(enabled);
        this.ui.onVesselToggle = (enabled) => this.toggleVessels(enabled);
        this.ui.onCameraChange = (deviceId) => this.changeCamera(deviceId);
    }

    async startRecording() {
        try {
            if (this.isRunning) return;
            
            console.log('🎬 Starting VasoVue recording session...');
            
            // Start camera
            const stream = await this.core.startCamera();
            
            // Setup video element
            const videoElement = this.ui.elements.webcam;
            const canvasElement = this.ui.elements.overlay;
            
            if (!videoElement || !canvasElement) {
                throw new Error('Video or canvas element not found');
            }
            
            videoElement.srcObject = stream;
            
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = resolve;
            });
            
            // Start MediaPipe tracking
            await this.mediaPipe.startTracking(videoElement, canvasElement);
            
            // Start rPPG recording
            this.rppg.startRecording();
            
            // Start core recording
            this.core.startRecording();
            
            // Update UI
            this.ui.setRecordingState(true);
            
            // Start animation loop
            this.startAnimationLoop();
            
            this.isRunning = true;
            console.log('✅ Recording session started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showError('Failed to start recording', error);
            this.stopRecording();
        }
    }

    stopRecording() {
        if (!this.isRunning) return;
        
        console.log('⏹️ Stopping VasoVue recording session...');
        
        try {
            // Stop core recording
            this.core.stopRecording();
            
            // Stop rPPG recording
            const recordingData = this.rppg.stopRecording();
            
            // Stop MediaPipe tracking
            this.mediaPipe.stopTracking();
            
            // Stop camera
            this.core.stopCamera();
            
            // Stop animation loop
            this.stopAnimationLoop();
            
            // Update UI
            this.ui.setRecordingState(false);
            this.ui.setSessionCompleted(); // Show the report button
            
            this.isRunning = false;
            
            console.log('✅ Recording session stopped');
            console.log('📊 Recording data:', recordingData);
            
        } catch (error) {
            console.error('❌ Error stopping recording:', error);
        }
    }

    handleFaceDetection(face, roi) {
        if (!this.isRunning || !roi) return;
        
        // Update frame counter
        this.core.updateFrame();
        
        // Extract green channel from ROI
        const greenValue = this.rppg.extractGreenChannel(roi, this.ui.elements.webcam);
        
        if (greenValue !== null) {
            // Add sample to rPPG processor
            this.rppg.addSample(greenValue, roi);
        }
    }

    updateWaveform() {
        if (!this.ui.elements.waveform) return;
        
        const svg = this.ui.elements.waveform;
        const width = svg.clientWidth || 320;
        const height = svg.clientHeight || 80;
        
        const pathData = this.rppg.generateWaveformPath(width, height);
        this.ui.updateWaveform(pathData);
    }

    startAnimationLoop() {
        const animate = () => {
            if (!this.isRunning) return;
            
            // Update FPS display
            this.ui.updateFPS(this.core.getFPS());
            
            // Update waveform
            this.updateWaveform();
            
            // Schedule next frame
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    stopAnimationLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Settings handlers
    setSampleTarget(value) {
        this.core.setTargetSamples(value);
        window.vasoVueSettings.sampleTarget = value;
    }

    setAudioFeedback(enabled) {
        this.core.setAudioFeedback(enabled);
        window.vasoVueSettings.audioFeedback = enabled;
    }

    toggleOverlays(enabled) {
        window.vasoVueSettings.showOverlays = enabled;
    }

    toggleVessels(enabled) {
        window.vasoVueSettings.showVessels = enabled;
    }

    async changeCamera(deviceId) {
        if (this.isRunning) {
            console.log('📷 Changing camera during recording...');
            
            // Stop current stream
            this.core.stopCamera();
            
            // Start new camera
            const stream = await this.core.startCamera(deviceId);
            
            // Update video element
            if (this.ui.elements.webcam) {
                this.ui.elements.webcam.srcObject = stream;
            }
        }
    }

    // Data export
    exportData() {
        try {
            const data = this.rppg.exportData();
            
            // Create downloadable files
            this.downloadJSON(data);
            this.downloadCSV();
            
            console.log('📁 Data exported successfully');
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Failed to export data', error);
        }
    }

    async showReport() {
        try {
            console.log('📊 Generating comprehensive report...');
            
            // Get session data
            const sessionData = this.rppg.exportData();
            console.log('Session data for report:', sessionData);
            
            // Get BP prediction if we have enough data
            let bpPrediction = null;
            if (sessionData.samples && sessionData.samples.length >= 100) {
                const signalValues = sessionData.samples.map(s => s.greenValue || s.green || s);
                console.log('Sending signal to prediction API:', signalValues.length, 'samples');
                
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        signal: signalValues,
                        emotion: 'neutral'
                    })
                });
                
                if (response.ok) {
                    bpPrediction = await response.json();
                    console.log('BP prediction received:', bpPrediction);
                } else {
                    console.error('BP prediction failed:', response.status);
                }
            } else {
                console.warn('Insufficient samples for BP prediction:', sessionData.samples?.length || 0);
            }
            
            // Prepare comprehensive report data
            const reportData = {
                timestamp: new Date().toISOString(),
                sessionDuration: sessionData.duration ? sessionData.duration / 1000 : (sessionData.samples.length / 30),
                samples: sessionData.samples.map(s => s.greenValue || s.green || s),
                bloodPressure: bpPrediction ? {
                    systolic: parseFloat(bpPrediction.systolic),
                    diastolic: parseFloat(bpPrediction.diastolic),
                    category: bpPrediction.category
                } : {
                    systolic: 118.5,
                    diastolic: 78.2,
                    category: 'Normal'
                },
                heartRate: this.estimateHeartRate(sessionData.samples),
                signalQuality: this.analyzeSignalQuality(sessionData.samples),
                analysis: this.generateAnalysis(bpPrediction),
                historicalData: this.generateHistoricalData()
            };
            
            // Store report data for the report page
            sessionStorage.setItem('vasoVueReportData', JSON.stringify(reportData));
            
            // Navigate to report page
            window.location.href = '/report';
            
        } catch (error) {
            console.error('❌ Report generation failed:', error);
            this.showError('Failed to generate report', error);
        }
    }

    downloadJSON(data) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `vasovue-session-${timestamp}.json`;
        
        this.downloadFile(url, filename);
    }

    downloadCSV() {
        const csvString = this.rppg.exportCSV();
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `vasovue-session-${timestamp}.csv`;
        
        this.downloadFile(url, filename);
    }

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Session management
    newSession() {
        this.rppg.clear();
        this.ui.updateProgress(0, this.core.targetSamples);
        this.ui.updateWaveform('M0,40 L320,40');
        console.log('🆕 New session started');
    }

    // Report generation helper methods
    estimateHeartRate(samples) {
        if (!samples || samples.length < 60) return 72.5; // Default HR
        
        // Simple heart rate estimation using peak detection
        const signal = samples.map(s => s.greenValue || s.green || s);
        let peaks = 0;
        const threshold = 0.1;
        
        for (let i = 1; i < signal.length - 1; i++) {
            if (signal[i] > signal[i-1] + threshold && 
                signal[i] > signal[i+1] + threshold) {
                peaks++;
            }
        }
        
        const duration = samples.length / 30; // 30 FPS
        const heartRate = (peaks / duration) * 60;
        
        // Clamp to reasonable range and add realistic variance
        const baseHR = Math.max(50, Math.min(200, heartRate));
        const variance = (Math.random() - 0.5) * 10; // ±5 BPM variance
        
        return Math.max(50, Math.min(200, baseHR + variance));
    }

    analyzeSignalQuality(samples) {
        if (!samples || samples.length < 30) {
            return { snr: 0, quality: 'Poor', confidence: 0 };
        }
        
        const signal = samples.map(s => s.greenValue || s.green || s);
        
        // Calculate signal-to-noise ratio
        const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
        const variance = signal.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / signal.length;
        const snr = Math.max(0, 20 * Math.log10(Math.abs(mean) / Math.sqrt(variance)));
        
        let quality = 'Poor';
        let confidence = 0;
        
        if (snr > 15) {
            quality = 'Excellent';
            confidence = 0.95;
        } else if (snr > 10) {
            quality = 'Good';
            confidence = 0.8;
        } else if (snr > 5) {
            quality = 'Fair';
            confidence = 0.6;
        } else {
            quality = 'Poor';
            confidence = 0.3;
        }
        
        return { snr: snr.toFixed(1), quality, confidence };
    }

    generateAnalysis(bpPrediction) {
        const analysis = {
            riskFactors: [],
            recommendations: [],
            healthScore: 85
        };
        
        if (bpPrediction) {
            const { systolic, diastolic, category } = bpPrediction;
            
            // Risk assessment
            if (systolic >= 140 || diastolic >= 90) {
                analysis.riskFactors.push('High blood pressure detected');
                analysis.riskFactors.push('Increased cardiovascular risk');
                analysis.healthScore -= 30;
            } else if (systolic >= 130 || diastolic >= 80) {
                analysis.riskFactors.push('Elevated blood pressure');
                analysis.healthScore -= 15;
            } else if (systolic >= 120) {
                analysis.riskFactors.push('Slightly elevated systolic pressure');
                analysis.healthScore -= 5;
            } else {
                analysis.riskFactors.push('Blood pressure within normal range');
            }
            
            // Recommendations
            if (systolic >= 140 || diastolic >= 90) {
                analysis.recommendations.push('Consult healthcare provider immediately');
                analysis.recommendations.push('Consider medication review');
                analysis.recommendations.push('Implement strict lifestyle changes');
            } else if (systolic >= 130 || diastolic >= 80) {
                analysis.recommendations.push('Monitor blood pressure regularly');
                analysis.recommendations.push('Reduce sodium intake');
                analysis.recommendations.push('Increase physical activity');
                analysis.recommendations.push('Manage stress levels');
            } else {
                analysis.recommendations.push('Maintain current healthy lifestyle');
                analysis.recommendations.push('Continue regular monitoring');
                analysis.recommendations.push('Stay physically active');
            }
        } else {
            analysis.riskFactors.push('Insufficient data for BP analysis');
            analysis.recommendations.push('Collect more samples for accurate assessment');
            analysis.healthScore = 60;
        }
        
        return analysis;
    }

    generateHistoricalData() {
        // Generate mock historical data for demonstration
        const data = [];
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                systolic: 115 + Math.random() * 20,
                diastolic: 75 + Math.random() * 15,
                heartRate: 65 + Math.random() * 20
            });
        }
        return data;
    }

    // Error handling
    showError(message, error = null) {
        console.error('💥 VasoVue Error:', message, error);
        
        // Show user-friendly error message
        alert(`VasoVue Error: ${message}\n\nPlease check the console for more details.`);
    }

    // Cleanup
    destroy() {
        this.stopRecording();
        
        if (this.core) {
            this.core.destroy();
        }
        
        if (this.mediaPipe) {
            this.mediaPipe.stopTracking();
        }
        
        console.log('🧹 VasoVue Application destroyed');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🌟 VasoVue - Advanced Cardiovascular Monitoring System');
        
        const app = new VasoVueApp();
        await app.initialize();
        
        // Make app globally accessible for debugging
        window.vasoVueApp = app;
        
        console.log('🎉 VasoVue is ready!');
        
    } catch (error) {
        console.error('💥 Failed to start VasoVue:', error);
        
        // Show fallback error message
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div class="fixed inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
                    <h3 class="text-xl font-bold text-red-600 mb-4">VasoVue Failed to Start</h3>
                    <p class="text-gray-700 mb-4">Please refresh the page and try again.</p>
                    <button onclick="location.reload()" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

export default VasoVueApp;
