/**
 * Local TTS engine — wraps Piper TTS (primary) and macOS `say` (fallback).
 * Self-contained within the slideshow extension; no cloud dependencies.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LocalTtsProvider = "piper" | "say" | "none";

export type LocalTtsConfig = {
  provider?: LocalTtsProvider | "auto";
  piper?: {
    binaryPath?: string;
    modelPath?: string;
    speakerId?: number;
    lengthScale?: number;
    sentenceSilence?: number;
  };
  say?: {
    voice?: string;
    rate?: number;
  };
};

export type LocalTtsResult = {
  success: boolean;
  audioPath?: string;
  durationMs?: number;
  error?: string;
  provider?: LocalTtsProvider;
};

let cachedProvider: LocalTtsProvider | undefined;

/**
 * Auto-detect available TTS provider: try Piper first, then macOS `say`, else `"none"`.
 */
export async function detectProvider(config?: LocalTtsConfig): Promise<LocalTtsProvider> {
  if (config?.provider && config.provider !== "auto") {
    return config.provider;
  }

  if (cachedProvider !== undefined) return cachedProvider;

  // Try Piper
  const piperBin = config?.piper?.binaryPath ?? "piper";
  try {
    await execFileAsync(piperBin, ["--version"], { timeout: 5000 });
    cachedProvider = "piper";
    return "piper";
  } catch {
    // Piper not available
  }

  // Try macOS `say`
  if (os.platform() === "darwin") {
    try {
      await execFileAsync("say", ["--version"], { timeout: 5000 });
      cachedProvider = "say";
      return "say";
    } catch {
      // `say --version` may error but the command may still exist
      try {
        await execFileAsync("which", ["say"], { timeout: 3000 });
        cachedProvider = "say";
        return "say";
      } catch {
        // say not available
      }
    }
  }

  cachedProvider = "none";
  return "none";
}

/**
 * Reset cached provider detection (useful for testing).
 */
export function resetProviderCache(): void {
  cachedProvider = undefined;
}

/**
 * Synthesize text to a WAV file using the configured or auto-detected provider.
 */
export async function synthesize(
  text: string,
  outputPath: string,
  config?: LocalTtsConfig,
): Promise<LocalTtsResult> {
  if (!text.trim()) {
    return { success: false, error: "Empty text" };
  }

  const provider = await detectProvider(config);
  if (provider === "none") {
    return { success: false, error: "No TTS provider available", provider: "none" };
  }

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    if (provider === "piper") {
      return await piperSynthesize(text, outputPath, config);
    } else {
      return await saySynthesize(text, outputPath, config);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, provider };
  }
}

/**
 * Synthesize with Piper TTS: `echo text | piper --model X --output_file out.wav`
 */
async function piperSynthesize(
  text: string,
  outputPath: string,
  config?: LocalTtsConfig,
): Promise<LocalTtsResult> {
  const piperBin = config?.piper?.binaryPath ?? "piper";
  const modelPath = config?.piper?.modelPath;

  if (!modelPath) {
    return {
      success: false,
      error: "Piper requires a model path (piper.modelPath)",
      provider: "piper",
    };
  }

  const args = ["--model", modelPath, "--output_file", outputPath];
  if (config?.piper?.speakerId !== undefined) {
    args.push("--speaker", String(config.piper.speakerId));
  }
  if (config?.piper?.lengthScale !== undefined) {
    args.push("--length-scale", String(config.piper.lengthScale));
  }
  if (config?.piper?.sentenceSilence !== undefined) {
    args.push("--sentence-silence", String(config.piper.sentenceSilence));
  }

  await new Promise<void>((resolve, reject) => {
    const proc = execFile(piperBin, args, { timeout: 60000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    if (proc.stdin) {
      proc.stdin.write(text);
      proc.stdin.end();
    }
  });

  const durationMs = await getAudioDuration(outputPath);
  return { success: true, audioPath: outputPath, durationMs, provider: "piper" };
}

/**
 * Synthesize with macOS `say`: `say -o tmp.aiff "text"` → `ffmpeg` convert to WAV.
 */
async function saySynthesize(
  text: string,
  outputPath: string,
  config?: LocalTtsConfig,
): Promise<LocalTtsResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-say-"));
  const aiffPath = path.join(tmpDir, "narration.aiff");

  try {
    const sayArgs = ["-o", aiffPath];
    if (config?.say?.voice) {
      sayArgs.push("-v", config.say.voice);
    }
    if (config?.say?.rate) {
      sayArgs.push("-r", String(config.say.rate));
    }
    sayArgs.push(text);

    await execFileAsync("say", sayArgs, { timeout: 60000 });

    // Convert AIFF to WAV via ffmpeg
    await execFileAsync(
      "ffmpeg",
      ["-i", aiffPath, "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1", "-y", outputPath],
      { timeout: 30000 },
    );

    const durationMs = await getAudioDuration(outputPath);
    return { success: true, audioPath: outputPath, durationMs, provider: "say" };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Get audio file duration in milliseconds using ffprobe.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 10000 },
    );

    const seconds = parseFloat(stdout.trim());
    if (isNaN(seconds)) return 0;
    return Math.round(seconds * 1000);
  } catch {
    return 0;
  }
}
