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

    def connect_to_port(self, port, baudrate=115200):
        """Porta bağlanır ve cihazın kimliğini sorgular (Handshake)."""
        try:
            if port in self.serial_conns:
                if self.serial_conns[port].is_open: return True
            
            print(f"[Hardware] {port} portuna bağlanılıyor ({baudrate})...")
            conn = serial.Serial(port, baudrate, timeout=1.0)
            time.sleep(2) # Arduino Reset Bekleme
            
            # Tamponu temizle
            conn.reset_input_buffer()
            conn.reset_output_buffer()
            
            # El Sıkışma (Handshake)
            for attempt in range(3):
                print(f"[Hardware] {port} için IDENTIFY gönderiliyor (Deneme {attempt+1})...")
                conn.write(b"IDENTIFY\n")
                
                # Yanıt bekle
                for _ in range(10):
                    line = conn.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        print(f"[Hardware] {port} -> ALINAN YANIT: '{line}'")
                        
                        # Hem "ID:IDNAME" hem de direkt "IDNAME" formatını destekle
                        clean_id = line.replace("ID:", "").strip()
                        if clean_id in ["GatesNano", "ValvesNano"]:
                            self.serial_conns[port] = conn
                            self.port_to_id_map[port] = clean_id
                            print(f"[Hardware] {port} DOĞRULANDI: {clean_id}")
                            return True
                
                time.sleep(0.5)
            
            print(f"[Hardware] {port} el sıkışma başarısız: Geçerli ID alınamadı.")
            conn.close()
            return False
        except Exception as e:
            print(f"[Hardware] {port} bağlantı hatası: {e}")
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
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "GatesNano"), None)

        if not port:
            print("[Hardware] GatesNano portu hafızada yok, yeniden aranıyor...")
            if self.find_and_connect("GatesNano"):
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "GatesNano"), None)

        if port:
            gate_id_upper = gate_id.upper()
            pin = "G1" if "IN" in gate_id_upper or "G1" in gate_id_upper else "G2"
            pos_val = int(position)
            steps = 400 if pos_val > 0 else -400
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
        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
        self.send_command("VALVE_CMD:ALL:OFF", target_port=port)

    def cleanup_gpio(self):
        """GPIO kaynaklarını güvenli bir şekilde serbest bırakır."""
        self.polling_active = False
        try:
            import lgpio
            if hasattr(self, 'gpio_h'):
                lgpio.gpiochip_close(self.gpio_h)
                del self.gpio_h
        except:
            pass

    def setup_gpio(self, input_pin=17, output_pin=27, sensors=None):
        """Raspberry Pi GPIO pinlerini sensörler için hazırlar."""
        self.cleanup_gpio() 
        self.sensor_config = sensors or []
        try:
            import lgpio
            import threading
            self.gpio_h = lgpio.gpiochip_open(0)

            in_pin = input_pin
            out_pin = output_pin

            for s in self.sensor_config:
                if s.get("device") == "RASPI" and s.get("enabled"):
                    pin = int(s.get("pin", 0))
                    if not pin: continue
                    if s.get("type") == "INPUT": in_pin = pin
                    else: out_pin = pin

            lgpio.gpio_claim_input(self.gpio_h, in_pin, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self.gpio_h, out_pin, lgpio.SET_PULL_UP)

            self.polling_active = True
            
            def poll_loop():
                last_in_time = 0
                last_out_time = 0
                in_low_count = 0
                out_low_count = 0
                required_stable_polls = 3 
                cooldown_s = 0.2
                
                while self.polling_active:
                    try:
                        now = time.time()
                        in_val = lgpio.gpio_read(self.gpio_h, in_pin)
                        if in_val == 0:
                            in_low_count += 1
                            if in_low_count == required_stable_polls:
                                if (now - last_in_time) > cooldown_s:
                                    self._handle_input("RASPI")
                                    last_in_time = now
                        else:
                            in_low_count = 0
                        
                        out_val = lgpio.gpio_read(self.gpio_h, out_pin)
                        if out_val == 0:
                            out_low_count += 1
                            if out_low_count == required_stable_polls:
                                if (now - last_out_time) > cooldown_s:
                                    self._handle_output("RASPI")
                                    last_out_time = now
                        else:
                            out_low_count = 0
                        
                        time.sleep(0.01)
                    except: break

            self.poll_thread = threading.Thread(target=poll_loop, daemon=True)
            self.poll_thread.start()
            print(f"[GPIO] İzleme başladı (Hızlı Polling Mod - Pi 5)")

        except Exception as e:
            print(f"[GPIO] Kurulum Hatası (LGPIO Polling): {e}")

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
