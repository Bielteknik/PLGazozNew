import serial
import serial.tools.list_ports
import time
import os

class HardwareManager:
    def __init__(self):
        self.serial_conn = None
        self.on_input_detected = None
        self.on_output_detected = None
        self.sensors = {}
        
    def get_available_ports(self):
        ports = [p.device for p in serial.tools.list_ports.comports()]
        
        # Pi 5 Manuel Kontrol (Eğer liste boşsa veya USB portları eksikse)
        import os
        for i in range(4):
            usb_p = f"/dev/ttyUSB{i}"
            acm_p = f"/dev/ttyACM{i}"
            if os.path.exists(usb_p) and usb_p not in ports:
                ports.append(usb_p)
            if os.path.exists(acm_p) and acm_p not in ports:
                ports.append(acm_p)
                
        return list(set(ports))

    def connect_serial(self, port='/dev/ttyUSB0', baudrate=9600):
        try:
            self.serial_conn = serial.Serial(port, baudrate, timeout=1)
            print(f"[Serial] Bağlandı: {port}")
            return True
        except Exception as e:
            print(f"[Serial] Hata ({port}): {e}")
            return False

    def connect_to_port(self, port, baudrate=9600):
        """Belirtilen porta bağlanmayı dene. Başarılıysa True döndür."""
        try:
            # Mevcut bağlantıyı kapat
            if self.serial_conn and self.serial_conn.is_open:
                self.serial_conn.close()
            self.serial_conn = serial.Serial(port, baudrate, timeout=1)
            print(f"[Serial] Yeni bağlantı: {port}@{baudrate}")
            return True
        except Exception as e:
            print(f"[Serial] Bağlantı başarısız ({port}): {e}")
            self.serial_conn = None
            return False

    def send_command(self, cmd):
        if self.serial_conn and self.serial_conn.is_open:
            try:
                full_cmd = f"{cmd}\n" if not cmd.endswith('\n') else cmd
                self.serial_conn.write(full_cmd.encode())
            except Exception as e:
                print(f"[Serial] Yazma Hatası: {e}")

    def send_serial(self, cmd):
        """Alias for send_command used in main.py"""
        self.send_command(cmd)

    def control_valve(self, pin, state):
        """Standardized method used by StateManager"""
        # Arduino sketch VALVE_CMD:pin:ON/OFF formatını bekliyor
        cmd = f"VALVE_CMD:{pin}:{'ON' if state else 'OFF'}"
        self.send_command(cmd)

    def toggle_valve(self, pin, state):
        """Alias for control_valve"""
        self.control_valve(pin, state)

    def all_off(self):
        self.send_command("VALVE_CMD:ALL:OFF")

    def setup_gpio(self, sensors=None, input_pin=17, output_pin=27):
        """
        Pi 5 için lgpio kullanarak GPIO ayarla.
        Sensör davranışı: Boşken 3V (HIGH), şişe gelince 0V (LOW) → FALLING_EDGE say.
        """
        try:
            import lgpio
            self.gpio_h = lgpio.gpiochip_open(0)

            # Pinleri sensör config'den belirle
            in_pin = input_pin
            out_pin = output_pin
            if sensors:
                for s in sensors:
                    if s.get("device") == "RASPI" and s.get("enabled"):
                        pin = int(s.get("pin", 0))
                        if not pin:
                            continue
                        if s.get("type") == "INPUT":
                            in_pin = pin
                        else:
                            out_pin = pin

            # GPIO pinlerini giriş olarak tanımla
            lgpio.gpio_claim_input(self.gpio_h, in_pin, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self.gpio_h, out_pin, lgpio.SET_PULL_UP)

            # FALLING_EDGE (3V→0V): Şişe lazeri kestiği an
            self._gpio_cb_in = lgpio.callback(
                self.gpio_h, in_pin, lgpio.FALLING_EDGE,
                lambda chip, gpio, level, tick: self._handle_input()
            )
            self._gpio_cb_out = lgpio.callback(
                self.gpio_h, out_pin, lgpio.FALLING_EDGE,
                lambda chip, gpio, level, tick: self._handle_output()
            )

            print(f"[GPIO] lgpio aktif: Giriş=GPIO{in_pin}, Çıkış=GPIO{out_pin}")

        except ImportError:
            print("[GPIO] lgpio bulunamadı! Pi 5'te 'pip install lgpio' çalıştırın.")
        except Exception as e:
            print(f"[GPIO] Kurulum Hatası: {e}")

    def _handle_input(self):
        print("[GPIO] Giriş Lazeri tetiklendi!")
        if self.on_input_detected:
            self.on_input_detected()

    def _handle_output(self):
        print("[GPIO] Çıkış Lazeri tetiklendi!")
        if self.on_output_detected:
            self.on_output_detected()

    def cleanup(self):
        if self.serial_conn:
            self.serial_conn.close()
        try:
            import lgpio
            if hasattr(self, '_gpio_cb_in'):
                self._gpio_cb_in.cancel()
            if hasattr(self, '_gpio_cb_out'):
                self._gpio_cb_out.cancel()
            if hasattr(self, 'gpio_h'):
                lgpio.gpiochip_close(self.gpio_h)
        except Exception:
            pass
        print("[Hardware] Temizlik tamamlandı.")
