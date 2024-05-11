export interface file {
    name: string;
    size: string | 'NAN';
    sizeInBytes: number | 0;
    path: string;
    fileStatus: fileStatusEnum;
    createdDate: Date | undefined;
    note?: string | undefined;
}

export enum fileStatusEnum {
    NOT_STARTED = 'NOT_STARTED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
    NOT_FOUND = 'NOT_FOUND'
}