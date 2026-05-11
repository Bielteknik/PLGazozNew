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

  private startMonitoring(pin: number, type: 'input' | 'output') {
    // Pi 5 için çip ismini 'gpiochip4' olarak tam belirtiyoruz.
    // gpiomon -e falling -b none --chip gpiochip4 [pin]
    const proc = spawn('gpiomon', ['-e', 'falling', '--chip', 'gpiochip4', pin.toString()]);

    proc.stdout.on('data', () => {
      console.log(`[GPIO] Pin ${pin} (${type}) üzerinde fiziksel hareket algılandı!`);
      if (type === 'input') this.onInputDetected();
      else this.onOutputDetected();
    });

    proc.stderr.on('data', (data) => {
      console.error(`[GPIO Error] Pin ${pin}:`, data.toString());
    });

    proc.on('error', (err: any) => {
      if (err.code === 'ENOENT') {
        console.error('[GPIO] HATA: "gpiomon" bulunamadı! Lütfen Pi 5 üzerinde "sudo apt install gpiod" komutunu çalıştırın.');
      } else {
        console.error(`[GPIO] Pin ${pin} izleme hatası:`, err);
      }
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
