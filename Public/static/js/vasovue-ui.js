/**
 * VasoVue UI Management Module
 * Handles all user interface interactions and updates
 */

export class VasoVueUI {
    constructor() {
        this.elements = {};
        this.isInitialized = false;
        this.animationFrame = null;
        
        // UI state
        this.currentProgress = 0;
        this.targetSamples = 300;
        this.isSettingsOpen = false;
        
        // Modal states
        this.modals = {
            recording: false,
            success: false,
            loading: false
        };
    }

    initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('🎨 Initializing VasoVue UI...');
            
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize UI state
            this.initializeState();
            
            this.isInitialized = true;
            console.log('✅ VasoVue UI initialized');
            
        } catch (error) {
            console.error('❌ UI initialization failed:', error);
            throw error;
        }
    }

    cacheElements() {
        const elementIds = [
            'webcam', 'overlay', 'waveform', 'waveformPath',
            'startBtn', 'stopBtn', 'exportBtn', 'showReportBtn',
            'recordingIndicator', 'sampleCounter', 'sampleCount', 'sampleTarget',
            'progressBar', 'progressText', 'progressPercentage',
            'cameraStatus', 'faceStatus', 'fpsCounter', 'signalQuality',
            'settingsBtn', 'settingsPanel', 'closeSettings',
            'cameraSelect', 'sampleTargetInput', 'audioFeedback', 'showOverlays', 'showVessels',
            'recordingModal', 'modalStartBtn', 'modalCancelBtn',
            'successModal', 'exportSuccessBtn', 'newSessionBtn', 'closeSuccessBtn',
            'loadingSpinner'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
            if (!this.elements[id]) {
                console.warn(`⚠️ Element not found: ${id}`);
            }
        });
    }

    setupEventListeners() {
        // Main control buttons
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => {
                this.showRecordingModal();
            });
        }

        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => {
                this.onStopRecording();
            });
        }

        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => {
                this.onExportData();
            });
        }

        if (this.elements.showReportBtn) {
            this.elements.showReportBtn.addEventListener('click', () => {
                this.onShowReport();
            });
        }

        // Settings panel
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => {
                this.toggleSettings();
            });
        }

        if (this.elements.closeSettings) {
            this.elements.closeSettings.addEventListener('click', () => {
                this.closeSettings();
            });
        }

        // Recording modal
        if (this.elements.modalStartBtn) {
            this.elements.modalStartBtn.addEventListener('click', () => {
                this.hideRecordingModal();
                this.onStartRecording();
            });
        }

        if (this.elements.modalCancelBtn) {
            this.elements.modalCancelBtn.addEventListener('click', () => {
                this.hideRecordingModal();
            });
        }

        // Success modal
        if (this.elements.exportSuccessBtn) {
            this.elements.exportSuccessBtn.addEventListener('click', () => {
                this.onExportData();
            });
        }

        if (this.elements.newSessionBtn) {
            this.elements.newSessionBtn.addEventListener('click', () => {
                this.hideSuccessModal();
                this.onNewSession();
            });
        }

        if (this.elements.closeSuccessBtn) {
            this.elements.closeSuccessBtn.addEventListener('click', () => {
                this.hideSuccessModal();
            });
        }

        // Settings inputs
        if (this.elements.sampleTargetInput) {
            this.elements.sampleTargetInput.addEventListener('change', (e) => {
                this.onSampleTargetChange(parseInt(e.target.value));
            });
        }

        if (this.elements.audioFeedback) {
            this.elements.audioFeedback.addEventListener('change', (e) => {
                this.onAudioFeedbackChange(e.target.checked);
            });
        }

        if (this.elements.showOverlays) {
            this.elements.showOverlays.addEventListener('change', (e) => {
                this.onOverlayToggle(e.target.checked);
            });
        }

        if (this.elements.showVessels) {
            this.elements.showVessels.addEventListener('change', (e) => {
                this.onVesselToggle(e.target.checked);
            });
        }

        if (this.elements.cameraSelect) {
            this.elements.cameraSelect.addEventListener('change', (e) => {
                this.onCameraChange(e.target.value);
            });
        }

        // Click outside settings to close
        document.addEventListener('click', (e) => {
            if (this.isSettingsOpen && 
                !this.elements.settingsPanel?.contains(e.target) && 
                !this.elements.settingsBtn?.contains(e.target)) {
                this.closeSettings();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    initializeState() {
        // Set initial UI state
        this.updateProgress(0, this.targetSamples);
        this.updateStatus('camera', 'disconnected');
        this.updateStatus('face', 'not_detected');
        
        // Load settings from localStorage
        this.loadSettings();
    }

    // Modal management
    showRecordingModal() {
        this.modals.recording = true;
        if (this.elements.recordingModal) {
            this.elements.recordingModal.classList.remove('hidden');
        }
    }

    hideRecordingModal() {
        this.modals.recording = false;
        if (this.elements.recordingModal) {
            this.elements.recordingModal.classList.add('hidden');
        }
    }

    showSuccessModal() {
        this.modals.success = true;
        if (this.elements.successModal) {
            this.elements.successModal.classList.remove('hidden');
        }
    }

    hideSuccessModal() {
        this.modals.success = false;
        if (this.elements.successModal) {
            this.elements.successModal.classList.add('hidden');
        }
    }

    showLoadingSpinner(message = 'Loading...') {
        this.modals.loading = true;
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.classList.remove('hidden');
            const textElement = this.elements.loadingSpinner.querySelector('p');
            if (textElement) {
                textElement.textContent = message;
            }
        }
    }

    hideLoadingSpinner() {
        this.modals.loading = false;
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.classList.add('hidden');
        }
    }

    // Settings management
    toggleSettings() {
        if (this.isSettingsOpen) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    }

    openSettings() {
        this.isSettingsOpen = true;
        if (this.elements.settingsPanel) {
            this.elements.settingsPanel.classList.add('open');
        }
    }

    closeSettings() {
        this.isSettingsOpen = false;
        if (this.elements.settingsPanel) {
            this.elements.settingsPanel.classList.remove('open');
        }
    }

    // UI Updates
    updateProgress(current, target) {
        this.currentProgress = current;
        this.targetSamples = target;
        
        const percentage = Math.min(100, (current / target) * 100);
        
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percentage}%`;
            
            // Add glow effect when near completion
            if (percentage > 90) {
                this.elements.progressBar.classList.add('progress-glow');
            } else {
                this.elements.progressBar.classList.remove('progress-glow');
            }
        }
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${current} / ${target}`;
        }
        
        if (this.elements.progressPercentage) {
            this.elements.progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
        
        if (this.elements.sampleCount) {
            this.elements.sampleCount.textContent = current;
        }
        
        if (this.elements.sampleTarget) {
            this.elements.sampleTarget.textContent = target;
        }
    }

    updateWaveform(pathData) {
        if (this.elements.waveformPath) {
            this.elements.waveformPath.setAttribute('d', pathData);
        }
    }

    updateStatus(type, status) {
        const statusMap = {
            camera: {
                connected: { text: 'Connected', class: 'text-green-400' },
                disconnected: { text: 'Disconnected', class: 'text-red-400' },
                error: { text: 'Error', class: 'text-red-400' }
            },
            face: {
                detected: { text: 'Detected', class: 'text-green-400' },
                not_detected: { text: 'Not Detected', class: 'text-red-400' },
                lost: { text: 'Lost', class: 'text-yellow-400' }
            }
        };
        
        const element = this.elements[`${type}Status`];
        if (element && statusMap[type] && statusMap[type][status]) {
            const statusInfo = statusMap[type][status];
            element.textContent = statusInfo.text;
            element.className = statusInfo.class;
        }
    }

    updateFPS(fps) {
        if (this.elements.fpsCounter) {
            this.elements.fpsCounter.textContent = `${fps} FPS`;
        }
    }

    updateSignalQuality(quality) {
        if (this.elements.signalQuality) {
            this.elements.signalQuality.textContent = `${Math.round(quality)}%`;
            
            // Color code based on quality
            if (quality > 70) {
                this.elements.signalQuality.className = 'text-green-400';
            } else if (quality > 40) {
                this.elements.signalQuality.className = 'text-yellow-400';
            } else {
                this.elements.signalQuality.className = 'text-red-400';
            }
        }
    }

    // Recording state management
    setRecordingState(isRecording) {
        if (isRecording) {
            this.showElement(this.elements.stopBtn);
            this.showElement(this.elements.recordingIndicator);
            this.showElement(this.elements.sampleCounter);
            this.hideElement(this.elements.startBtn);
            this.hideElement(this.elements.exportBtn);
            this.hideElement(this.elements.showReportBtn);
        } else {
            this.hideElement(this.elements.stopBtn);
            this.hideElement(this.elements.recordingIndicator);
            this.showElement(this.elements.startBtn);
            this.showElement(this.elements.exportBtn);
        }
    }

    setSessionCompleted() {
        // Show additional buttons when session is completed
        this.showElement(this.elements.showReportBtn);
    }

    // Camera management
    populateCameraSelect(cameras) {
        if (!this.elements.cameraSelect) return;
        
        this.elements.cameraSelect.innerHTML = '<option value="">Default Camera</option>';
        
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `Camera ${index + 1}`;
            this.elements.cameraSelect.appendChild(option);
        });
    }

    // Utility methods
    showElement(element) {
        if (element) {
            element.classList.remove('hidden');
        }
    }

    hideElement(element) {
        if (element) {
            element.classList.add('hidden');
        }
    }

    // Settings persistence
    saveSettings() {
        const settings = {
            sampleTarget: this.targetSamples,
            audioFeedback: this.elements.audioFeedback?.checked || true,
            showOverlays: this.elements.showOverlays?.checked || true,
            showVessels: this.elements.showVessels?.checked || true
        };
        
        localStorage.setItem('vasoVueSettings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('vasoVueSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                
                if (this.elements.sampleTargetInput) {
                    this.elements.sampleTargetInput.value = settings.sampleTarget || 300;
                }
                if (this.elements.audioFeedback) {
                    this.elements.audioFeedback.checked = settings.audioFeedback !== false;
                }
                if (this.elements.showOverlays) {
                    this.elements.showOverlays.checked = settings.showOverlays !== false;
                }
                if (this.elements.showVessels) {
                    this.elements.showVessels.checked = settings.showVessels !== false;
                }
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    // Keyboard shortcuts
    handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                if (!this.modals.recording && !this.modals.success) {
                    this.showRecordingModal();
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (this.modals.recording) this.hideRecordingModal();
                if (this.modals.success) this.hideSuccessModal();
                if (this.isSettingsOpen) this.closeSettings();
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.onExportData();
                }
                break;
        }
    }

    // Event handlers (to be connected to main app)
    onStartRecording() {
        console.log('UI: Start recording requested');
    }

    onStopRecording() {
        console.log('UI: Stop recording requested');
    }

    onExportData() {
        console.log('UI: Export data requested');
    }

    onShowReport() {
        console.log('UI: Show report requested');
    }

    onNewSession() {
        console.log('UI: New session requested');
    }

    onSampleTargetChange(value) {
        console.log('UI: Sample target changed to', value);
        this.targetSamples = value;
        this.saveSettings();
    }

    onAudioFeedbackChange(enabled) {
        console.log('UI: Audio feedback changed to', enabled);
        this.saveSettings();
    }

    onOverlayToggle(enabled) {
        console.log('UI: Overlay toggle changed to', enabled);
        this.saveSettings();
    }

    onVesselToggle(enabled) {
        console.log('UI: Vessel toggle changed to', enabled);
        this.saveSettings();
    }

    onCameraChange(deviceId) {
        console.log('UI: Camera changed to', deviceId);
    }

    // Target reached handler
    onTargetReached() {
        this.setRecordingState(false);
        this.showSuccessModal();
    }
}

export default VasoVueUI;
