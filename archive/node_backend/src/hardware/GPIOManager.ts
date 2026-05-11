import { spawn, ChildProcess, execSync } from 'child_process';

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
    console.log('[GPIO] Raspberry Pi 5 mimarisi için Python Köprüsü başlatılıyor...');
    
    // Eski süreçleri temizle
    try {
      execSync('pkill -f gpio_monitor.py');
      execSync('pkill gpiomon');
    } catch (e) {}
    
    // Sadece takılı olan Pin 17'yi başlat
    this.startMonitoring(17, 'input');
  }

  private lastTriggerTimes: Record<number, number> = {};

  private startMonitoring(pin: number, type: 'input' | 'output') {
    if (pin !== 17) return;

    const pythonPath = __dirname + '/gpio_monitor.py';
    const proc = spawn('python3', [pythonPath]);

    proc.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      
      if (msg.includes('DETECTED')) {
        const now = Date.now();
        if (this.lastTriggerTimes[pin] && (now - this.lastTriggerTimes[pin] < 1200)) {
          return;
        }
        this.lastTriggerTimes[pin] = now;
        
        console.log(`[GPIO] Pin ${pin} (Giriş Sensörü) Hareket Algılandı`);
        this.onInputDetected();
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`[GPIO Python Hatası]:`, data.toString());
    });

    proc.on('error', (err: any) => {
      console.error(`[GPIO Süreç Hatası]:`, err);
    });

    if (type === 'input') this.inputProcess = proc;
    else this.outputProcess = proc;
  }

  public triggerInputMock() {
    this.onInputDetected();
  }

  public triggerOutputMock() {
    this.onOutputDetected();
  }

  public cleanup() {
    if (this.inputProcess) this.inputProcess.kill();
    if (this.outputProcess) this.outputProcess.kill();
    try {
      execSync('pkill -f gpio_monitor.py');
    } catch (e) {}
  }
}
