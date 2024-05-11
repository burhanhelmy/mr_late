import { exec, spawn } from 'child_process';
import readline from 'node:readline';
import path from 'path';
import * as fs from 'fs';
import { file, fileStatusEnum } from './interfaces/file';
import { readFileSync } from 'fs';
import appConfig from './app-config.json';
import Logger from '@ptkdev/logger';
import { log } from './interfaces/log';

export class App {

    logger = new Logger();
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    init() {

        const menuArray = [
            { option: '1', text: 'Generate log from app-config.json' },
            { option: '2', text: 'Run file recovery' },
        ];
        const menuOptionText = menuArray.map((menu) => {
            return `${menu.text}: [${menu.option}]`;
        }).join('\n');
        this.rl.question(menuOptionText, (option: String) => {
            switch (option) {
                case '1':
                    this.scanFiles();
                    console.clear();
                    this.init();
                    break;
                case '2':
                    this.selectLog();
                    break;
                default:
                    this.logger.info("Invalid option");
            }
        });
    }

    getFileInfo(filePath: string): { formattedSize: string, fileSizeInBytes: number, createdDate: Date } | undefined {
        if (!fs.existsSync(filePath)) {
            this.logger.error(`File does not exist: ${filePath}`);
            return;
        }
        try {
            var stats = fs.statSync(filePath)
            var fileSizeInBytes = stats.size;
            var createdDate = stats.birthtime;
            const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
            let formattedSize = '';
            if (fileSizeInMB >= 1024) {
                const fileSizeInGB = fileSizeInMB / 1024;
                formattedSize = `${fileSizeInGB.toFixed(2)}GB`;
            } else if (fileSizeInMB >= 1) {
                formattedSize = `${fileSizeInMB.toFixed(2)}MB`;
            } else {
                const fileSizeInKB = fileSizeInBytes / 1024;
                formattedSize = `${fileSizeInKB.toFixed(2)}KB`;
            }
            return { formattedSize, fileSizeInBytes, createdDate };
        }
        catch (e) {
            this.logger.error(`Error: ${e}`);
        }
    }

