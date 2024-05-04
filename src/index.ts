import { App } from "./app"
import { fileStatusEnum } from "./interfaces/file"

const app = new App()
// app.scanFiles()
// app.recoverFile(
//     {
//         name: '00054262-9A29-4233-8C85-87FED4B236C0.mp4',
//         size: '1.31MB',
//         path: '/Volumes/Photo\ Bay/ios\ the\ origin.photoslibrary/originals/0/00054262-9A29-4233-8C85-87FED4B236C0.mp4',
//         fileStatus: fileStatusEnum.IN_PROGRESS,
//       }
// )

app.recoverFile(
    {
        "name": "04055328-5D02-47CD-9DE4-F901B0A68B7D.mov",
        "size": "1.68GB",
        "path": "/Volumes/Photo\ Bay/ios\ the\ origin.photoslibrary/originals/0/04055328-5D02-47CD-9DE4-F901B0A68B7D.mov",
        "fileStatus": fileStatusEnum.IN_PROGRESS
    },
)
// rsync --bwlimit=6250 --progress /Volumes/Photo\ Bay/ios\ the\ origin.photoslibrary/originals/0/04055328-5D02-47CD-9DE4-F901B0A68B7D.mov