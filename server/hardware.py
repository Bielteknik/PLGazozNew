import time
import serial
import serial.tools.list_ports
try:
    from gpiozero import Button
    PI_VERSION = 5
except ImportError:
    # Fallback for non-Pi environments (development)
    class Button:
        def __init__(self, pin, pull_up=True):
            self.pin = pin
            self.is_pressed = False
    PI_VERSION = 0

class HardwareManager:
    def __init__(self):
        self.active_nanos = {}
        self.port_mapping = {} # {'NANO-1': '/dev/ttyUSB0', ...}
        self.sensors_objs = {} # gpiozero nesnelerini saklar

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
            if pin not in self.sensors_objs:
                # Sensör nesnesi yoksa oluştur (Active Low/Pull-up varsayılan)
                self.sensors_objs[pin] = Button(pin, pull_up=True)
            return self.sensors_objs[pin].is_pressed
        except Exception:
            return False

    def sync_gate_config(self, gate: dict):
        port = self.get_port_for_id(gate.get('nanoId', 'NANO-1'))
        # FORMAT: CONF_G:ID:STEP:DIR:ENA:SPEED:ACCEL:OPEN:CLOSE
        cmd = f"CONF_G:{gate.get('id', 1)}:{gate.get('pin', '')}:{gate.get('dirPin', '')}:{gate.get('enablePin', '')}:{gate.get('speed', 1000)}:{gate.get('acceleration', 500)}:{gate.get('openPos', 200)}:{gate.get('closePos', 0)}"
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
