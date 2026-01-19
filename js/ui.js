/**
 * UI Module - User interface controls and stats display
 */

/**
 * UI Manager class
 */
export class UIManager {
    constructor() {
        // Stats elements
        this.generationEl = document.getElementById('generation');
        this.timeEl = document.getElementById('time');
        this.aliveCountEl = document.getElementById('alive-count');
        this.bestFitnessEl = document.getElementById('best-fitness');
        this.avgFitnessEl = document.getElementById('avg-fitness');
        this.oldestCreatureEl = document.getElementById('oldest-creature');

        // Control elements
        this.btnStart = document.getElementById('btn-start');
        this.btnPause = document.getElementById('btn-pause');
        this.btnReset = document.getElementById('btn-reset');
        this.btnExport = document.getElementById('btn-export');
        this.btnImportTrigger = document.getElementById('btn-import-trigger');
        this.fileInput = document.getElementById('dna-import');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');
        this.popSlider = document.getElementById('pop-slider');
        this.popValue = document.getElementById('pop-value');

        // Info panel elements
        this.infoPanel = document.getElementById('info-panel');
        this.infoFoodBar = document.getElementById('info-food-bar');
        this.infoHealthBar = document.getElementById('info-health-bar');
        this.infoAge = document.getElementById('info-age');
        this.infoSegments = document.getElementById('info-segments');
        this.infoSensors = document.getElementById('info-sensors');
        this.infoLimbs = document.getElementById('info-limbs');
        this.infoSensorRange = document.getElementById('info-sensor-range');
        this.infoGrippers = document.getElementById('info-grippers');
        this.infoMemory = document.getElementById('info-memory');
        this.btnCloseInfo = document.getElementById('btn-close-info');

        // Event log elements
        this.logWindow = document.getElementById('event-log');
        this.logHeader = document.getElementById('log-window-header');
        this.logContent = document.getElementById('log-content');
        this.btnClearLog = document.getElementById('btn-clear-log');
        this.btnMinimizeLog = document.getElementById('btn-minimize-log');
        this.logEntries = [];
        this.maxLogEntries = 100; // Limit log size
        this.isMinimized = false;
        
        // Set up draggable window
        this.setupDraggableWindow();

        // State
        this.selectedCreature = null;
        this.callbacks = {};

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up UI event listeners
     */
    setupEventListeners() {
        this.btnStart.addEventListener('click', () => {
            this.callbacks.onStart?.();
        });

        this.btnPause.addEventListener('click', () => {
            this.callbacks.onPause?.();
        });

        this.btnReset.addEventListener('click', () => {
            this.callbacks.onReset?.();
        });

        this.speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.speedValue.textContent = `${speed}x`;
            this.callbacks.onSpeedChange?.(speed);
        });

        this.popSlider.addEventListener('input', (e) => {
            const pop = parseInt(e.target.value);
            this.popValue.textContent = pop;
            this.callbacks.onPopulationChange?.(pop);
        });

        this.btnExport.addEventListener('click', () => {
            this.callbacks.onExport?.();
        });

