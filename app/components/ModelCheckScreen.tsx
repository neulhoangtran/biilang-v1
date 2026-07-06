import {
    MODEL_DIRECTORY,
    REQUIRED_MODEL_FILES,
    RequiredModelFile,
} from '@/constants/modelFiles';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type ModelCheckResult = RequiredModelFile & {
  exists: boolean;
  size?: number;
};

type Props = {
  onReady: () => void;
  autoContinue?: boolean;
};

export default function ModelCheckScreen({
  onReady,
  autoContinue = true,
}: Props) {
  const [isChecking, setIsChecking] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [results, setResults] = useState<ModelCheckResult[]>([]);

  const missingRequiredFiles = results.filter(
    file => file.required && !file.exists
  );

  const downloadableMissingFiles = missingRequiredFiles.filter(
    file => file.downloadUrl && file.downloadUrl.trim().length > 0
  );

  const existingFiles = results.filter(file => file.exists);

  const isBusy = isChecking || isDownloading || isDeleting;

  const formatSize = (size?: number) => {
    if (!size) return '-';

    const mb = size / 1024 / 1024;

    return `${mb.toFixed(1)} MB`;
  };

  const ensureModelDirectory = async () => {
    const dirInfo = await FileSystem.getInfoAsync(MODEL_DIRECTORY);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MODEL_DIRECTORY, {
        intermediates: true,
      });
    }
  };

  const checkModels = useCallback(async () => {
    setIsChecking(true);

    try {
      await ensureModelDirectory();

      const checkedFiles: ModelCheckResult[] = [];

      for (const modelFile of REQUIRED_MODEL_FILES) {
        const fileInfo = await FileSystem.getInfoAsync(modelFile.localPath, {
          size: true,
        });

        checkedFiles.push({
          ...modelFile,
          exists: fileInfo.exists,
          size: fileInfo.exists ? fileInfo.size : undefined,
        });
      }

      setResults(checkedFiles);

      const allRequiredFilesExist = checkedFiles
        .filter(file => file.required)
        .every(file => file.exists);

      if (allRequiredFilesExist && autoContinue) {
        onReady();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not check model files.');
    } finally {
      setIsChecking(false);
    }
  }, [autoContinue, onReady]);

  useEffect(() => {
    checkModels();
  }, [checkModels]);

  const downloadOneFile = async (
    file: ModelCheckResult,
    index: number,
    total: number
  ) => {
    setDownloadStatus(`Downloading ${file.name} (${index + 1}/${total})...`);
    setDownloadProgress(0);

    const tempPath = `${file.localPath}.tmp`;

    const tempInfo = await FileSystem.getInfoAsync(tempPath);

    if (tempInfo.exists) {
      await FileSystem.deleteAsync(tempPath, {
        idempotent: true,
      });
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      file.downloadUrl,
      tempPath,
      {},
      progress => {
        const totalBytes = progress.totalBytesExpectedToWrite || 1;
        const writtenBytes = progress.totalBytesWritten || 0;
        const percent = writtenBytes / totalBytes;

        setDownloadProgress(percent);
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      throw new Error(`Download failed: ${file.name}`);
    }

    const oldFileInfo = await FileSystem.getInfoAsync(file.localPath);

    if (oldFileInfo.exists) {
      await FileSystem.deleteAsync(file.localPath, {
        idempotent: true,
      });
    }

    await FileSystem.moveAsync({
      from: tempPath,
      to: file.localPath,
    });
  };

  const downloadRequiredModels = async () => {
    if (missingRequiredFiles.length === 0) {
      await checkModels();
      return;
    }

    if (downloadableMissingFiles.length === 0) {
      Alert.alert(
        'No download URL',
        'There are missing required files, but no download URL is configured.'
      );
      return;
    }

    const invalidUrlFile = downloadableMissingFiles.find(
      file =>
        !file.downloadUrl ||
        file.downloadUrl.includes('example.com') ||
        !file.downloadUrl.startsWith('http')
    );

    if (invalidUrlFile) {
      Alert.alert(
        'Download URL missing',
        `Please replace the downloadUrl for "${invalidUrlFile.name}" in constants/modelFiles.ts first.`
      );
      return;
    }

    setIsDownloading(true);

    try {
      await ensureModelDirectory();

      for (let i = 0; i < downloadableMissingFiles.length; i += 1) {
        await downloadOneFile(
          downloadableMissingFiles[i],
          i,
          downloadableMissingFiles.length
        );
      }

      setDownloadStatus('Download completed.');
      setDownloadProgress(1);

      await checkModels();
    } catch (error) {
      console.error(error);
      Alert.alert('Download failed', 'Could not download required model files.');
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteAllModels = async () => {
    Alert.alert(
      'Delete models',
      'Do you want to delete all downloaded model files?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);

            try {
              const dirInfo = await FileSystem.getInfoAsync(MODEL_DIRECTORY);

              if (dirInfo.exists) {
                await FileSystem.deleteAsync(MODEL_DIRECTORY, {
                  idempotent: true,
                });
              }

              await FileSystem.makeDirectoryAsync(MODEL_DIRECTORY, {
                intermediates: true,
              });

              setDownloadStatus('');
              setDownloadProgress(0);

              await checkModels();

              Alert.alert('Deleted', 'All model files have been deleted.');
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Could not delete model files.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const continueToHome = () => {
    const allRequiredFilesExist = results
      .filter(file => file.required)
      .every(file => file.exists);

    if (!allRequiredFilesExist) {
      Alert.alert(
        'Models missing',
        'Please download all required model files first.'
      );
      return;
    }

    onReady();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Biilang</Text>
      <Text style={styles.subtitle}>Preparing offline AI models</Text>

      <View style={styles.card}>
        {isChecking ? (
          <>
            <ActivityIndicator size="large" />
            <Text style={styles.checkingText}>Checking required files...</Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {missingRequiredFiles.length === 0
                ? 'All files are ready'
                : 'Missing required files'}
            </Text>

            <View style={styles.fileList}>
              {results.map(file => (
                <View key={file.key} style={styles.fileItem}>
                  <View style={styles.fileHeader}>
                    <Text style={styles.fileName}>{file.name}</Text>

                    <Text
                      style={[
                        styles.badge,
                        file.exists ? styles.readyBadge : styles.missingBadge,
                      ]}
                    >
                      {file.exists
                        ? 'Ready'
                        : file.required
                          ? 'Missing'
                          : 'Optional'}
                    </Text>
                  </View>

                  <Text style={styles.fileDescription}>{file.description}</Text>

                  <Text style={styles.fileMeta}>File: {file.fileName}</Text>

                  <Text style={styles.fileMeta}>
                    Required: {file.required ? 'Yes' : 'No'}
                  </Text>

                  <Text style={styles.fileMeta}>
                    Size: {formatSize(file.size)}
                  </Text>

                  <Text style={styles.fileMeta} numberOfLines={3}>
                    Path: {file.localPath}
                  </Text>
                </View>
              ))}
            </View>

            {missingRequiredFiles.length > 0 && (
              <>
                <Text style={styles.note}>
                  Required model files are missing. Download them once, then the
                  app can run offline.
                </Text>

                {isDownloading && (
                  <View style={styles.downloadBox}>
                    <Text style={styles.downloadStatus}>{downloadStatus}</Text>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.round(downloadProgress * 100)}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.downloadPercent}>
                      {Math.round(downloadProgress * 100)}%
                    </Text>
                  </View>
                )}

                <Pressable
                  style={[
                    styles.downloadButton,
                    isBusy && styles.disabledButton,
                  ]}
                  onPress={downloadRequiredModels}
                  disabled={isBusy}
                >
                  <Text style={styles.downloadButtonText}>
                    {isDownloading
                      ? 'Downloading...'
                      : 'Download Required Models'}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={[styles.button, isBusy && styles.disabledButton]}
              onPress={checkModels}
              disabled={isBusy}
            >
              <Text style={styles.buttonText}>Check Again</Text>
            </Pressable>

            {existingFiles.length > 0 && (
              <Pressable
                style={[styles.deleteButton, isBusy && styles.disabledButton]}
                onPress={deleteAllModels}
                disabled={isBusy}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete Models'}
                </Text>
              </Pressable>
            )}

            {missingRequiredFiles.length === 0 && (
              <Pressable style={styles.continueButton} onPress={continueToHome}>
                <Text style={styles.continueButtonText}>Continue to Chat</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 72,
    backgroundColor: '#f7f7f7',
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    textAlign: 'center',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  checkingText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  fileList: {
    gap: 12,
  },
  fileItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fafafa',
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
  },
  readyBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  missingBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  fileDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  fileMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  note: {
    fontSize: 14,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    lineHeight: 20,
  },
  downloadBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  downloadStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  downloadPercent: {
    fontSize: 13,
    color: '#1d4ed8',
    textAlign: 'right',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  downloadButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#991b1b',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  continueButton: {
    backgroundColor: '#111827',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});