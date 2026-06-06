import serial
import serial.tools.list_ports
import time
import os
import asyncio

# Dynamically import smbus / spidev for Pi 5 I2C and SPI
try:
    import smbus2 as smbus
except ImportError:
    try:
        import smbus
    except ImportError:
        smbus = None

try:
    import spidev
except ImportError:
    spidev = None

class HardwareManager:
    def __init__(self):
        self.serial_conns = {}  # {port: SerialInstance}
        self.tcp_conns = {}     # {device_id: (reader, writer, addr)}
        self.port_to_id_map = {} # {port: 'GatesNano' or 'ValvesNano'}
        self.on_input_detected = None
        self.sensor_config = []
        self.polling_active = False
        self.device_status = {
            "ValvesNano": "READY",
            "GatesNano": "READY"
        }
        
    def get_available_ports(self):
        """USB (ttyUSB, ttyACM, COM) ve UART (ttyAMA, ttyS, serial) portlarını listeler."""
        ports = [p.device for p in serial.tools.list_ports.comports()]
        
        # Raspberry Pi üzerindeki standart UART/GPIO portlarını kontrol edip ekle
        additional_paths = ["/dev/ttyAMA0", "/dev/serial0", "/dev/ttyS0", "/dev/ttyAMA10"]
        for path in additional_paths:
            if os.path.exists(path) and path not in ports:
                ports.append(path)
                
        # USB tabanlı, Pi UART ve Windows COM portlarını filtrele
        filtered = [p for p in ports if any(x in p for x in ["ttyUSB", "ttyACM", "ttyAMA", "ttyS", "serial", "COM"])]
        return sorted(filtered)

    def scan_all_ports(self, baudrate=115200):
        """Tüm seri portları, I2C yollarını ve SPI kanallarını tarayarak aktif cihazları döner."""
        discovered = {}
        
        # 1. Seri Port Taraması (USB & UART)
        discovered.update(self.scan_serial_ports(baudrate))
        
        # 2. I2C Cihaz Taraması
        discovered.update(self.scan_i2c_bus())
        
        # 3. SPI Cihaz Taraması
        discovered.update(self.scan_spi_bus())
        
        return discovered

    def scan_serial_ports(self, baudrate=115200):
        """Tüm kullanılabilir seri portları tarar, el sıkışma yapar ve cihazları döner."""
        available = self.get_available_ports()
        discovered = {}
        for port in available:
            if self.connect_to_port(port, baudrate):
                device_id = self.port_to_id_map.get(port)
                if device_id:
                    discovered[port] = device_id
        return discovered

    def scan_i2c_bus(self, bus_id=1):
        """I2C veri yolunu tarar ve yanıt veren adresleri (I2C:bus_id:addr) olarak tespit eder."""
        discovered = {}
        if smbus is None:
            return discovered
            
        try:
            bus = smbus.SMBus(bus_id)
            for addr in range(0x03, 0x78):
                try:
                    # Yazma/okuma denemesi ile cihaz varlığını kontrol et
                    bus.write_quick(addr)
                    # Cihaz yanıt verdi! Şimdi kimliğini soralım (Komut: 0x99 IDENTIFY)
                    bus.write_byte(addr, 0x99)
                    time.sleep(0.05)
                    # İsim oku (16 karakterlik tampon alan)
                    name_bytes = []
                    for _ in range(16):
                        b = bus.read_byte(addr)
                        if b == 0 or b == 255:
                            break
                        name_bytes.append(chr(b))
                    device_id = "".join(name_bytes).strip()
                    if device_id:
                        port_str = f"I2C:{bus_id}:{hex(addr)}"
                        discovered[port_str] = device_id
                        self.port_to_id_map[port_str] = device_id
                except Exception:
                    pass
            bus.close()
        except Exception as e:
            print(f"[Hardware I2C] Tarama hatası: {e}")
        return discovered

    def scan_spi_bus(self):
        """SPI hatlarını tarar ve spidev üzerinden yanıt veren cihazları tespit eder."""
        discovered = {}
        if spidev is None:
            return discovered
            
        # Pi üzerindeki yaygın SPI arayüzleri (bus, device)
        spi_targets = [(0, 0), (0, 1), (1, 0), (1, 1)]
        for bus, device in spi_targets:
            port_str = f"SPI:{bus}.{device}"
            if os.path.exists(f"/dev/spidev{bus}.{device}"):
                try:
                    spi = spidev.SpiDev()
                    spi.open(bus, device)
                    spi.max_speed_hz = 500000
                    spi.mode = 0
                    
                    # IDENTIFY sorgusu gönder (Komut: ASCII 'I', 'D', '\n' + 13 adet boş dolgu)
                    request = [ord('I'), ord('D'), ord('\n')] + [0]*13
                    response = spi.xfer2(request)
                    
                    name_bytes = []
                    for b in response:
                        if b == 0 or b == 255:
                            continue
                        name_bytes.append(chr(b))
                    device_id = "".join(name_bytes).strip()
                    spi.close()
                    
                    if device_id:
                        discovered[port_str] = device_id
                        self.port_to_id_map[port_str] = device_id
                except Exception:
                    pass
        return discovered

    async def start_tcp_listener(self, port=1978):
        print(f"[Hardware TCP] Soket dinleyicisi başlatılıyor (Port: {port})...")
        try:
            server = await asyncio.start_server(self.handle_tcp_client, '0.0.0.0', port)
            async with server:
                await server.serve_forever()
        except asyncio.CancelledError:
            print("[Hardware TCP] Soket dinleyicisi durduruldu.")
        except Exception as e:
            print(f"[Hardware TCP] Soket dinleyicisi başlatılamadı: {e}")

    async def handle_tcp_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        print(f"[Hardware TCP] Yeni bağlantı: {addr}")
        device_id = None
        try:
            # İlk satırı oku (tanıtım mesajı)
            line_bytes = await reader.readline()
            if not line_bytes:
                return
            line = line_bytes.decode('utf-8', errors='ignore').strip()
            print(f"[Hardware TCP] Alınan tanıtım: '{line}'")
            
            # Tanıtım formatı: "ID:CihazAdi" veya doğrudan "CihazAdi" (Örn: "ID:ValvesNano" veya "ValvesNano")
            if line.startswith("ID:"):
                device_id = line.replace("ID:", "").strip()
            else:
                device_id = line.strip()
                
            if not device_id:
                print(f"[Hardware TCP] Geçersiz tanıtım: '{line}'")
                return
                
            # Bağlantıyı kaydet
            self.tcp_conns[device_id] = (reader, writer, addr)
            self.port_to_id_map[f"TCP:{device_id}"] = device_id
            print(f"[Hardware TCP] {device_id} başarıyla bağlandı ({addr[0]}:{addr[1]})")
            
            # Bu soketten sürekli veri okuma döngüsü
            while True:
                line_bytes = await reader.readline()
                if not line_bytes:
                    break # Bağlantı koptu
                
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line:
                    continue
                    
                self.process_incoming_line(device_id, f"TCP:{device_id}", line)
                
        except Exception as e:
            print(f"[Hardware TCP] Hata ({device_id or addr}): {e}")
        finally:
            if device_id:
                self.close_tcp_connection(device_id)
            else:
                writer.close()

    def close_tcp_connection(self, device_id):
        conn = self.tcp_conns.pop(device_id, None)
        if conn:
            reader, writer, addr = conn
            print(f"[Hardware TCP] Bağlantı sonlandırılıyor: {device_id} ({addr[0]}:{addr[1]})")
            try:
                writer.close()
            except:
                pass
            port = f"TCP:{device_id}"
            if port in self.port_to_id_map:
                del self.port_to_id_map[port]

    async def _drain_writer(self, writer):
        try:
            await writer.drain()
        except:
            pass

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
        """Portun bağlı ve açık olup olmadığını kontrol eder (Serial, TCP, I2C ve SPI destekler)."""
        if not port: return False
        if port.startswith("TCP:"):
            device_id = port.replace("TCP:", "")
            return device_id in self.tcp_conns
        elif port.startswith("I2C:"):
            parts = port.split(":")
            bus_id = int(parts[1])
            addr = int(parts[2], 16)
            if smbus is None: return False
            try:
                bus = smbus.SMBus(bus_id)
                bus.write_quick(addr)
                bus.close()
                return True
            except:
                return False
        elif port.startswith("SPI:"):
            parts = port.split(":")[1].split(".")
            bus_id = int(parts[0])
            device_id = int(parts[1])
            return os.path.exists(f"/dev/spidev{bus_id}.{device_id}")
            
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
            if target_port.startswith("TCP:"):
                device_id = target_port.replace("TCP:", "")
                conn = self.tcp_conns.get(device_id)
                if conn:
                    reader, writer, addr = conn
                    try:
                        writer.write(encoded_cmd)
                        asyncio.create_task(self._drain_writer(writer))
                    except Exception as e:
                        print(f"[Hardware] TCP Yazma Hatası ({device_id}): {e}")
                        self.close_tcp_connection(device_id)
            elif target_port.startswith("I2C:"):
                parts = target_port.split(":")
                bus_id = int(parts[1])
                addr = int(parts[2], 16)
                if smbus:
                    try:
                        bus = smbus.SMBus(bus_id)
                        for char in full_cmd:
                            bus.write_byte(addr, ord(char))
                        bus.close()
                    except Exception as e:
                        print(f"[Hardware I2C] Yazma Hatası ({target_port}): {e}")
            elif target_port.startswith("SPI:"):
                parts = target_port.split(":")[1].split(".")
                bus_id = int(parts[0])
                device_id = int(parts[1])
                if spidev:
                    try:
                        spi = spidev.SpiDev()
                        spi.open(bus_id, device_id)
                        spi.max_speed_hz = 500000
                        spi.mode = 0
                        payload = [ord(c) for c in full_cmd]
                        spi.xfer2(payload)
                        spi.close()
                    except Exception as e:
                        print(f"[Hardware SPI] Yazma Hatası ({target_port}): {e}")
            else:
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
            # Broadcast to all serial
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
            # Broadcast to all TCP
            for device_id, conn in list(self.tcp_conns.items()):
                reader, writer, addr = conn
                try:
                    writer.write(encoded_cmd)
                    asyncio.create_task(self._drain_writer(writer))
                except Exception as e:
                    print(f"[Hardware] TCP Yazma Hatası ({device_id}): {e}")
                    self.close_tcp_connection(device_id)
            # Broadcast to all active I2C configured devices
            for port, device_id in list(self.port_to_id_map.items()):
                if port.startswith("I2C:") and smbus:
                    parts = port.split(":")
                    bus_id = int(parts[1])
                    addr = int(parts[2], 16)
                    try:
                        bus = smbus.SMBus(bus_id)
                        for char in full_cmd:
                            bus.write_byte(addr, ord(char))
                        bus.close()
                    except Exception:
                        pass
            # Broadcast to all active SPI configured devices
            for port, device_id in list(self.port_to_id_map.items()):
                if port.startswith("SPI:") and spidev:
                    parts = port.split(":")[1].split(".")
                    bus_id = int(parts[0])
                    device_id = int(parts[1])
                    try:
                        spi = spidev.SpiDev()
                        spi.open(bus_id, device_id)
                        spi.max_speed_hz = 500000
                        spi.mode = 0
                        payload = [ord(c) for c in full_cmd]
                        spi.xfer2(payload)
                        spi.close()
                    except Exception:
                        pass

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
            # 400 adım stall riskini azaltabilir (Eski çalışan değer)
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
        # 1. Seri Haberleşme Okuması
        for port, conn in list(self.serial_conns.items()):
            try:
                if not conn.is_open: continue
                
                # Bekleyen tüm satırları oku (Bloke etmeden)
                while conn.in_waiting > 0:
                    line_bytes = conn.readline()
                    if not line_bytes: break
                    
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    if not line: continue
                    
                    device_id = self.port_to_id_map.get(port)
                    self.process_incoming_line(device_id, port, line)
            except Exception as e:
                if "outputCount" not in str(e):
                    print(f"[Hardware] Okuma Uyarısı ({port}): {e}")

        # 2. I2C Cihazlarından Veri Okuma (Master Polling)
        if smbus:
            for port, device_id in list(self.port_to_id_map.items()):
                if port.startswith("I2C:"):
                    parts = port.split(":")
                    bus_id = int(parts[1])
                    addr = int(parts[2], 16)
                    try:
                        bus = smbus.SMBus(bus_id)
                        line_bytes = []
                        for _ in range(32):
                            b = bus.read_byte(addr)
                            if b == 0 or b == 255 or b == ord('\n'):
                                if b == ord('\n'):
                                    line = "".join(line_bytes).strip()
                                    if line:
                                        self.process_incoming_line(device_id, port, line)
                                break
                            line_bytes.append(chr(b))
                        bus.close()
                    except Exception:
                        pass

        # 3. SPI Cihazlarından Veri Okuma (Master Polling)
        if spidev:
            for port, device_id in list(self.port_to_id_map.items()):
                if port.startswith("SPI:"):
                    parts = port.split(":")[1].split(".")
                    bus_id = int(parts[0])
                    device_id_val = int(parts[1])
                    try:
                        spi = spidev.SpiDev()
                        spi.open(bus_id, device_id_val)
                        spi.max_speed_hz = 500000
                        spi.mode = 0
                        response = spi.readbytes(32)
                        spi.close()
                        
                        line_bytes = []
                        for b in response:
                            if b == 0 or b == 255 or b == ord('\n'):
                                if b == ord('\n'):
                                    line = "".join(line_bytes).strip()
                                    if line:
                                        self.process_incoming_line(device_id, port, line)
                                break
                            line_bytes.append(chr(b))
                    except Exception:
                        pass

    def process_incoming_line(self, device_id, port, line):
        """Seri veya TCP soket üzerinden gelen tek bir satırı işler."""
        try:
            if ":" in line:
                parts = line.split(":")
                first_part = parts[0]
                
                # Eğer ilk kısım bilinen bir cihaz değilse ve cihaz ID'si dışarıdan verilmişse, device_id önekleyelim
                if first_part not in ["GatesNano", "ValvesNano"] and not first_part.endswith("Nano") and device_id:
                    msg_device_id = device_id
                    payload = line
                else:
                    msg_device_id = first_part
                    payload = ":".join(parts[1:])
                
                if "P1:IN" in payload: 
                    if self.on_input_detected: self.on_input_detected(msg_device_id, "IN")
                elif "P1:OUT" in payload:
                    if self.on_input_detected: self.on_input_detected(msg_device_id, "OUT")
                elif "ACK:" in payload:
                    print(f"[Hardware] {msg_device_id} Onay: {payload}")
                elif "STATUS:" in payload:
                    status = payload.replace("STATUS:", "").strip()
                    self.device_status[msg_device_id] = status
                    print(f"[Hardware] {msg_device_id} Durumu: {status}")
                elif "DONE:" in payload:
                    self.device_status[msg_device_id] = "READY"
                    print(f"[Hardware] {msg_device_id} İşlem Tamamlandı.")
            elif line.startswith("ID:"):
                new_id = line.replace("ID:", "").strip()
                self.port_to_id_map[port] = new_id
                self.device_status[new_id] = "READY"
                print(f"[Hardware] Otomatik Tanımlama: {port} -> {new_id}")
        except Exception as e:
            print(f"[Hardware] Hata (Veri İşleme): {e}")

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
            print(f"[Hardware] >>> Pin {valve_id} PULSE: {duration}ms BAŞLADI")
            
            self.control_valve(valve_id, True)
            await asyncio.sleep(duration / 1000.0)
        except Exception as e:
            print(f"[Hardware] Pulse Hatası: {e}")
        finally:
            # Ne olursa olsun kapatmayı dene
            self.control_valve(valve_id, False)
            print(f"[Hardware] >>> Pin {valve_id} PULSE BİTTİ.")

    async def pulse_valves_concurrent(self, valve_duration_map):
        """
        Birden fazla vanayı aynı anda, kendi süreleri kadar açıp kapatır.
        valve_duration_map: { valve_id: duration_ms }
        """
        if not valve_duration_map:
            return
            
        print(f"[Hardware] >>> ÇOKLU PULSE BAŞLATILDI: {valve_duration_map}")
        tasks = []
        for v_id, duration in valve_duration_map.items():
            tasks.append(self.pulse_valve(v_id, duration))
        
        await asyncio.gather(*tasks)
        print(f"[Hardware] >>> ÇOKLU PULSE TAMAMLANDI.")

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
