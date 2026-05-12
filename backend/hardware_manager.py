import serial
import serial.tools.list_ports
import time
import os

class HardwareManager:
    def __init__(self):
        self.serial_conns = {}  # {port: SerialInstance}
        self.on_input_detected = None
        self.on_output_detected = None
        self.sensor_config = []
        self.polling_active = False
        
    def get_available_ports(self):
        """Pi 5 ve diğer sistemler için kapsamlı port tarama."""
        ports = [p.device for p in serial.tools.list_ports.comports()]
        
        # Pi 5 Manuel Kontrol (Eğer liste boşsa veya USB portları eksikse)
        for i in range(8):
            for prefix in ["/dev/ttyUSB", "/dev/ttyACM", "/dev/ttyAMA"]:
                p = f"{prefix}{i}"
                if os.path.exists(p) and p not in ports:
                    ports.append(p)
                    
        return sorted(list(set(ports)))

    def connect_to_port(self, port, baudrate=9600):
        """Belirtilen porta bağlanmayı dene. Başarılıysa True döndür."""
        try:
            # Eğer zaten bağlıysa ve açıksa, aynı ayarlar mı kontrol et (isteğe bağlı)
            if port in self.serial_conns:
                if self.serial_conns[port].is_open:
                    if self.serial_conns[port].baudrate == baudrate:
                        return True # Zaten doğru bağlı
                    else:
                        self.serial_conns[port].close()
            
            new_conn = serial.Serial(port, baudrate, timeout=0.1)
            self.serial_conns[port] = new_conn
            print(f"[Hardware] Bağlandı: {port} @ {baudrate}")
            return True
        except Exception as e:
            print(f"[Hardware] Bağlantı HATASI ({port}): {e}")
            if port in self.serial_conns:
                del self.serial_conns[port]
            return False

    def is_port_online(self, port):
        """Portun bağlı ve açık olup olmadığını kontrol eder."""
        conn = self.serial_conns.get(port)
        return conn is not None and conn.is_open

    def send_command(self, cmd, target_port=None):
        """
        Komutu belirtilen porta veya tüm açık portlara gönderir.
        target_port None ise tüm portlara broadcast yapar.
        """
        full_cmd = f"{cmd}\n" if not cmd.endswith('\n') else cmd
        encoded_cmd = full_cmd.encode()

        if target_port:
            conn = self.serial_conns.get(target_port)
            if conn and conn.is_open:
                try:
                    conn.write(encoded_cmd)
                except Exception as e:
                    print(f"[Hardware] Yazma Hatası ({target_port}): {e}")
        else:
            # Broadcast to all
            for port, conn in list(self.serial_conns.items()):
                if conn.is_open:
                    try:
                        conn.write(encoded_cmd)
                    except Exception as e:
                        print(f"[Hardware] Yazma Hatası ({port}): {e}")

    def apply_config(self, nanos, sensors):
        """Arayüzden gelen tüm donanım yapılandırmasını anında uygular."""
        self.sensor_config = sensors
        
        # 1. Nano Bağlantılarını Güncelle
        active_ports = [n.get("port") for n in nanos if n.get("port")]
        
        # Artık kullanılmayan portları kapat
        for port in list(self.serial_conns.keys()):
            if port not in active_ports:
                print(f"[Hardware] Port artık kullanımda değil, kapatılıyor: {port}")
                try:
                    self.serial_conns[port].close()
                except: pass
                del self.serial_conns[port]
        
        # Yeni veya değişen portlara bağlan
        for n in nanos:
            port = n.get("port")
            baud = n.get("baudRate", 9600)
            if port:
                self.connect_to_port(port, baud)
        
        # 2. GPIO Sensörlerini Yeniden Başlat (Eğer Pi üzerindeyse)
        self.setup_gpio(sensors=sensors)
        print("[Hardware] Yeni yapılandırma uygulandı.")

    def control_gate(self, gate_cmd_prefix, value):
        """
        Dinamik kilit kontrolü. 
        gate_cmd_prefix: 'G1', 'G2' vb.
        value: 1 (aç), 0 (kapat)
        """
        cmd = f"{gate_cmd_prefix}:{value}"
        self.send_command(cmd)

    def update(self):
        """Tüm açık portları tarar ve gelen verileri işler."""
        for port, conn in list(self.serial_conns.items()):
            if conn.is_open and conn.in_waiting > 0:
                try:
                    line = conn.readline().decode('utf-8', errors='ignore').strip()
                    if not line: continue
                    
                    if line == "SENS:IN":
                        self._handle_input("NANO")
                    elif line == "SENS:OUT":
                        self._handle_output("NANO")
                    elif line.startswith("ACK:"):
                        print(f"[Hardware] {port} Bildirimi: {line}")
                except Exception as e:
                    print(f"[Hardware] Okuma Hatası ({port}): {e}")

    def control_valve(self, pin, state):
        """Vana kontrolü (Broadcast)."""
        cmd = f"VALVE_CMD:{pin}:{'ON' if state else 'OFF'}"
        self.send_command(cmd)

    def toggle_valve(self, pin, state):
        self.control_valve(pin, state)

    def all_off(self):
        self.send_command("VALVE_CMD:ALL:OFF")

    def setup_gpio(self, sensors=None, input_pin=17, output_pin=27):
        """Pi 5 için Hibrit Sensör Kontrolü (lgpio polling)."""
        self.sensor_config = sensors or []
        try:
            import lgpio
            import threading
            self.gpio_h = lgpio.gpiochip_open(0)

            # Varsayılanlar
            in_pin = input_pin
            out_pin = output_pin

            # Sadece RASPI seçilen sensörler için pinleri ayarla
            for s in self.sensor_config:
                if s.get("device") == "RASPI" and s.get("enabled"):
                    pin = int(s.get("pin", 0))
                    if not pin: continue
                    if s.get("type") == "INPUT": in_pin = pin
                    else: out_pin = pin

            lgpio.gpio_claim_input(self.gpio_h, in_pin, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self.gpio_h, out_pin, lgpio.SET_PULL_UP)

            self.polling_active = True
            self.last_in_state = 1
            self.last_out_state = 1

            def poll_loop():
                while self.polling_active:
                    try:
                        # Giriş Sensörü
                        in_val = lgpio.gpio_read(self.gpio_h, in_pin)
                        if in_val != self.last_in_state:
                            if in_val == 0: self._handle_input("RASPI")
                            self.last_in_state = in_val

                        # Çıkış Sensörü
                        out_val = lgpio.gpio_read(self.gpio_h, out_pin)
                        if out_val != self.last_out_state:
                            if out_val == 0: self._handle_output("RASPI")
                            self.last_out_state = out_val

                        time.sleep(0.05) # Hızlandırıldı
                    except: break

            self.poll_thread = threading.Thread(target=poll_loop, daemon=True)
            self.poll_thread.start()
            print(f"[GPIO] İzleme başladı (Hibrit Mod - Pi 5)")

        except Exception as e:
            print(f"[GPIO] Kurulum Hatası (Muhtemelen Pi değil): {e}")

    def _handle_input(self, source):
        for s in self.sensor_config:
            if s.get("type") == "INPUT" and s.get("device") == source and s.get("enabled"):
                print(f">>> GİRİŞ SENSÖRÜ ({source}) TETİKLENDİ")
                if self.on_input_detected: self.on_input_detected()

    def _handle_output(self, source):
        for s in self.sensor_config:
            if s.get("type") == "OUTPUT" and s.get("device") == source and s.get("enabled"):
                print(f">>> ÇIKIŞ SENSÖRÜ ({source}) TETİKLENDİ")
                if self.on_output_detected: self.on_output_detected()

    def cleanup(self):
        self.polling_active = False
        for port, conn in self.serial_conns.items():
            try:
                conn.close()
            except: pass
        self.serial_conns.clear()
        
        try:
            import lgpio
            if hasattr(self, 'gpio_h'):
                lgpio.gpiochip_close(self.gpio_h)
        except Exception:
            pass
        print("[Hardware] Temizlik tamamlandı.")
