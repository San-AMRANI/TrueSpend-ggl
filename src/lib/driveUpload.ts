export const uploadToGoogleDrive = async (accessToken: string, fileBlob: Blob, filename: string): Promise<string> => {
  const metadata = {
    name: filename,
    mimeType: 'application/sql',
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileBlob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload file to Google Drive');
  }

  const result = await response.json();
  return result.id;
};
