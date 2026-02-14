import { supabase } from '@/api/supabaseClient'

const DEFAULT_BUCKET = 'job-attachments'

const safeFileName = (name = '') => {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || 'file'
}

const FIELD_LABELS = {
  userId: 'מזהה משתמש',
  jobId: 'מזהה עבודה',
  file: 'קובץ',
  bucket: 'דלי אחסון',
  objectPath: 'נתיב אובייקט',
  attachmentId: 'מזהה קובץ מצורף'
}

const assertRequired = (field, value) => {
  if (!value) {
    const label = FIELD_LABELS[field] || field
    throw new Error(`חסר ערך בשדה ${label}`)
  }
}

export async function uploadJobAttachment({ userId, jobId, file }) {
  assertRequired('userId', userId)
  assertRequired('jobId', jobId)
  if (!file) throw new Error('חסר קובץ להעלאה')

  const bucket = DEFAULT_BUCKET
  const timestamp = Date.now()
  const fileName = safeFileName(file.name)
  const objectPath = `${userId}/${jobId}/${timestamp}_${fileName}`

  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(objectPath, file, { contentType: file.type || undefined, upsert: false })

  if (uploadError) {
    throw new Error(`העלאה נכשלה: ${uploadError.message}`)
  }

  // DB impact: none (UI localization only; schema and query shape unchanged).
  const { data: attachment, error: insertError } = await supabase
    .from('attachments')
    .insert([{
      owner_id: userId,
      job_id: jobId,
      provider: 'supabase',
      bucket,
      object_path: objectPath,
      file_name: file.name || null,
      mime_type: file.type || null,
      size_bytes: typeof file.size === 'number' ? file.size : null
    }])
    .select('*')
    .single()

  if (insertError) {
    throw new Error(`שמירת קובץ מצורף נכשלה: ${insertError.message}`)
  }

  return attachment
}

export async function getJobAttachmentSignedUrl({ bucket, objectPath, expiresIn = 3600 }) {
  assertRequired('bucket', bucket)
  assertRequired('objectPath', objectPath)

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn)

  if (error) {
    throw new Error(`יצירת קישור חתום נכשלה: ${error.message}`)
  }

  return data?.signedUrl
}

export async function listJobAttachments({ userId, jobId }) {
  assertRequired('userId', userId)
  assertRequired('jobId', jobId)

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('owner_id', userId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`טעינת קבצים מצורפים נכשלה: ${error.message}`)
  }

  return data || []
}

export async function deleteJobAttachment({ userId, attachmentId }) {
  assertRequired('userId', userId)
  assertRequired('attachmentId', attachmentId)

  const { data: attachment, error: fetchError } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('owner_id', userId)
    .single()

  if (fetchError) {
    throw new Error(`טעינת קובץ מצורף נכשלה: ${fetchError.message}`)
  }

  const { error: storageError } = await supabase
    .storage
    .from(attachment.bucket)
    .remove([attachment.object_path])

  if (storageError) {
    throw new Error(`מחיקה מאחסון נכשלה: ${storageError.message}`)
  }

  const { error: deleteError } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('owner_id', userId)

  if (deleteError) {
    throw new Error(`מחיקת קובץ מצורף נכשלה: ${deleteError.message}`)
  }

  return true
}
