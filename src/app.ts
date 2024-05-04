import { exec, spawn } from 'child_process';
import readline from 'node:readline';
import path from 'path';
import * as fs from 'fs';
import { file, fileStatusEnum } from './interfaces/file';
import { readFileSync } from 'fs';
import appConfig from './app-config.json';

export class App {
    init() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const menuArray = [
            { option: '1', text: 'Scan Folder' },
            { option: '2', text: 'Run Copy' },
        ];
        //         const menuOptionText =
        //             `MENU:
        // - Scan Folder: [1]
        // - Run Copy: [2]
        //     `;
        const menuOptionText = menuArray.map((menu) => {
            return `${menu.text}: [${menu.option}]`;
        }).join('\n');
        rl.question(menuOptionText, (option: String) => {
            switch (option) {
                case '1':
                    this.scanFiles();
                    rl.close();
                    break;
                case '2':
                    // this.recoverFile();
                    rl.close();
                    break;
                default:
                    console.log("Invalid option");
            }
        });
    }

    getFileSize(filePath: string) {
        var stats = fs.statSync(filePath)
        var fileSizeInBytes = stats.size;
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
        return formattedSize;
    }

    scanFiles() {
        const sourceFolder = appConfig.sourceFolder;
        console.log(`Scanning: ${sourceFolder}... `);
        exec(`find --progress ${sourceFolder} -type f | grep -v .DS_Store`, {
            maxBuffer: appConfig.maxBufferSize
        }, (err, stdout) => {
            if (err) {
                console.log("Error: ", err);
                return;
            }

            const lines = stdout.split('\n').filter(line => line !== '');

            var filePaths: file[] = [];

            filePaths = lines.map((line) => {
                const file: file = {
                    name: path.basename(line),
                    size: this.getFileSize(line),
                    path: line.replace(/ /g, '\\ '), // replace spaces with escape character
                    fileStatus: fileStatusEnum.NOT_STARTED,
                };

                return file;
            });


            console.log("Total files:", filePaths.length);

            // check if saves folder exists if not create it
            const logsFolder = appConfig.logsFolder;
            if (!fs.existsSync(logsFolder)) {
                fs.mkdirSync(logsFolder);
            }
            fs.createWriteStream(`${logsFolder + '/' + Date.now()}.json`, { flags: 'a' }).write(JSON.stringify(filePaths, null, 2));
        });
    }

    recoverFile(targetFile: file) {

        if (!fs.existsSync(targetFile.path)) {
            console.log("File does not exist, skipping...");
            return;
        }

        const destinationFolder = appConfig.destinationFolder;

        console.log(`Copying file: ${targetFile.name} to ${destinationFolder}`);

        if (!fs.existsSync(destinationFolder)) {
            console.log("Destination folder does not exist, creating it...");
            fs.mkdirSync(destinationFolder);
        }

        // exec(`rsync --progress --bwlimit=6250 ${targetFile.path} ./${destinationFolder}`, (err, stdout, stderr) => {
        //     if (err) {
        //         console.log("Error: ", err);
        //         return;
        //     }

        //     if (stdout) {
        //         console.log(`stdout: ${stdout}`);
        //     }

        //     if (stderr) {
        //         console.log(`stderr: ${stderr}`);
        //     }
        // });

        // check if file exists in target folder
    

        const rsyncProcess = spawn('rsync', ['--progress', `--bwlimit=${appConfig.bwLimit}`, targetFile.path, `./${destinationFolder}`]);

        // Capture stdout data
        rsyncProcess.stdout.on('data', (data) => {
            console.log(`progress: ${data}`);
        });

        // Capture stderr data (includes progress updates)
        rsyncProcess.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });

        // Handle process exit
        rsyncProcess.on('close', (code) => {
            console.log(`rsync process exited with code ${code}`);
        });

    }

}