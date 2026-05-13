import serial
import serial.tools.list_ports
import time
import os
import asyncio

class HardwareManager:
    def __init__(self):
        self.serial_conns = {}  # {port: SerialInstance}
        self.port_to_id_map = {} # {port: 'GatesNano' or 'ValvesNano'}
        self.on_input_detected = None
        self.on_output_detected = None
        self.sensor_config = []
        self.polling_active = False
        self.device_status = {
            "ValvesNano": "READY",
            "GatesNano": "READY"
        }
        
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
            # Map frontend IDs to Arduino commands
            cmd_prefix = pin
            if pin == "inputGate": cmd_prefix = "G1"
            elif pin == "outputGate": cmd_prefix = "G2"
            
            self.send_command(f"{cmd_prefix}:{position}", target_port=port)
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
                    # Kritik: Bağlantıyı kopar ki self-healing devreye girsin!
                    try:
                        conn.close()
                        del self.serial_conns[target_port]
                        if target_port in self.port_to_id_map:
                            del self.port_to_id_map[target_port]
                    except: pass
        else:
            # Broadcast to all
            for port, conn in list(self.serial_conns.items()):
                if conn.is_open:
                    try:
                        conn.write(encoded_cmd)
                    except Exception as e:
                        print(f"[Hardware] Yazma Hatası ({port}): {e}")
                        try:
                            conn.close()
                            del self.serial_conns[port]
                            if port in self.port_to_id_map:
                                del self.port_to_id_map[port]
                        except: pass

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
            gate_id_upper = gate_id.upper()
            pin = "G1" if "IN" in gate_id_upper or "G1" in gate_id_upper else "G2"
            # 400 adım ileri (1) = Aç, 400 adım geri (-400) = Kilitler
            steps = 400 if int(position) == 1 else -400
            full_cmd = f"{pin}:{steps}"
            print(f"[Hardware] >>> MOTOR KOMUTU -> GatesNano ({port}): {full_cmd}")
            self.send_command(full_cmd, target_port=port)
            return True
        else:
            print(f"[Hardware] KRİTİK HATA: GatesNano sistemde bulunamadı!")
        return False

    def update(self):
        """Tüm açık portları tarar ve beklemedeki TÜM verileri hızlıca işler."""
        for port, conn in list(self.serial_conns.items()):
            try:
                if not conn.is_open: continue
                
                # Bekleyen tüm satırları oku (Bloke etmeden)
                while conn.in_waiting > 0:
                    line_bytes = conn.readline()
                    if not line_bytes: break
                    
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    if not line: continue
                    
                    # ID formatı kontrolü: "GatesNano:P1:IN"
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
                            elif "STATUS:" in payload:
                                status = payload.replace("STATUS:", "").strip()
                                self.device_status[device_id] = status
                                print(f"[Hardware] {device_id} Durumu: {status}")
                            elif "DONE:" in payload:
                                self.device_status[device_id] = "READY"
                                print(f"[Hardware] {device_id} İşlem Tamamlandı.")
                        elif line.startswith("ID:"):
                            new_id = line.replace("ID:", "").strip()
                            if new_id in ["GatesNano", "ValvesNano"]:
                                self.port_to_id_map[port] = new_id
                                self.device_status[new_id] = "READY"
                                print(f"[Hardware] Otomatik Tanımlama: {port} -> {new_id}")
            except Exception as e:
                if "outputCount" not in str(e):
                    print(f"[Hardware] Okuma Uyarısı ({port}): {e}")

    def control_valve(self, valve_id, state):
        """ValvesNano üzerinden vana kontrolü yapar. valve_id: 10-18"""
        # 1. Portu bul
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
        
        # 2. Eğer port bulunamadıysa aramayı dene
        if not port:
            print("[Hardware] ValvesNano portu hafızada yok, yeniden aranıyor...")
            if self.find_and_connect("ValvesNano"):
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)

        if port:
            state_str = "AÇILDI" if state else "KAPANDI"
            full_cmd = f"VALVE_CMD:{valve_id}:{'ON' if state else 'OFF'}"
            print(f"[Hardware] >>> Pin {valve_id} -> {state_str}")
            self.send_command(full_cmd, target_port=port)
            return True
        else:
            print(f"[Hardware] HATA: ValvesNano sistemde bulunamadı!")
        return False

    async def pulse_valve(self, valve_id, duration_ms):
        """Bir vanayı belirli bir süre (ms) açıp kapatır. Takılmaya karşı zırhlıdır."""
        try:
            # Tip dönüşümü: Arayüzden string gelme ihtimaline karşı sayıya çevir
            duration = float(duration_ms)
            print(f"[Hardware] >>> Pin {valve_id} TEST PULSE: {duration}ms BAŞLADI")
            
            self.control_valve(valve_id, True)
            await asyncio.sleep(duration / 1000.0)
        except Exception as e:
            print(f"[Hardware] Pulse Hatası: {e}")
        finally:
            # Ne olursa olsun kapatmayı dene (Bağlantı kopsa bile self-healing ile kapatacak)
            print(f"[Hardware] >>> Pin {valve_id} TEST PULSE BİTTİ.")
            success = self.control_valve(valve_id, False)
            if not success:
                print(f"[Hardware] UYARI: Valf {valve_id} kapatılamadı! ALL_OFF deneniyor.")
                self.all_off()

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

            # Alerts (Interrupts) for instantaneous reaction
            def on_alert(chip, gpio, level, tick):
                if level == 0: # Falling edge (Object detected)
                    if gpio == in_pin:
                        self._handle_input("RASPI")
                    elif gpio == out_pin:
                        self._handle_output("RASPI")

            # Set up alerts
            lgpio.gpio_claim_input(self.gpio_h, in_pin, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self.gpio_h, out_pin, lgpio.SET_PULL_UP)
            
            lgpio.gpio_set_alert_func(self.gpio_h, in_pin, on_alert)
            lgpio.gpio_set_alert_func(self.gpio_h, out_pin, on_alert)

            self.polling_active = True
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
