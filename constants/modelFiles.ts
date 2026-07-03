import * as FileSystem from 'expo-file-system/legacy';

export type RequiredModelFile = {
    key: string;
    name: string;
    fileName: string;
    description: string;
    localPath: string;
    downloadUrl: string;
    required: boolean;
};

const MODEL_DIR = `${FileSystem.documentDirectory}models/`;

export const MODEL_DIRECTORY = MODEL_DIR;

export const REQUIRED_MODEL_FILES: RequiredModelFile[] = [
    {
        key: 'whisper',
        name: 'Whisper STT Model',
        fileName: 'ggml-tiny.en.bin',
        description: 'Speech to text model for converting your voice to English text.',
        localPath: `${MODEL_DIR}ggml-tiny.en.bin`,
        downloadUrl:
            'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
        required: true,
    },
    {
        key: 'llm',
        name: 'AI Conversation Model',
        fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
        description: 'Local AI model for simple English conversation.',
        localPath: `${MODEL_DIR}qwen2.5-0.5b-instruct-q4_k_m.gguf`,
        downloadUrl:
            'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true',
        required: true,
    }
];

export const getModelPath = (key: string) => {
    return REQUIRED_MODEL_FILES.find(file => file.key === key)?.localPath;
};