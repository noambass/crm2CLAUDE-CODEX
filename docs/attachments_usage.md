# Attachments API usage (UI examples)

Below are short examples of how to use the storageProvider from UI code.

## 1) Upload from a file input
```js
import { uploadJobAttachment } from '@/lib/storage/storageProvider'

const onFileSelected = async (file, userId, jobId) => {
  const attachment = await uploadJobAttachment({ userId, jobId, file })
  console.log('uploaded', attachment)
}
```

## 2) List attachments
```js
import { listJobAttachments } from '@/lib/storage/storageProvider'

const loadAttachments = async (userId, jobId) => {
  const items = await listJobAttachments({ userId, jobId })
  console.log('attachments', items)
}
```

## 3) Get signed URL
```js
import { getJobAttachmentSignedUrl } from '@/lib/storage/storageProvider'

const toSignedUrl = async (attachment) => {
  return getJobAttachmentSignedUrl({
    bucket: attachment.bucket,
    objectPath: attachment.object_path,
    expiresIn: 3600
  })
}
```
