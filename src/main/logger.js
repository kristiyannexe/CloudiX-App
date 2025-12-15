const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = app.getPath('userData');
        this.logFile = path.join(this.logDir, 'cloudix-app.log');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    writeToFile(formattedMessage) {
        try {
            fs.appendFileSync(this.logFile, formattedMessage + '\n', 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    info(message) {
        const formatted = this.formatMessage('info', message);
        console.log(formatted);
        this.writeToFile(formatted);
    }

    warn(message) {
        const formatted = this.formatMessage('warn', message);
        console.warn(formatted);
        this.writeToFile(formatted);
    }

    error(message) {
        const formatted = this.formatMessage('error', message);
        console.error(formatted);
        this.writeToFile(formatted);
    }

    debug(message) {
        const formatted = this.formatMessage('debug', message);
        console.debug(formatted);
        this.writeToFile(formatted);
    }
}

module.exports = new Logger();
