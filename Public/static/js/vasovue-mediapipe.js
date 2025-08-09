/**
 * VasoVue MediaPipe Face Tracking Module
 * Handles face mesh detection and ROI extraction
 */

export class VasoVueMediaPipe {
    constructor() {
        this.faceMesh = null;
        this.isInitialized = false;
        this.videoElement = null;
        this.canvasElement = null;
        this.ctx = null;
        this.currentFace = null;
        this.isProcessing = false;
        
        // Face mesh landmark indices for forehead region
        this.foreheadIndices = [
            10, 151, 9, 8, 107, 55, 65, 52, 53, 46,
            70, 63, 105, 66, 54, 67, 109, 10
        ];
        
        // Cheek regions (optional)
        this.leftCheekIndices = [116, 117, 118, 119, 120, 121, 128, 126, 142, 36];
        this.rightCheekIndices = [345, 346, 347, 348, 349, 350, 357, 355, 371, 266];
        
        this.callbacks = {
            onFaceDetected: null,
            onFaceLost: null,
            onROIUpdate: null
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('🔄 Initializing MediaPipe FaceMesh...');
            
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults(this.onResults.bind(this));
            
            this.isInitialized = true;
            console.log('✅ MediaPipe FaceMesh initialized successfully');
            
        } catch (error) {
            console.error('❌ MediaPipe initialization failed:', error);
            throw error;
        }
    }

    async startTracking(videoElement, canvasElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
        // Ensure canvas matches video dimensions
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        
        console.log('🎯 Started face tracking');
        this.processFrame();
    }

