export interface file {
    name: string;
    size: string;
    path: string;
    fileStatus: fileStatusEnum;
    note?: string | undefined;
}

export enum fileStatusEnum {
    NOT_STARTED = 'NOT_STARTED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR'
}