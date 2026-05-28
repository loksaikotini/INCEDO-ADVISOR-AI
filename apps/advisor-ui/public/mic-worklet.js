/**
 * mic-worklet.js — AudioWorklet processor for microphone capture.
 * Converts Float32 PCM samples to Int16 PCM and posts them to the main thread.
 * Registered as 'mic-processor'.
 */
class MicProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    // Guard: inputs can be empty if no audio source is connected yet
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
    const int16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
    }

    // Transfer the buffer (zero-copy) to avoid blocking the audio thread
    this.port.postMessage(int16.buffer, [int16.buffer]);

    return true; // Keep processor alive
  }
}

registerProcessor('mic-processor', MicProcessor);
