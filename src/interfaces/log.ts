import { file } from "./file";

export interface log {
    name: string,
    totalSize: string,
    totalFiles: number,
    files: file[]
}