    stopTracking() {
        this.isProcessing = false;
        this.currentFace = null;
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        }
        console.log('⏹️ Stopped face tracking');
    }

    async processFrame() {
        if (!this.videoElement || !this.isInitialized || this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            await this.faceMesh.send({ image: this.videoElement });
        } catch (error) {
            console.warn('Frame processing error:', error);
        }
        
        this.isProcessing = false;
        
        // Schedule next frame
        requestAnimationFrame(() => this.processFrame());
    }

    onResults(results) {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const face = results.multiFaceLandmarks[0];
            this.currentFace = face;
            
            // Extract forehead ROI
            const foreheadROI = this.extractForeheadROI(face);
            
            // Draw overlays if enabled
            if (window.vasoVueSettings?.showOverlays) {
                this.drawForeheadOverlay(foreheadROI);
            }
            
            if (window.vasoVueSettings?.showVessels) {
                this.drawVesselLines(foreheadROI);
            }
            
            // Trigger callbacks
            if (this.callbacks.onFaceDetected) {
                this.callbacks.onFaceDetected(face, foreheadROI);
            }
            
            if (this.callbacks.onROIUpdate) {
                this.callbacks.onROIUpdate(foreheadROI);
            }
            
        } else {
            this.currentFace = null;
            if (this.callbacks.onFaceLost) {
                this.callbacks.onFaceLost();
            }
        }
    }

    extractForeheadROI(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;
        
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;
        
        // Get forehead points
        const foreheadPoints = this.foreheadIndices.map(index => {
            const point = landmarks[index];
            return {
                x: point.x * width,
                y: point.y * height
            };
        });
        
        // Calculate bounding box
        const xs = foreheadPoints.map(p => p.x);
        const ys = foreheadPoints.map(p => p.y);
        
        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.min(width, Math.max(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxY = Math.min(height, Math.max(...ys));
        
        // Expand ROI slightly for better capture
        const padding = 10;
        const roi = {
            x: Math.max(0, minX - padding),
            y: Math.max(0, minY - padding),
            width: Math.min(width - (minX - padding), maxX - minX + 2 * padding),
            height: Math.min(height - (minY - padding), maxY - minY + 2 * padding),
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            },
            points: foreheadPoints
        };
        
        return roi;
    }

    drawForeheadOverlay(roi) {
        if (!roi || !this.ctx) return;
        
        this.ctx.save();
        
        // Draw ROI polygon
        this.ctx.beginPath();
        roi.points.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        
        // Fill with semi-transparent green
        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        this.ctx.fill();
        
        // Stroke with solid green
        this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Add pulsing effect during recording
        if (window.vasoVueCore?.isRecording) {
            const time = Date.now() * 0.003;
            const pulseAlpha = 0.3 + 0.4 * Math.sin(time);
            
            this.ctx.fillStyle = `rgba(16, 185, 129, ${pulseAlpha})`;
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    drawVesselLines(roi) {
        if (!roi || !this.ctx) return;
        
        this.ctx.save();
        
        // Main vessel network
        this.ctx.strokeStyle = 'rgba(220, 38, 127, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'rgba(220, 38, 127, 0.3)';
        this.ctx.shadowBlur = 3;
        
        const center = roi.center;
        const time = Date.now() * 0.002;
        
        // Create branching vessel pattern
        const vessels = [
            // Main central vessel
            { 
                path: [
                    { x: center.x, y: center.y - 25 },
                    { x: center.x - 5, y: center.y - 10 },
                    { x: center.x, y: center.y },
                    { x: center.x + 5, y: center.y + 10 },
                    { x: center.x, y: center.y + 25 }
                ],
                width: 2.5
            },
            // Left branch
            {
                path: [
                    { x: center.x - 5, y: center.y - 10 },
                    { x: center.x - 20, y: center.y - 15 },
                    { x: center.x - 30, y: center.y - 5 },
                    { x: center.x - 25, y: center.y + 5 }
                ],
                width: 1.8
            },
            // Right branch
            {
                path: [
                    { x: center.x + 5, y: center.y + 10 },
                    { x: center.x + 20, y: center.y + 5 },
                    { x: center.x + 30, y: center.y - 5 },
                    { x: center.x + 25, y: center.y - 15 }
                ],
                width: 1.8
            },
            // Small capillaries
            {
                path: [
                    { x: center.x - 15, y: center.y - 20 },
                    { x: center.x - 10, y: center.y - 15 },
                    { x: center.x - 8, y: center.y - 8 }
                ],
                width: 1
            },
            {
                path: [
                    { x: center.x + 15, y: center.y - 18 },
                    { x: center.x + 12, y: center.y - 12 },
                    { x: center.x + 8, y: center.y - 5 }
                ],
                width: 1
            }
        ];
        
        vessels.forEach((vessel, index) => {
            // Add pulsing effect during recording
            let alpha = 0.8;
            if (window.vasoVueCore?.isRecording) {
                const phaseOffset = index * 0.5;
                alpha = 0.5 + 0.4 * Math.sin(time + phaseOffset);
            }
            
            this.ctx.strokeStyle = `rgba(220, 38, 127, ${alpha})`;
            this.ctx.lineWidth = vessel.width;
            
            this.ctx.beginPath();
            vessel.path.forEach((point, pointIndex) => {
                if (pointIndex === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            });
            this.ctx.stroke();
        });
        
        // Add blood flow particles effect during recording
        if (window.vasoVueCore?.isRecording) {
            this.drawFlowParticles(center, time);
        }
        
        this.ctx.restore();
    }
    
    drawFlowParticles(center, time) {
        this.ctx.save();
        
        // Small flowing particles
        for (let i = 0; i < 6; i++) {
            const angle = (time + i * 0.8) % (Math.PI * 2);
            const radius = 15 + 10 * Math.sin(time * 2 + i);
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            
            const alpha = 0.3 + 0.4 * Math.sin(time * 3 + i);
            this.ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    getCurrentFace() {
        return this.currentFace;
    }

    getCurrentROI() {
        if (!this.currentFace) return null;
        return this.extractForeheadROI(this.currentFace);
    }

    // Callback setters
    onFaceDetected(callback) {
        this.callbacks.onFaceDetected = callback;
    }

    onFaceLost(callback) {
        this.callbacks.onFaceLost = callback;
    }

    onROIUpdate(callback) {
        this.callbacks.onROIUpdate = callback;
    }
}

export default VasoVueMediaPipe;
