import { getModelPath } from '@/constants/modelFiles';
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, LlamaContext } from 'llama.rn';

let llamaContext: LlamaContext | null = null;
let loadingPromise: Promise<LlamaContext> | null = null;

const SYSTEM_PROMPT = `
You are Biilang, a friendly English speaking partner for beginners.

Your job:
- Have a simple English conversation with the user.
- Reply naturally like a real speaking partner.
- Keep replies short and easy to understand.
- Ask one simple follow-up question.

Rules:
- Reply in English only.
- Do not use labels.
- Do not write notes.
- Do not write explanations.
- Do not write anything inside brackets.
- Do not say "End of greeting".
- Do not say "Follow-up question".
- Do not correct grammar unless the user asks.
`.trim();

export async function loadLocalAiModel(): Promise<LlamaContext> {
  if (llamaContext) {
    return llamaContext;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const modelPath = getModelPath('llm');

  if (!modelPath) {
    throw new Error('LLM model path not found.');
  }

  const fileInfo = await FileSystem.getInfoAsync(modelPath, {
    size: true,
  });

  console.log('LLM MODEL CHECK:', {
    modelPath,
    exists: fileInfo.exists,
    size: fileInfo.exists ? fileInfo.size : 0,
  });

  if (!fileInfo.exists) {
    throw new Error(`LLM model file does not exist: ${modelPath}`);
  }

  if (!fileInfo.size || fileInfo.size < 1024 * 1024) {
    throw new Error(
      `LLM model file is too small or invalid. Size: ${fileInfo.size}`
    );
  }

  loadingPromise = initLlama({
    model: modelPath,
    n_ctx: 1024,
    n_threads: 4,
    n_gpu_layers: 0,
  });

  try {
    llamaContext = await loadingPromise;
    return llamaContext;
  } finally {
    loadingPromise = null;
  }
}

function buildPrompt(userMessage: string) {
  return `
<|im_start|>system
${SYSTEM_PROMPT}
<|im_end|>
<|im_start|>user
${userMessage}
<|im_end|>
<|im_start|>assistant
`.trim();
}

function cleanAiReply(text: string) {
  let cleaned = text.trim();

  cleaned = cleaned.replace(/<\|im_start\|>/g, '');
  cleaned = cleaned.replace(/<\|im_end\|>/g, '');
  cleaned = cleaned.replace(/<\|endoftext\|>/g, '');

  cleaned = cleaned.replace(/\[End of greeting\]/gi, '');
  cleaned = cleaned.replace(/\(Follow-up question\)/gi, '');
  cleaned = cleaned.replace(/\[Follow-up question\]/gi, '');
  cleaned = cleaned.replace(/Follow-up question:/gi, '');
  cleaned = cleaned.replace(/Assistant:/gi, '');
  cleaned = cleaned.replace(/^Biilang:/gi, '');

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export async function generateLocalAiReply(userMessage: string): Promise<string> {
  const context = await loadLocalAiModel();

  const result = await context.completion({
    prompt: buildPrompt(userMessage),
    n_predict: 80,
    temperature: 0.6,
    top_p: 0.9,
    stop: [
      '<|im_end|>',
      '<|im_start|>',
      '<|endoftext|>',
      'User:',
      'user:',
      'System:',
      'system:',
    ],
  });

  const rawText =
    typeof result === 'string'
      ? result
      : result?.text ?? '';

  const reply = cleanAiReply(rawText);

  return reply || 'Can you tell me more?';
}

export async function releaseLocalAiModel() {
  if (!llamaContext) {
    return;
  }

  await llamaContext.release();
  llamaContext = null;
}