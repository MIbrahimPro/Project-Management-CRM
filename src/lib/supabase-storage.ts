import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "devrolin-files";

export type StoragePath = 
  | `profile-pics/${string}`
  | `project-pdfs/${string}`
  | `chat-media/${string}`
  | `cv-files/${string}`
  | `photos/${string}`
  | `receipts/${string}`
  | `recordings/${string}`
  | `workspace-task-media/${string}`;

export async function uploadFile(
  buffer: Buffer,
  path: StoragePath,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
