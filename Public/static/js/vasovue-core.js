/**
 * VasoVue Core System Module
 * Manages the overall application state and coordination
 */

export class VasoVueCore {
    constructor() {
        this.mediaStream = null;
        this.isInitialized = false;
        this.isRecording = false;
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
        
        // Target samples (configurable)
        this.targetSamples = 300;
        this.audioFeedbackEnabled = true;
        this.beepInterval = 50; // Beep every N samples
        
        // Audio context for beeps
        this.audioContext = null;
        this.lastBeepSample = 0;
        
        // Available cameras
        this.availableCameras = [];
        this.selectedCameraId = null;
        
        // Status tracking
        this.status = {
            camera: 'disconnected',
            face: 'not_detected',
            recording: 'stopped',
            samples: 0,
            quality: 0
        };
        
        this.callbacks = {
            onStatusUpdate: null,
            onProgressUpdate: null,
            onTargetReached: null,
            onError: null
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('🚀 Initializing VasoVue Core...');
            
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get available cameras
            await this.getCameraDevices();
            
            this.isInitialized = true;
            console.log('✅ VasoVue Core initialized');
            
        } catch (error) {
            console.error('❌ Core initialization failed:', error);
            this.triggerError('Failed to initialize system', error);
        }
    }

    async getCameraDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');
            
            console.log(`📷 Found ${this.availableCameras.length} camera(s)`);
            return this.availableCameras;
            
        } catch (error) {
            console.error('❌ Failed to get camera devices:', error);
            return [];
        }
    }

    async startCamera(cameraId = null) {
        try {
            // Stop existing stream
            this.stopCamera();
            
            const constraints = {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            // Use specific camera if provided
            if (cameraId) {
                constraints.video.deviceId = { exact: cameraId };
                delete constraints.video.facingMode;
            }
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.selectedCameraId = cameraId;
            
            this.updateStatus('camera', 'connected');
            console.log('📷 Camera started successfully');
            
            return this.mediaStream;
            
        } catch (error) {
            console.error('❌ Failed to start camera:', error);
            this.updateStatus('camera', 'error');
            this.triggerError('Failed to access camera', error);
            throw error;
        }
    }

    stopCamera() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
            });
            this.mediaStream = null;
            this.updateStatus('camera', 'disconnected');
            console.log('📷 Camera stopped');
        }
    }

    startRecording() {
        this.isRecording = true;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.lastBeepSample = 0;
        
        this.updateStatus('recording', 'active');
        console.log('🔴 Recording started');
        
        // Play start beep
        if (this.audioFeedbackEnabled) {
            this.playBeep(800, 200); // Higher pitch for start
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.updateStatus('recording', 'stopped');
        console.log('⏹️ Recording stopped');
        
        // Play stop beep
        if (this.audioFeedbackEnabled) {
            this.playBeep(400, 300); // Lower pitch for stop
        }
    }

    updateFrame() {
        if (!this.isRecording) return;
        
        this.frameCount++;
        
        // Calculate FPS
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        
        if (deltaTime >= 1000) { // Update FPS every second
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }

    updateSampleCount(count) {
        this.status.samples = count;
        
        // Check for beep interval
        if (this.audioFeedbackEnabled && 
            count > 0 && 
            count % this.beepInterval === 0 && 
            count !== this.lastBeepSample) {
            
            this.playBeep(600, 100); // Medium pitch for progress
            this.lastBeepSample = count;
        }
        
        // Check if target reached
        if (count >= this.targetSamples) {
            this.onTargetReached();
        }
        
        // Update progress
        const progress = Math.min(100, (count / this.targetSamples) * 100);
        this.triggerProgressUpdate(count, this.targetSamples, progress);
    }

    onTargetReached() {
        console.log('🎯 Target samples reached!');
        
        // Play success sound
        if (this.audioFeedbackEnabled) {
            this.playSuccessSound();
        }
        
        // Trigger confetti
        this.triggerConfetti();
        
        // Stop recording
        this.stopRecording();
        
        // Trigger callback
        if (this.callbacks.onTargetReached) {
            this.callbacks.onTargetReached();
        }
    }

    playBeep(frequency = 600, duration = 100) {
        if (!this.audioContext || !this.audioFeedbackEnabled) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
            
        } catch (error) {
            console.warn('Audio beep failed:', error);
        }
    }

    playSuccessSound() {
        const notes = [523, 659, 784]; // C, E, G (major chord)
        notes.forEach((freq, index) => {
            setTimeout(() => {
                this.playBeep(freq, 200);
            }, index * 100);
        });
    }

    triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#667eea', '#764ba2', '#10b981', '#f59e0b']
            });
            
            // Additional burst after a short delay
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 }
                });
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 }
                });
            }, 300);
        }
    }

    updateStatus(key, value) {
        this.status[key] = value;
        
        if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(key, value, this.status);
        }
    }

    setTargetSamples(target) {
        this.targetSamples = Math.max(100, Math.min(1000, target));
        console.log(`🎯 Target samples set to: ${this.targetSamples}`);
    }

    setAudioFeedback(enabled) {
        this.audioFeedbackEnabled = enabled;
        console.log(`🔊 Audio feedback: ${enabled ? 'enabled' : 'disabled'}`);
    }

    getFPS() {
        return this.fps;
    }

    getStatus() {
        return { ...this.status };
    }

    triggerError(message, error = null) {
        console.error('💥 VasoVue Error:', message, error);
        
        if (this.callbacks.onError) {
            this.callbacks.onError(message, error);
        }
    }

    triggerProgressUpdate(current, target, percentage) {
        if (this.callbacks.onProgressUpdate) {
            this.callbacks.onProgressUpdate(current, target, percentage);
        }
    }

    // Callback setters
    onStatusUpdate(callback) {
        this.callbacks.onStatusUpdate = callback;
    }

    onProgressUpdate(callback) {
        this.callbacks.onProgressUpdate = callback;
    }

    onTargetReached(callback) {
        this.callbacks.onTargetReached = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    // Cleanup
    destroy() {
        this.stopCamera();
        this.stopRecording();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('🧹 VasoVue Core destroyed');
    }
}

export default VasoVueCore;
