/**
 * Gravador de áudio para transcrição de sessão.
 *
 * Captura PCM cru pela Web Audio API e monta WAV 16 kHz mono, em vez de usar
 * MediaRecorder: o Chrome grava em `audio/webm`, que NÃO está na lista de
 * formatos de áudio aceitos pelo Gemini (ver AudioContentMimeType em
 * @google/genai — wav/mp3/aiff/aac/ogg/flac/mpeg/m4a/l16/opus/alaw/mulaw), e
 * cada navegador escolhe um contêiner diferente. Gerando o WAV aqui o formato
 * fica sob nosso controle e igual em todos eles.
 *
 * O áudio é cortado em segmentos para serem transcritos um a um durante a
 * sessão: mantém cada requisição pequena (o limite de corpo da Vercel é
 * ~4,5 MB) e evita segurar quase uma hora de áudio na memória do dispositivo.
 */

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Cabeçalho RIFF/WAVE de 44 bytes + PCM 16-bit mono. */
function encodeWav(samples: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // tamanho do bloco fmt
  view.setUint16(20, 1, true); // PCM sem compressão
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // alinhamento de bloco
  view.setUint16(34, 16, true); // bits por amostra
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);

  return new Blob([buffer], { type: "audio/wav" });
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/**
 * Reamostragem linear com estado entre chamadas. O cursor fracionário e as
 * amostras não consumidas precisam sobreviver de um callback para o outro —
 * reamostrar cada bloco isoladamente deixaria um degrau audível a cada
 * 4096 amostras, porque a posição de leitura reiniciaria fora de fase.
 */
class LinearResampler {
  private cursor = 0;
  private leftover = new Float32Array(0);

  constructor(
    private readonly fromRate: number,
    private readonly toRate: number
  ) {}

  process(input: Float32Array): Float32Array {
    if (this.fromRate === this.toRate) return input;

    const src = this.leftover.length
      ? concatFloat32(this.leftover, input)
      : input;
    const ratio = this.fromRate / this.toRate;
    const out: number[] = [];

    let pos = this.cursor;
    while (Math.floor(pos) + 1 < src.length) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      out.push(src[idx] + (src[idx + 1] - src[idx]) * frac);
      pos += ratio;
    }

    const keepFrom = Math.min(Math.floor(pos), src.length);
    this.leftover = src.slice(keepFrom);
    this.cursor = pos - keepFrom;

    return Float32Array.from(out);
  }
}

function toInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

export type SessionRecorder = {
  /** Fecha o microfone e emite o último segmento (parcial), se houver. */
  stop: () => Promise<void>;
};

export type SessionRecorderOptions = {
  segmentSeconds: number;
  /** Chamado a cada segmento fechado, na ordem em que foram gravados. */
  onSegment: (wav: Blob, durationSeconds: number) => void;
};

export async function startSessionRecorder({
  segmentSeconds,
  onSegment,
}: SessionRecorderOptions): Promise<SessionRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Pedir 16 kHz direto ao AudioContext deixa a reamostragem (de melhor
  // qualidade) por conta do navegador; o LinearResampler abaixo só entra em
  // ação se ele ignorar o pedido e entregar outra taxa.
  const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  const resampler = new LinearResampler(context.sampleRate, TARGET_SAMPLE_RATE);
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);

  const segmentSamples = TARGET_SAMPLE_RATE * segmentSeconds;
  let pending: Int16Array[] = [];
  let pendingLength = 0;
  let stopped = false;

  function flush() {
    if (pendingLength === 0) return;
    const merged = new Int16Array(pendingLength);
    let offset = 0;
    for (const chunk of pending) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    pending = [];
    pendingLength = 0;
    onSegment(
      encodeWav(merged, TARGET_SAMPLE_RATE),
      merged.length / TARGET_SAMPLE_RATE
    );
  }

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const samples = toInt16(
      resampler.process(event.inputBuffer.getChannelData(0))
    );
    if (samples.length === 0) return;
    pending.push(samples);
    pendingLength += samples.length;
    if (pendingLength >= segmentSamples) flush();
  };

  // Ganho zero antes da saída: o ScriptProcessorNode só roda se estiver
  // conectado ao destino, mas mandar o microfone para os alto-falantes
  // causaria microfonia na sala do atendimento.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      mute.disconnect();
      for (const track of stream.getTracks()) track.stop();
      flush();
      await context.close();
    },
  };
}
