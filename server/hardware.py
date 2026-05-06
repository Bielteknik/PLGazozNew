import time
import serial
import serial.tools.list_ports
try:
    import RPi.GPIO as GPIO
except ImportError:
    # Fallback for non-Pi environments (development)
    class MockGPIO:
        BCM = 'BCM'
        IN = 'IN'
        OUT = 'OUT'
        PUD_UP = 'PUD_UP'
        LOW = 0
        HIGH = 1
        @staticmethod
        def setmode(mode): pass
        @staticmethod
        def setwarnings(flag): pass
        @staticmethod
        def setup(pin, mode, pull_up_down=None): pass
        @staticmethod
        def input(pin): return 1
        @staticmethod
        def output(pin, val): pass
    GPIO = MockGPIO()

class HardwareManager:
    def __init__(self):
        self.active_nanos = {}
        self.port_mapping = {} # {'NANO-1': '/dev/ttyUSB0', ...}
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
        except Exception as e:
            print(f"GPIO Initialization Error: {e}")

    def scan_ports(self):
        ports = serial.tools.list_ports.comports()
        # Returns a list of dicts with more info
        return [{"device": p.device, "description": p.description, "hwid": p.hwid} for p in ports]

    def get_port_for_id(self, nano_id: str):
        """
        Dinamik port eşleşmesini döndürür. 
        Eğer eşleşme yoksa (Windows/Mac uyumluluğu için) portun kendisini döner.
        """
        return self.port_mapping.get(nano_id, nano_id)

    def set_port_mapping(self, mapping: dict):
        self.port_mapping = mapping
        print(f"Hardware: Port mapping updated: {mapping}")

    def set_valve(self, port_or_id: str, valve_id: int, state: bool):
        port = self.get_port_for_id(port_or_id)
        cmd = f"V{valve_id}_{'ON' if state else 'OFF'}"
        return self.send_serial(port, cmd)

    def set_gate(self, port_or_id: str, gate_id: int, position: int):
        port = self.get_port_for_id(port_or_id)
        cmd = f"G{gate_id}_POS_{position}"
        return self.send_serial(port, cmd)

    def read_sensor(self, pin: int):
        try:
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            return GPIO.input(pin) == GPIO.LOW
        except Exception:
            return False

    def sync_gate_config(self, gate: dict):
        port = self.get_port_for_id(gate.get('nanoId', 'NANO-1'))
        cmd = f"CONF_G:{gate.get('id', 1)}:{gate.get('pin', '')}:{gate.get('dirPin', '')}:{gate.get('enablePin', '')}:{gate.get('speed', 1000)}:{gate.get('acceleration', 500)}"
        return self.send_serial(port, cmd)

    def sync_valve_config(self, valve: dict):
        port = self.get_port_for_id(valve.get('nanoId', 'NANO-2'))
        v_type = 1 if valve.get('relayType') == 'NC' else 0
        cmd = f"CONF_V:{valve.get('id')}:{valve.get('pin', '')}:{v_type}"
        return self.send_serial(port, cmd)

    def send_serial(self, port: str, command: str, baud=115200):
        # Eğer port ismi boşsa veya 'NANO' ile başlıyorsa ve mapping yoksa pas geç
        if not port or port.startswith('NANO'):
            # print(f"Serial: Skipping unmapped port {port}")
            return False
            
        try:
            if port not in self.active_nanos:
                # Pi 5 üzerinde bazen port meşgul olabilir, kısa bir bekleme ve tekrar deneme eklenebilir
                self.active_nanos[port] = serial.Serial(port, baud, timeout=0.1)
                time.sleep(1) # Arduinonun resetlenmesi için bekle
            
            ser = self.active_nanos[port]
            ser.write(f"{command}\n".encode())
            return True
        except Exception as e:
            # Sadece bir kez hata yazdır
            print(f"Serial Error ({port}): {e}")
            if port in self.active_nanos:
                try:
                    self.active_nanos[port].close()
                except: pass
                del self.active_nanos[port]
            return False

hw = HardwareManager()
