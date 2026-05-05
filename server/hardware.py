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
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

    def scan_ports(self):
        ports = serial.tools.list_ports.comports()
        return [p.device for p in ports]

    def set_valve(self, nano_port: str, valve_id: int, state: bool):
        """
        Nano 2'ye valf komutu gönderir. 
        Örn: 'V1_ON' veya 'V1_OFF'
        """
        cmd = f"V{valve_id}_{'ON' if state else 'OFF'}"
        return self.send_serial(nano_port, cmd)

    def set_gate(self, nano_port: str, gate_id: int, position: int):
        """
        Nano 1'e kilit (motor) komutu gönderir.
        Örn: 'G1_POS_100'
        """
        cmd = f"G{gate_id}_POS_{position}"
        return self.send_serial(nano_port, cmd)

    def read_sensor(self, pin: int):
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        return GPIO.input(pin) == GPIO.LOW

    def sync_gate_config(self, gate: dict):
        """Nano 1'e motor parametrelerini gönderir."""
        # Protokol: CONF_G:ID:PIN:DIR:ENA:SPEED:ACCEL
        cmd = f"CONF_G:{gate.get('id', 1)}:{gate.get('pin', '')}:{gate.get('dirPin', '')}:{gate.get('enablePin', '')}:{gate.get('speed', 1000)}:{gate.get('acceleration', 500)}"
        return self.send_serial(gate.get('nanoId', 'COM3'), cmd)

    def sync_valve_config(self, valve: dict):
        """Nano 2'ye valf pin ve röle tipini gönderir."""
        # Protokol: CONF_V:ID:PIN:TYPE(0:NO, 1:NC)
        v_type = 1 if valve.get('relayType') == 'NC' else 0
        cmd = f"CONF_V:{valve.get('id')}:{valve.get('pin', '')}:{v_type}"
        return self.send_serial(valve.get('nanoId', 'COM4'), cmd)

    def send_serial(self, port: str, command: str, baud=115200):
        try:
            if port not in self.active_nanos:
                self.active_nanos[port] = serial.Serial(port, baud, timeout=0.1)
            
            ser = self.active_nanos[port]
            ser.write(f"{command}\n".encode())
            return True
        except Exception as e:
            print(f"Serial Error ({port}): {e}")
            if port in self.active_nanos:
                del self.active_nanos[port]
            return False

hw = HardwareManager()
