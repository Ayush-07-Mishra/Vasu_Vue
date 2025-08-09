class FaceDetection {
    constructor() {
        this.webcamElement = document.getElementById('webcam');
        this.canvasElement = document.getElementById('canvas');
        this.webcam = null;
        this.isModelLoaded = false;
        this.detectionInterval = null;
        this.detectionRate = 30;
        this.lastDetectionTime = 0;
        this.faceDetectionCount = 0;
        this.minFaceDetectionCount = 5;
        // Enhanced guidance features
        this.facePosition = { x: 0, y: 0, size: 0 };
        this.optimalPosition = { x: 320, y: 240, size: 150 }; // Center with ideal size
        this.showVesselLines = true;
        this.showDirectionGuidance = true;
    }

    async loadModels() {
        try {
            console.log('Loading face detection models...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/static/models')
            ]);
            this.isModelLoaded = true;
            console.log('Face detection models loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading models:', error);
            throw error;
        }
    }

    async startWebcam() {
        if (!this.isModelLoaded) {
            await this.loadModels();
        }

        return new Promise((resolve, reject) => {
            if (navigator.mediaDevices?.getUserMedia) {
                navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: 640, 
                        height: 480, 
                        facingMode: 'user',
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: false
                }).then(stream => {
                    this.webcamElement.srcObject = stream;
                    this.webcam = stream;
                    this.webcamElement.style.display = 'block'; // Ensure video is visible
                    this.webcamElement.addEventListener('loadedmetadata', () => {
                        this.canvasElement.width = this.webcamElement.videoWidth;
                        this.canvasElement.height = this.webcamElement.videoHeight;
                        console.log(`Webcam started at ${this.webcamElement.videoWidth}x${this.webcamElement.videoHeight}`);
                        resolve(true);
                    });
                }).catch(reject);
            } else {
                reject(new Error('Webcam not supported'));
            }
        });
    }

    async startDetection(onFaceDetected = null) {
        if (!this.webcam) {
            await this.startWebcam();
        }

        // Add this check to ensure video is ready
        await new Promise((resolve) => {
            if (this.webcamElement.readyState >= 3) { // HAVE_FUTURE_DATA
                resolve();
            } else {
                this.webcamElement.addEventListener('canplay', resolve, { once: true });
            }
        });

        const canvas = this.canvasElement;
        const displaySize = {
            width: this.webcamElement.videoWidth,
            height: this.webcamElement.videoHeight
        };
        faceapi.matchDimensions(canvas, displaySize);

        // Mirror the canvas to match the mirrored video
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        this.detectionInterval = setInterval(async () => {
            try {
                const now = Date.now();
                if (now - this.lastDetectionTime < 1000 / this.detectionRate) {
                    return;
                }
                this.lastDetectionTime = now;

                const detections = await faceapi.detectAllFaces(
                    this.webcamElement,
                    new faceapi.TinyFaceDetectorOptions()
                ).withFaceLandmarks();

                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Set canvas to be same size as video
                if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
                    canvas.width = displaySize.width;
                    canvas.height = displaySize.height;
                    this.optimalPosition.x = displaySize.width / 2;
                    this.optimalPosition.y = displaySize.height / 2;
                }

                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

                if (resizedDetections.length > 0) {
                    this.faceDetectionCount++;
                    const detection = resizedDetections[0];
                    
                    // Update face position
                    this.facePosition = {
                        x: detection.detection.box.x + detection.detection.box.width / 2,
                        y: detection.detection.box.y + detection.detection.box.height / 2,
                        size: detection.detection.box.width
                    };
                    
                    // Draw direction guidance
                    if (this.showDirectionGuidance) {
                        console.log('Drawing direction guidance');
                        this.drawDirectionGuidance(ctx);
                    }
                    
                    // Draw vessel lines visualization
                    if (this.showVesselLines) {
                        console.log('Drawing vessel lines');
                        this.drawVesselLines(ctx, detection.landmarks.positions);
                    }
                    
                    if (this.faceDetectionCount >= this.minFaceDetectionCount) {
                        const faceData = {
                            detected: true,
                            landmarks: detection.landmarks.positions,
                            boundingBox: detection.detection.box,
                            timestamp: Date.now(),
                            positionGuidance: this.getPositionGuidance()
                        };

                        try {
                            if (window.rPPG && typeof window.rPPG.extractForeheadROI === 'function') {
                                const roi = window.rPPG.extractForeheadROI(faceData.landmarks);
                                
                                if (roi && roi.x >= 0 && roi.y >= 0 && roi.width > 0 && roi.height > 0) {
                                    const greenMean = window.rPPG.extractGreenMean(ctx, roi);
                                    
                                    if (!isNaN(greenMean) && greenMean > 0) {
                                        faceData.rppgValue = greenMean;
                                        console.log(`Extracted rPPG value: ${greenMean.toFixed(2)}`);
                                        
                                        // Enhanced ROI visualization
                                        ctx.strokeStyle = 'lime';
                                        ctx.lineWidth = 2;
                                        ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
                                        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                                        ctx.fillRect(roi.x, roi.y, roi.width, roi.height);
                                    } else {
                                        console.warn('Invalid green mean value:', greenMean);
                                    }
                                } else {
                                    console.warn('Invalid ROI:', roi);
                                }
                            } else {
                                console.warn('rPPG module not available or extractForeheadROI function missing');
                            }
                        } catch (error) {
                            console.error('rPPG processing error:', error);
                        }

                        if (typeof onFaceDetected === 'function') {
                            onFaceDetected(faceData);
                        }
                    }
                } else {
                    this.faceDetectionCount = 0;
                    // Show guidance even when no face detected
                    if (this.showDirectionGuidance) {
                        this.drawNoFaceGuidance(ctx);
                    }
                    if (typeof onFaceDetected === 'function') {
                        onFaceDetected({ detected: false });
                    }
                }
            } catch (error) {
                console.error('Detection error:', error);
                if (typeof onFaceDetected === 'function') {
                    onFaceDetected({ detected: false, error: error.message });
                }
            }
        }, 1000 / this.detectionRate);
    }

    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
            console.log('Face detection stopped');
        }
        this.stopWebcam();
    }

    stopWebcam() {
        if (this.webcam) {
            this.webcam.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped webcam track:', track.kind);
            });
            this.webcamElement.srcObject = null;
            this.webcam = null;
        }
        
        const ctx = this.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    async getCurrentDetection() {
        if (!this.webcam || !this.isModelLoaded) return null;
        
        try {
            const detection = await faceapi.detectSingleFace(
                this.webcamElement,
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks();

            if (!detection) return null;

            return {
                landmarks: detection.landmarks.positions,
                boundingBox: detection.detection.box,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Detection error:', error);
            return null;
        }
    }

    // Enhanced feature: Direction guidance
    getPositionGuidance() {
        const deltaX = this.facePosition.x - this.optimalPosition.x;
        const deltaY = this.facePosition.y - this.optimalPosition.y;
        const deltaSize = this.facePosition.size - this.optimalPosition.size;
        
        const guidance = {
            horizontal: Math.abs(deltaX) > 50 ? (deltaX > 0 ? 'Move left' : 'Move right') : 'Good horizontal position',
            vertical: Math.abs(deltaY) > 40 ? (deltaY > 0 ? 'Move up' : 'Move down') : 'Good vertical position',
            distance: Math.abs(deltaSize) > 30 ? (deltaSize < 0 ? 'Move closer' : 'Move back') : 'Good distance',
            overall: Math.abs(deltaX) < 50 && Math.abs(deltaY) < 40 && Math.abs(deltaSize) < 30 ? 'Perfect position!' : 'Adjust position'
        };
        
        return guidance;
    }

    drawDirectionGuidance(ctx, faceBox) {
        // Save the current transformation
        ctx.save();
        
        // Reset transformation for drawing text correctly
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const guidance = this.getPositionGuidance();
        
        // Enhanced text styling
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvasElement.width, 120);
        
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 3;
        
        const instructions = [];
        
        // Corrected instructions for mirrored view
        if (guidance.horizontal.includes('left')) {
            instructions.push('Move your head to the LEFT');
        } else if (guidance.horizontal.includes('right')) {
            instructions.push('Move your head to the RIGHT');
        }
        
        if (guidance.vertical.includes('up')) {
            instructions.push('Move your head UP');
        } else if (guidance.vertical.includes('down')) {
            instructions.push('Move your head DOWN');
        }
        
        if (guidance.distance.includes('closer')) {
            instructions.push('Move CLOSER to camera');
        } else if (guidance.distance.includes('back')) {
            instructions.push('Move FARTHER from camera');
        }
        
        if (instructions.length === 0) {
            instructions.push('Perfect position! Hold steady');
        }
        
        instructions.forEach((instruction, index) => {
            const y = 35 + (index * 30);
            ctx.strokeText(instruction, this.canvasElement.width / 2, y);
            ctx.fillText(instruction, this.canvasElement.width / 2, y);
        });
        
        // Draw arrow indicators
        this.drawArrowGuidance(ctx, guidance);
        
        // Restore the transformation
        ctx.restore();
    }

    drawArrowGuidance(ctx, guidance) {
        // Save the current transformation
        ctx.save();
        
        // Reset transformation for drawing text and arrows correctly
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const centerX = this.canvasElement.width / 2;
        const centerY = this.canvasElement.height / 2;
        const arrowSize = 20;
        
        ctx.strokeStyle = 'yellow';
        ctx.fillStyle = 'yellow';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(255, 255, 0, 0.5)';
        ctx.shadowBlur = 5;
        
        // Horizontal arrows (corrected for mirrored view)
        if (guidance.horizontal.includes('left')) {
            // User needs to move left, so show arrow pointing left
            this.drawArrow(ctx, centerX - 120, centerY, centerX - 80, centerY, arrowSize);
            ctx.fillText('←', centerX - 140, centerY + 5);
        } else if (guidance.horizontal.includes('right')) {
            // User needs to move right, so show arrow pointing right
            this.drawArrow(ctx, centerX + 120, centerY, centerX + 80, centerY, arrowSize);
            ctx.fillText('→', centerX + 140, centerY + 5);
        }
        
        // Vertical arrows (these don't need mirroring)
        if (guidance.vertical.includes('up')) {
            this.drawArrow(ctx, centerX, centerY + 100, centerX, centerY + 60, arrowSize);
            ctx.fillText('↑', centerX, centerY + 130);
        } else if (guidance.vertical.includes('down')) {
            this.drawArrow(ctx, centerX, centerY - 100, centerX, centerY - 60, arrowSize);
            ctx.fillText('↓', centerX, centerY - 110);
        }
        
        // Distance indicators with better visualization
        if (guidance.distance.includes('closer')) {
            ctx.strokeStyle = 'cyan';
            ctx.fillStyle = 'cyan';
            this.drawPlusSign(ctx, centerX + 200, centerY - 200, 25);
            ctx.font = 'bold 14px Arial';
            ctx.fillText('CLOSER', centerX + 200, centerY - 160);
        } else if (guidance.distance.includes('back')) {
            ctx.strokeStyle = 'orange';
            ctx.fillStyle = 'orange';
            this.drawMinusSign(ctx, centerX + 200, centerY - 200, 25);
            ctx.font = 'bold 14px Arial';
            ctx.fillText('FARTHER', centerX + 200, centerY - 160);
        }
        
        // Restore the transformation
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    drawArrow(ctx, fromX, fromY, toX, toY, arrowSize) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    }

    drawPlusSign(ctx, x, y, size) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
    }

    drawMinusSign(ctx, x, y, size) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.stroke();
    }

    drawNoFaceGuidance(ctx) {
        ctx.fillStyle = 'red';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        
        const message = 'Position your face in the center';
        const x = this.canvasElement.width / 2;
        const y = this.canvasElement.height / 2;
        
        ctx.strokeText(message, x, y);
        ctx.fillText(message, x, y);
        
        // Draw optimal position circle
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.arc(this.optimalPosition.x, this.optimalPosition.y, this.optimalPosition.size / 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Enhanced feature: Vessel lines visualization
    drawVesselLines(ctx, landmarks) {
        if (!landmarks || landmarks.length < 68) return;
        
        // Save the current transformation
        ctx.save();
        
        // Reset transformation for drawing vessel lines correctly
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Extract key facial points for vessel mapping
        const foreheadPoints = this.getForeheadPoints(landmarks);
        const templePoints = this.getTemplePoints(landmarks);
        const cheekPoints = this.getCheekPoints(landmarks);
        
        // Draw simulated vessel network with more prominent lines
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        
        // Forehead vessels (horizontal patterns)
        this.drawVesselNetwork(ctx, foreheadPoints, 'horizontal');
        
        // Temple vessels (diagonal patterns)
        this.drawVesselNetwork(ctx, templePoints, 'diagonal');
        
        // Cheek vessels (curved patterns)
        this.drawVesselNetwork(ctx, cheekPoints, 'curved');
        
        // Draw pulsation effect (simulated)
        this.drawPulsationEffect(ctx, foreheadPoints);
        
        // Reset shadow and restore transformation
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    getForeheadPoints(landmarks) {
        // Approximate forehead region based on facial landmarks
        const eyebrowPoints = landmarks.slice(17, 27); // Eyebrow landmarks
        const foreheadHeight = 60; // Increased height for better visibility
        
        return eyebrowPoints.map((point, index) => ({
            x: point.x,
            y: point.y - foreheadHeight + (index * 3), // Varied height
            intensity: Math.random() * 0.5 + 0.5 // Simulated blood flow intensity
        }));
    }

    getTemplePoints(landmarks) {
        // Temple regions on sides of face
        const leftTemple = { x: landmarks[0].x - 20, y: landmarks[19].y };
        const rightTemple = { x: landmarks[16].x + 20, y: landmarks[24].y };
        
        return [leftTemple, rightTemple].map(point => ({
            ...point,
            intensity: Math.random() * 0.3 + 0.7
        }));
    }

    getCheekPoints(landmarks) {
        // Cheek regions
        const leftCheek = landmarks[2];
        const rightCheek = landmarks[14];
        
        return [leftCheek, rightCheek].map(point => ({
            x: point.x,
            y: point.y + 20,
            intensity: Math.random() * 0.4 + 0.6
        }));
    }

    drawVesselNetwork(ctx, points, pattern) {
        if (points.length < 2) return;
        
        ctx.beginPath();
        
        switch (pattern) {
            case 'horizontal':
                // Draw horizontal vessel lines across forehead
                for (let i = 0; i < points.length - 1; i += 2) {
                    if (points[i + 1]) {
                        ctx.moveTo(points[i].x, points[i].y);
                        ctx.lineTo(points[i + 1].x, points[i + 1].y);
                        // Add branching vessels
                        ctx.moveTo(points[i].x, points[i].y - 10);
                        ctx.lineTo(points[i].x + 20, points[i].y - 5);
                    }
                }
                break;
                
            case 'diagonal':
                // Draw diagonal vessel patterns at temples
                points.forEach(point => {
                    for (let j = 0; j < 4; j++) {
                        const startX = point.x + (j * 8);
                        const startY = point.y + (j * 4);
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(startX + 25, startY + 20);
                        // Add small branches
                        ctx.moveTo(startX + 12, startY + 10);
                        ctx.lineTo(startX + 18, startY + 5);
                    }
                });
                break;
                
            case 'curved':
                // Draw curved vessel patterns on cheeks
                points.forEach(point => {
                    // Main vessel
                    ctx.moveTo(point.x - 40, point.y);
                    ctx.quadraticCurveTo(point.x, point.y - 20, point.x + 40, point.y);
                    // Secondary vessels
                    ctx.moveTo(point.x - 30, point.y + 15);
                    ctx.quadraticCurveTo(point.x, point.y + 5, point.x + 30, point.y + 15);
                    // Small capillaries
                    for (let k = 0; k < 5; k++) {
                        const offsetX = (k - 2) * 15;
                        ctx.moveTo(point.x + offsetX, point.y - 10);
                        ctx.lineTo(point.x + offsetX, point.y + 10);
                    }
                });
                break;
        }
        
        ctx.stroke();
    }

    drawPulsationEffect(ctx, points) {
        const time = Date.now() * 0.005; // Slower pulsation
        const pulsation = Math.sin(time) * 0.4 + 0.8; // Simulate heartbeat (60-90 BPM)
        
        points.forEach((point, index) => {
            const radius = 4 * pulsation + (index % 2); // Varied radius
            const alpha = point.intensity * pulsation * 0.8;
            ctx.fillStyle = `rgba(255, 20, 20, ${alpha})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add glowing effect
            ctx.fillStyle = `rgba(255, 100, 100, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 1.5, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    // Toggle features
    toggleVesselLines() {
        this.showVesselLines = !this.showVesselLines;
        return this.showVesselLines;
    }

    toggleDirectionGuidance() {
        this.showDirectionGuidance = !this.showDirectionGuidance;
        return this.showDirectionGuidance;
    }
}

export default FaceDetection;
window.FaceDetection = FaceDetection;