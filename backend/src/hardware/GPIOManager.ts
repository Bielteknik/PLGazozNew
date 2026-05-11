import { spawn, ChildProcess } from 'child_process';

export class GPIOManager {
  private inputProcess: ChildProcess | null = null;
  private outputProcess: ChildProcess | null = null;
  
  // Callbacks
  public onInputDetected: () => void = () => {};
  public onOutputDetected: () => void = () => {};

  constructor() {
    this.initGPIO();
  }

  private initGPIO() {
    console.log('[GPIO] Raspberry Pi 5 mimarisi için gpiomon başlatılıyor...');
    
    // Physical Pi pins: GPIO 17 for input, GPIO 27 for output
    // On Pi 5, the main header is on gpiochip4
    this.startMonitoring(17, 'input');
    this.startMonitoring(27, 'output');
  }

  private lastTriggerTimes: Record<number, number> = {};

  private startMonitoring(pin: number, type: 'input' | 'output') {
    // Sensör zaten 3V (High) verdiği için dahili pull-up direncini kaldırıyoruz.
    // Düşen kenar (falling) kullanarak cismin geldiği anı (3V -> 0V) yakalıyoruz.
    const proc = spawn('gpiomon', ['-e', 'falling', '--chip', 'gpiochip4', pin.toString()]);

    proc.stdout.on('data', () => {
      const now = Date.now();
      // 800ms'den daha hızlı gelen sinyalleri görmezden gel (Sert Gürültü Filtresi)
      if (this.lastTriggerTimes[pin] && (now - this.lastTriggerTimes[pin] < 800)) {
        return;
      }
      this.lastTriggerTimes[pin] = now;
      
      if (type === 'input') {
        console.log(`[GPIO] Pin ${pin} (Giriş Sensörü) Hareket Algılandı`);
        this.onInputDetected();
      } else {
        console.log(`[GPIO] Pin ${pin} (Çıkış Sensörü) Hareket Algılandı`);
        this.onOutputDetected();
      }
    });

    proc.stderr.on('data', (data) => {
      const err = data.toString();
      if (err.includes('invalid bias')) {
        // Eğer işletim sistemi sürümü pull-up desteklemezse yedek yönteme geç
        console.warn(`[GPIO Uyarı] Pin ${pin}: Pull-up direnci ayarlanamadı, bias olmadan tekrar deneniyor.`);
        this.startMonitoringSimple(pin, type);
        proc.kill();
      } else {
        console.error(`[GPIO Hatası] Pin ${pin}:`, err);
      }
    });

    proc.on('error', (err: any) => {
      if (err.code === 'ENOENT') {
        console.error('[GPIO] HATA: "gpiomon" komutu bulunamadı! Lütfen Pi 5 üzerinde "sudo apt install gpiod" çalıştırın.');
      } else {
        console.error(`[GPIO] Pin ${pin} izleme hatası:`, err);
      }
    });

    if (type === 'input') this.inputProcess = proc;
    else this.outputProcess = proc;
  }

  // Fallback method
  private startMonitoringSimple(pin: number, type: 'input' | 'output') {
    const proc = spawn('gpiomon', ['-e', 'falling', '--chip', 'gpiochip4', pin.toString()]);
    proc.stdout.on('data', () => {
       if (type === 'input') this.onInputDetected();
       else this.onOutputDetected();
    });
    if (type === 'input') this.inputProcess = proc;
    else this.outputProcess = proc;
  }

  // Simulated triggers for development/testing without hardware
  public triggerInputMock() {
    console.log('[GPIO MOCK] Input Detected');
    this.onInputDetected();
  }

  public triggerOutputMock() {
    console.log('[GPIO MOCK] Output Detected');
    this.onOutputDetected();
  }

  public cleanup() {
    if (this.inputProcess) this.inputProcess.kill();
    if (this.outputProcess) this.outputProcess.kill();
    console.log('[GPIO] İzleme süreçleri sonlandırıldı.');
  }
}
