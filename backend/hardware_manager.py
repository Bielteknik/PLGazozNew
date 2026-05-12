import serial
import serial.tools.list_ports
import time
import os

class HardwareManager:
    def __init__(self):
        self.serial_conns = {}  # {port: SerialInstance}
        self.port_to_id_map = {} # {port: 'GatesNano' or 'ValvesNano'}
        self.on_input_detected = None
        self.on_output_detected = None
        self.sensor_config = []
        self.polling_active = False
        
    def get_available_ports(self):
        """Sadece ttyUSB ve ttyACM ile başlayan geçerli seri portları listeler."""
        ports = [p.device for p in serial.tools.list_ports.comports()]
        # Sadece USB tabanlı olanları filtrele
        filtered = [p for p in ports if "ttyUSB" in p or "ttyACM" in p]
        return sorted(filtered)

    def connect_to_port(self, port, baudrate=9600):
        """Porta bağlanır ve cihazın kimliğini sorgular (Handshake)."""
        try:
            if port in self.serial_conns:
                if self.serial_conns[port].is_open: return True
            
            conn = serial.Serial(port, baudrate, timeout=1.0)
            time.sleep(2) # Arduino'nun resetlenmesini bekle
            
            # El Sıkışma (Handshake)
            conn.write(b"IDENTIFY\n")
            response = conn.readline().decode('utf-8', errors='ignore').strip()
            
            if response.startswith("ID:"):
                device_id = response.replace("ID:", "")
                self.serial_conns[port] = conn
                self.port_to_id_map[port] = device_id
                print(f"[Hardware] Handshake BAŞARILI: {port} -> {device_id}")
                return True
            else:
                print(f"[Hardware] Handshake BAŞARISIZ ({port}): Kimlik alınamadı.")
                conn.close()
                return False
        except Exception as e:
            print(f"[Hardware] Bağlantı Hatası ({port}): {e}")
            return False

    def find_and_connect(self, target_id):
        """Tüm portları tarayarak hedef ID'ye sahip cihazı bulur ve bağlar."""
        available = self.get_available_ports()
        for port in available:
            # Zaten başka bir ID ile bağlı olan portları atla
            if port in self.serial_conns:
                if self.port_to_id_map.get(port) == target_id: return True
                continue
                
            print(f"[Hardware] {target_id} aranıyor: {port}...")
            if self.connect_to_port(port):
                if self.port_to_id_map.get(port) == target_id:
                    print(f"[Hardware] {target_id} BULUNDU: {port}")
                    return True
                else:
                    # Yanlış cihaz, kapat
                    self.serial_conns[port].close()
                    del self.serial_conns[port]
                    if port in self.port_to_id_map: del self.port_to_id_map[port]
        return False

    def is_port_online(self, port):
        """Portun bağlı ve açık olup olmadığını kontrol eder."""
        conn = self.serial_conns.get(port)
        return conn is not None and conn.is_open

    def control_valve(self, valve_id, state):
        """ValvesNano üzerinden vana kontrolü yapar. valve_id: 10-18"""
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
        if port:
            state_str = "ON" if state else "OFF"
            self.send_command(f"VALVE_CMD:{valve_id}:{state_str}", target_port=port)
            return True
        return False

    def control_gate(self, pin, position):
        """GatesNano üzerinden kilit motoru kontrolü yapar."""
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "GatesNano"), None)
        if port:
            self.send_command(f"{pin}:{position}", target_port=port)
            return True
        return False

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
        self.port_to_id_map = {n.get("port"): n.get("id") for n in nanos if n.get("port")}
        
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

    def control_gate(self, gate_id, position):
        """
        Dinamik kilit kontrolü. Sadece GatesNano kimlikli cihaza gider.
        """
        # 1. Portu bul
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "GatesNano"), None)
        
        # 2. Eğer port bulunamadıysa bir kez daha aramayı dene (Hızlı tarama)
        if not port:
            print("[Hardware] GatesNano portu hafızada yok, yeniden aranıyor...")
            if self.find_and_connect("GatesNano"):
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "GatesNano"), None)

        if port:
            pin = "G1" if "IN" in gate_id or "G1" in gate_id else "G2"
            full_cmd = f"{pin}:{position}"
            print(f"[Hardware] >>> MOTOR KOMUTU -> GatesNano ({port}): {full_cmd}")
            self.send_command(full_cmd, target_port=port)
            return True
        else:
            print(f"[Hardware] KRİTİK HATA: GatesNano sistemde bulunamadı!")
        return False

    def update(self):
        """Tüm açık portları tarar ve ID önekli verileri işler."""
        for port, conn in list(self.serial_conns.items()):
            try:
                if not conn.is_open: continue
                if conn.in_waiting > 0:
                    line = conn.readline().decode('utf-8', errors='ignore').strip()
                    if not line: continue
                    
                    # ID formatı kontrolü: "NANO-1:P1:17"
                    if ":" in line:
                        parts = line.split(":")
                        device_id = parts[0]
                        payload = ":".join(parts[1:])
                        
                        if device_id in ["GatesNano", "ValvesNano"]:
                            if "P1:IN" in payload: 
                                if self.on_input_detected: self.on_input_detected(device_id, "IN")
                            elif "P1:OUT" in payload:
                                if self.on_input_detected: self.on_input_detected(device_id, "OUT")
                            elif "ACK:" in payload:
                                print(f"[Hardware] {device_id} Onay: {payload}")
                        elif line.startswith("ID:"):
                            # El sıkışma dışı gelen ID mesajlarını da işle (Örn: Restart sonrası)
                            new_id = line.replace("ID:", "").strip() # Boşlukları temizle!
                            if new_id in ["GatesNano", "ValvesNano"]:
                                self.port_to_id_map[port] = new_id
                                print(f"[Hardware] Otomatik Tanımlama: {port} -> {new_id}")
                
            except Exception as e:
                # Bağlantıyı hemen silme, sadece hatayı logla
                if "outputCount" not in str(e): # Bilinen sayaç hatasını gizle
                    print(f"[Hardware] Okuma Uyarısı ({port}): {e}")

    def control_valve(self, valve_id, state):
        """ValvesNano üzerinden vana kontrolü yapar. valve_id: 10-18"""
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
        if port:
            state_str = "ON" if state else "OFF"
            self.send_command(f"VALVE_CMD:{valve_id}:{state_str}", target_port=port)
            return True
        return False

    def toggle_valve(self, pin, state):
        self.control_valve(pin, state)

    def all_off(self):
        self.send_command("VALVE_CMD:ALL:OFF")

    def cleanup_gpio(self):
        """GPIO kaynaklarını güvenli bir şekilde serbest bırakır."""
        self.polling_active = False
        if hasattr(self, 'poll_thread') and self.poll_thread.is_alive():
            # Thread'in bitmesini beklemiyoruz (daemon), sadece flag'i kapattık
            pass
            
        try:
            import lgpio
            if hasattr(self, 'gpio_h'):
                # Önce tüm pinleri serbest bırakmaya çalış (opsiyonel ama güvenli)
                # lgpio'da açık chip'i kapatmak yeterlidir
                lgpio.gpiochip_close(self.gpio_h)
                delattr(self, 'gpio_h')
        except:
            pass

    def setup_gpio(self, input_pin=17, output_pin=27, sensors=None):
        """Raspberry Pi GPIO pinlerini sensörler için hazırlar."""
        self.cleanup_gpio() # Önce eski bağlantıyı temizle (GPIO Busy hatasını önler)
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
                # Debounce sayaçları
                in_stable_count = 0
                out_stable_count = 0
                required_stable = 3 # ~150ms stabilite

                while self.polling_active:
                    try:
                        # Giriş Sensörü (Debounce ile)
                        in_val = lgpio.gpio_read(self.gpio_h, in_pin)
                        if in_val == 0: # Aktif (Engel var)
                            in_stable_count += 1
                            if in_stable_count == required_stable:
                                self._handle_input("RASPI")
                        else: # Pasif (Engel yok)
                            in_stable_count = 0
                        
                        # Çıkış Sensörü (Debounce ile)
                        out_val = lgpio.gpio_read(self.gpio_h, out_pin)
                        if out_val == 0: # Aktif
                            out_stable_count += 1
                            if out_stable_count == required_stable:
                                self._handle_output("RASPI")
                        else: # Pasif
                            out_stable_count = 0

                        time.sleep(0.05)
                    except: break

            self.poll_thread = threading.Thread(target=poll_loop, daemon=True)
            self.poll_thread.start()
            print(f"[GPIO] İzleme başladı (Hibrit Mod - Pi 5)")

        except Exception as e:
            print(f"[GPIO] Kurulum Hatası (Muhtemelen Pi değil): {e}")

    def _handle_input(self, source):
        print(f">>> GİRİŞ SENSÖRÜ ({source}) TETİKLENDİ")
        if self.on_input_detected: self.on_input_detected(source, "IN")

    def _handle_output(self, source):
        print(f">>> ÇIKIŞ SENSÖRÜ ({source}) TETİKLENDİ")
        if self.on_input_detected: self.on_input_detected(source, "OUT")

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
