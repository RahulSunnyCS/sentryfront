export class FileValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export interface ValidatedMobileFile {
  buffer: Buffer;
  originalName: string;
  platform: 'apk' | 'ipa';
}

const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
// Both APK and IPA are ZIP-based: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export async function validateMobileFile(file: File): Promise<ValidatedMobileFile> {
  const name = file.name ?? 'upload';
  const ext = name.toLowerCase().split('.').pop();

  if (ext !== 'apk' && ext !== 'ipa') {
    throw new FileValidationError('Only .apk and .ipa files are accepted.');
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new FileValidationError('File too large. Maximum size is 100 MB.');
  }

  if (file.size < 4) {
    throw new FileValidationError(`Invalid ${ext.toUpperCase()} file.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    throw new FileValidationError(`Invalid ${ext.toUpperCase()} file format.`);
  }

  return { buffer, originalName: name, platform: ext as 'apk' | 'ipa' };
}