        this.btnImportTrigger.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const dna = JSON.parse(event.target.result);
                        this.callbacks.onImport?.(dna);
                    } catch (err) {
                        alert('Fout bij het laden van DNA bestand: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
        });

        this.btnCloseInfo.addEventListener('click', () => {
            this.selectCreature(null);
        });

        if (this.btnClearLog) {
            this.btnClearLog.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearLog();
            });
        }

        if (this.btnMinimizeLog) {
            this.btnMinimizeLog.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }
    }

    /**
     * Set up draggable window functionality
     */
    setupDraggableWindow() {
        if (!this.logHeader || !this.logWindow) return;

        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;

        this.logHeader.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons
            if (e.target.closest('.window-btn')) return;
            
            isDragging = true;
            initialX = e.clientX - currentX;
            initialY = e.clientY - currentY;
            this.logWindow.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            // Constrain to viewport
            const maxX = window.innerWidth - this.logWindow.offsetWidth;
            const maxY = window.innerHeight - this.logWindow.offsetHeight;
            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));

            this.logWindow.style.left = currentX + 'px';
            this.logWindow.style.top = currentY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.logWindow.style.cursor = '';
            }
        });
    }

    /**
     * Toggle minimize/maximize of log window
     */
    toggleMinimize() {
        if (!this.logWindow) return;
        this.isMinimized = !this.isMinimized;
        this.logWindow.classList.toggle('minimized', this.isMinimized);
        if (this.btnMinimizeLog) {
            this.btnMinimizeLog.textContent = this.isMinimized ? '+' : '−';
        }
    }

    /**
     * Register callback handlers
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    /**
     * Update stats display
     */
    updateStats(stats) {
        if (stats.generation !== undefined) {
            this.generationEl.textContent = stats.generation;
        }
        if (stats.time !== undefined) {
            this.timeEl.textContent = this.formatTime(stats.time);
        }
        if (stats.aliveCount !== undefined) {
            this.aliveCountEl.textContent = stats.aliveCount;
        }
        if (stats.bestFitness !== undefined) {
            this.bestFitnessEl.textContent = stats.bestFitness;
        }
        if (stats.avgFitness !== undefined) {
            this.avgFitnessEl.textContent = stats.avgFitness;
        }
        if (stats.oldestCreature !== undefined && this.oldestCreatureEl) {
            if (stats.oldestCreature) {
                const ageFormatted = this.formatTime(stats.oldestCreature.age);
                this.oldestCreatureEl.textContent = `#${stats.oldestCreature.id} (${ageFormatted})`;
            } else {
                this.oldestCreatureEl.textContent = '-';
            }
        }

        // Update selected creature info
        if (this.selectedCreature) {
            if (!this.selectedCreature.isAlive()) {
                this.selectCreature(null);
            } else {
                try {
                    const creature = this.selectedCreature;
                    const foodPercent = (creature.food / 200) * 100;
                    const healthPercent = (creature.health / 200) * 100;
                    if (this.infoFoodBar) {
                        this.infoFoodBar.style.width = `${Math.min(100, foodPercent)}%`;
                    }
                    if (this.infoHealthBar) {
                        this.infoHealthBar.style.width = `${Math.min(100, healthPercent)}%`;
                    }
                    if (this.infoAge) {
                        this.infoAge.textContent = `${creature.age.toFixed(1)}s`;
                    }
                    if (this.infoSegments) {
                        this.infoSegments.textContent = creature.dna.segments.length;
                    }
                    if (this.infoSensors) {
                        this.infoSensors.textContent = creature.dna.sensors?.length || 0;
                    }
                    
                    // Calculate and display gene details
                    if (this.infoLimbs) {
                        this.infoLimbs.textContent = creature.dna.joints?.length || 0;
                    }
                    
                    // Calculate average sensor range
                    if (this.infoSensorRange) {
                        if (creature.dna.sensors && creature.dna.sensors.length > 0) {
                            const avgRange = creature.dna.sensors.reduce((sum, s) => sum + (s.range || 0), 0) / creature.dna.sensors.length;
                            this.infoSensorRange.textContent = Math.round(avgRange);
                        } else {
                            this.infoSensorRange.textContent = '0';
                        }
                    }
                    
                    // Count gripper segments
                    if (this.infoGrippers) {
                        const gripperCount = creature.dna.segments.filter(s => s.isGripper).length;
                        this.infoGrippers.textContent = gripperCount;
                    }
                    
                    // Memory size
                    if (this.infoMemory) {
                        this.infoMemory.textContent = creature.dna.memorySize || 0;
                    }
                } catch (error) {
                    console.error('Error updating creature info:', error);
                }
            }
        }
    }

    /**
     * Select a creature to show details
     */
    selectCreature(creature) {
        this.selectedCreature = creature;
        if (creature) {
            this.infoPanel.style.display = 'block';
        } else {
            this.infoPanel.style.display = 'none';
        }
    }

    /**
     * Set running state (button states)
     */
    setRunning(running) {
        this.btnStart.disabled = running;
        this.btnPause.disabled = !running;

        if (running) {
            document.querySelector('.stats-panel').classList.add('running');
        } else {
            document.querySelector('.stats-panel').classList.remove('running');
        }
    }

    /**
     * Get current population slider value
     */
    getPopulationSize() {
        return parseInt(this.popSlider.value);
    }

    /**
     * Get current speed multiplier
     */
    getSpeedMultiplier() {
        return parseFloat(this.speedSlider.value);
    }

    /**
     * Add an entry to the event log
     * @param {string} message - Log message
     * @param {string} type - Log type ('starvation', 'kill', 'damage', 'death', 'birth')
     */
    addLogEntry(message, type = 'info') {
        if (!this.logContent) return;

        const entry = {
            message,
            type,
            timestamp: Date.now()
        };

        this.logEntries.push(entry);

        // Limit log size
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.shift();
        }

        this.updateLogDisplay();
    }

    /**
     * Update the log display
     */
    updateLogDisplay() {
        if (!this.logContent) return;

        this.logContent.innerHTML = '';

        // Show entries in reverse order (newest first)
        for (let i = this.logEntries.length - 1; i >= 0; i--) {
            const entry = this.logEntries[i];
            const logItem = document.createElement('div');
            logItem.className = `log-entry log-${entry.type}`;
            
            const time = new Date(entry.timestamp);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
            
            logItem.innerHTML = `<span class="log-time">${timeStr}</span> <span class="log-message">${entry.message}</span>`;
            this.logContent.appendChild(logItem);
        }
    }

    /**
     * Clear the event log
     */
    clearLog() {
        this.logEntries = [];
        if (this.logContent) {
            this.logContent.innerHTML = '';
        }
    }

    /**
     * Format time in seconds to human-readable format with months, weeks, days, hours, minutes, seconds
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
        const MONTH = 30 * 24 * 60 * 60; // 30 days
        const WEEK = 7 * 24 * 60 * 60;
        const DAY = 24 * 60 * 60;
        const HOUR = 60 * 60;
        const MINUTE = 60;

        const months = Math.floor(seconds / MONTH);
        seconds = seconds % MONTH;
        const weeks = Math.floor(seconds / WEEK);
        seconds = seconds % WEEK;
        const days = Math.floor(seconds / DAY);
        seconds = seconds % DAY;
        const hours = Math.floor(seconds / HOUR);
        seconds = seconds % HOUR;
        const minutes = Math.floor(seconds / MINUTE);
        const secs = Math.floor(seconds % MINUTE);

        const parts = [];
        if (months > 0) parts.push(`${months}${months === 1 ? ' maand' : ' maanden'}`);
        if (weeks > 0) parts.push(`${weeks}${weeks === 1 ? ' week' : ' weken'}`);
        if (days > 0) parts.push(`${days}${days === 1 ? ' dag' : ' dagen'}`);
        if (hours > 0) parts.push(`${hours}${hours === 1 ? ' uur' : ' uur'}`);
        if (minutes > 0) parts.push(`${minutes}${minutes === 1 ? ' min' : ' min'}`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}${secs === 1 ? ' sec' : ' sec'}`);

        // Show max 3 most significant units
        return parts.slice(0, 3).join(' ');
    }
}

export default UIManager;
