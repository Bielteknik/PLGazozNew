import { Gpio } from 'onoff';

export class GPIOManager {
  private inputLaser: Gpio | null = null;
  private outputLaser: Gpio | null = null;
  
  // Callbacks
  public onInputDetected: () => void = () => {};
  public onOutputDetected: () => void = () => {};

  constructor() {
    this.initGPIO();
  }

  private initGPIO() {
    try {
      if (Gpio.accessible) {
        // Physical Pi pins: GPIO 17 for input, GPIO 27 for output
        this.inputLaser = new Gpio(17, 'in', 'falling', { debounceTimeout: 50 });
        this.outputLaser = new Gpio(27, 'in', 'falling', { debounceTimeout: 50 });

        this.inputLaser.watch((err, value) => {
          if (err) console.error('[GPIO] Input Laser error', err);
          else this.onInputDetected();
        });

        this.outputLaser.watch((err, value) => {
          if (err) console.error('[GPIO] Output Laser error', err);
          else this.onOutputDetected();
        });

        console.log('[GPIO] Hardware sensors initialized successfully.');
      } else {
        console.warn('[GPIO] Hardware not accessible (Running on Mac/Windows). Simulating sensors...');
      }
    } catch (e) {
      console.warn('[GPIO] Error initializing GPIO, falling back to simulation:', e);
    }
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
    if (this.inputLaser) this.inputLaser.unexport();
    if (this.outputLaser) this.outputLaser.unexport();
  }
}