    updateCreatedDateOnLogs(log: log) {
        const files = log.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!fs.existsSync(file.path)) {
                this.logger.error(`File does not exist: ${file.path}`);
                continue;
            }
            const stats = fs.statSync(file.path);
            file.createdDate = stats.birthtime;
        }
        return log;
    }

    scanFiles() {
        const sourceFolder = appConfig.sourceFolder;

        if (sourceFolder === '' || !fs.existsSync(sourceFolder)) {
            this.logger.error(" Source folder does not exist, exiting. Please update app-config.json");
            return;
        }

        this.logger.warning(`👀 Scanning...`);
        exec(`find ${sourceFolder} -type f | grep -vE '\.(DS_Store|aae)$'`, {
            maxBuffer: appConfig.maxBufferSize
        }, (err, stdout) => {
            if (err) {
                this.logger.error(`Error: ${err}`);
                return;
            }

            const lines = stdout.split('\n').filter(line => line !== '');

            var files: file[] = [];

            files = lines.map((line) => {
                const fileInfo = this.getFileInfo(line);
                const file: file = {
                    name: path.basename(line),
                    createdDate: fileInfo?.createdDate,
                    size: fileInfo?.formattedSize || 'NAN',
                    sizeInBytes: fileInfo?.fileSizeInBytes || 0,
                    path: line,
                    fileStatus: fileStatusEnum.NOT_STARTED,
                };
                return file;
            }).sort((a, b) => a.sizeInBytes - b.sizeInBytes);

            const totalSize = (files.reduce((acc, file) => acc + file.sizeInBytes, 0) / (1024 * 1024 * 1024)).toFixed(2) + "GB"
            const totalFiles = files.length;

            console.table({
                sourceFolder,
                totalFiles,
                totalSize
            });

            const logsFolder = appConfig.logsFolder;

            if (!fs.existsSync(logsFolder)) {
                fs.mkdirSync(logsFolder);
            }

            const fileName = Date.now() + '.json';

            let logData = {
                name: fileName,
                totalSize,
                totalFiles,
                files,
            }

            logData = this.excludeOlderFileFromGivenDate(logData);
            logData = this.sortFileFromLatestToOldest(logData);
            logData = this.sortFileFromSmallToLarge(logData);

            this.logger.warning("⏳ Writing logs to file...");
            fs.createWriteStream(`${logsFolder + '/' + fileName}`, { flags: 'a' }).write(JSON.stringify(logData, null, 2));
            this.logger.info("✅ Log file written successfully");
        });
    }

    getBwLimit(file: file): number {
        const fileSize = file.size;
        let bwLimit = appConfig.maxBwLimit;
        if (fileSize.includes('GB')) {
            bwLimit = appConfig.maxBwLimit;
        } else if (fileSize.includes('KB')) {
            bwLimit = 0;
        } else if (fileSize.includes('MB')) {
            bwLimit = appConfig.maxBwLimit * 1.5;
        }
        return bwLimit;
    }

    listAllLogs() {
        const logsFolder = appConfig.logsFolder;
        const files = fs.readdirSync(logsFolder);
        console.table(files);
    }

    getLogStats(log: log) {
        console.clear();
        const logFiles = log.files;
        let totalFiles = 0;
        let completedFiles = 0;
        let notStartedFiles = 0;
        let totalSize = 0;
        let completedSize = 0;
        let notStartedSize = 0;
        let errorRate = 0;

        for (let i = 0; i < logFiles.length; i++) {
            const file = logFiles[i];
            totalFiles++;
            totalSize += file.sizeInBytes;

            if (file.fileStatus === fileStatusEnum.COMPLETED) {
                completedFiles++;
                completedSize += file.sizeInBytes;
            } else if (file.fileStatus === fileStatusEnum.NOT_STARTED) {
                notStartedFiles++;
                notStartedSize += file.sizeInBytes;
            } else if (file.fileStatus === fileStatusEnum.ERROR) {
                errorRate++;
            }
        }

        const completedSizeInGB = (completedSize / (1024 * 1024 * 1024)).toFixed(2) + "GB";
        const notStartedSizeInGB = (notStartedSize / (1024 * 1024 * 1024)).toFixed(2) + "GB";
        const recoverPercentage = ((completedFiles / totalFiles) * 100).toFixed(2) + "%";
        const totalSizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2) + "GB";
        const errorRatePercentage = ((errorRate / totalFiles) * 100).toFixed(2) + "%";

        return {
            recoverPercentage,
            errorRatePercentage,
            totalFiles,
            completedFiles,
            notStartedFiles,
            totalSize: totalSizeInGB,
            completedSize: completedSizeInGB,
            notStartedSize: notStartedSizeInGB,
        };
    }

    scanForDuplicateFiles(log: log) {
        this.logger.warning("👀 Scanning for duplicate files...");
        const files = log.files;
        const duplicateFiles = files.filter((file, index) => {
            return files.findIndex(f => f.name === file.name) !== index;
        });

        if (duplicateFiles.length === 0) {
            this.logger.info("✅ No duplicate files found");
            return;
        }
        console.table(duplicateFiles);
    }

    backupLog(log: log) {
        const logFilePath = `${appConfig.logsFolder}/${log.name}`;
        const backupFilePath = `${logFilePath}.bak`;
        fs.copyFileSync(logFilePath, backupFilePath);
    }

    saveLog(log: log) {
        const logsFolder = appConfig.logsFolder;
        const logData = {
            name: log.name,
            totalSize: log.totalSize,
            totalFiles: log.files.length,
            files: log.files
        }
        fs.writeFileSync(`${logsFolder}/${log.name}`, JSON.stringify(logData, null, 2));
    }

    selectLog() {
        this.listAllLogs();
        this.rl.question('Select log [index]: ', (logFileIndex: string) => {
            const logsFolder = appConfig.logsFolder;
            const files = fs.readdirSync(logsFolder);

            if (parseInt(logFileIndex) + 1 > files.length) {
                this.logger.error("Invalid log index, enter a valid index");
                this.selectLog();
                return;
            }

            const logFile = files[parseInt(logFileIndex)];
            const logData = JSON.parse(readFileSync(`${logsFolder}/${logFile}`, 'utf-8')) as log;
            console.table(this.getLogStats(logData));
            this.recoveryConfirmation(logData);
        });

    }

    recoveryConfirmation(log: log) {
        this.rl.question('Do you want to continue with recovery? [Y/N]: ', (answer: string) => {
            if (answer.toUpperCase() === 'Y') {
                this.recoverAllFiles(log);
            } else {
                this.rl.close();
            }
        });
    }

    async recoverAllFiles(log: log) {
        const files = log.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.fileStatus === fileStatusEnum.NOT_STARTED || file.fileStatus === fileStatusEnum.IN_PROGRESS) {

                try {
                    file.fileStatus = fileStatusEnum.IN_PROGRESS;
                    await this.recoverFile(file);
                    // check if source folder still exists before continuing
                    this.saveLog(log);
                } catch (error) {
                    this.saveLog(log);
                    this.logger.error(`🧨 Error recovering file: ${file.name}`);
                }

                if (!fs.existsSync(appConfig.sourceFolder)) {
                    this.logger.error("🧨 Source folder does not exist, exiting...");
                    break;
                }

                if (appConfig.delayBetweenCopies > 0) {
                    console.table(this.getLogStats(log));
                    this.logger.info(`😴 Delaying for ${appConfig.delayBetweenCopies}ms`);
                    await new Promise(resolve => setTimeout(resolve, appConfig.delayBetweenCopies));
                }
            }
        }
        this.logger.info("✅ Recovery completed");
        this.rl.close();
    }

    sortFileFromLatestToOldest(log: log) {
        const files = log.files;
        const sortedFiles = files.sort((a, b) => {
            if (a.createdDate && b.createdDate) {
                return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
            }
            return 0;
        });
        log.files = sortedFiles.reverse();
        return log;
    }

    excludeOlderFileFromGivenDate(log: log) {
        if (!appConfig.grabFileFromThisDate) {
            return log;
        }
        const date = new Date();
        const files = log.files;
        const filteredFiles = files.filter((file) => {
            if (file.createdDate) {
                return new Date(file.createdDate).getTime() >= date.getTime();
            }
            return false;
        });
        console.log('====================================');
        console.log(files.length, filteredFiles.length);
        console.log('====================================');
        log.files = filteredFiles;
        return log;
    }

    sortFileFromSmallToLarge(log: log) {
        const files = log.files;
        const sortedFiles = files.sort((a, b) => a.sizeInBytes - b.sizeInBytes);
        log.files = sortedFiles
        return log;
    }


    recoverFile(file: file): Promise<file> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(file.path)) {
                this.logger.error("File does not exist, skipping...");
                file.fileStatus = fileStatusEnum.NOT_FOUND;
                reject(file);
            }

            const destinationFolder = appConfig.destinationFolder;

            this.logger.info(`Copying ${file.size} file: ${file.path} to ${destinationFolder}`);

            if (!fs.existsSync(destinationFolder)) {
                this.logger.info("Destination folder does not exist, creating it...");
                fs.mkdirSync(destinationFolder);
            }

            const bwLimit = this.getBwLimit(file);

            const rsyncProcess = spawn('/usr/bin/rsync', ['--times', '--progress', '--inplace', `--bwlimit=${appConfig.maxBwLimit}`, file.path, `${destinationFolder}`]);

            rsyncProcess.stdout.on('data', (data) => {
                this.logger.info(`🎲 ${data}`);
            });

            // Capture stderr data (includes progress updates)
            rsyncProcess.stderr.on('data', (data) => {
                this.logger.error(`stderr: ${data}`);
                file.fileStatus = fileStatusEnum.ERROR;
                file.note = data.toString();
                reject(data);
            });

            // Handle process exit
            rsyncProcess.on('close', (code) => {
                this.logger.info(`✅ rsync process exited with code ${code}`);
                if (code === 0) {
                    this.logger.info(`💰 File copied successfully: ${file.name}`);
                    file.fileStatus = fileStatusEnum.COMPLETED;
                    resolve(file);
                }
            });

        });

    }

}