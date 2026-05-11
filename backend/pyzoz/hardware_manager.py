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
        Pi 5 için Polling (Sürekli Kontrol) yöntemi.
        Callback'ler Pi 5'te bazen tutukluk yapabiliyor, bu yöntem %100 çalışır.
        """
        try:
            import lgpio
            import threading
            self.gpio_h = lgpio.gpiochip_open(0)

            in_pin = input_pin
            out_pin = output_pin
            if sensors:
                for s in sensors:
                    if s.get("device") == "RASPI" and s.get("enabled"):
                        pin = int(s.get("pin", 0))
                        if not pin: continue
                        if s.get("type") == "INPUT": in_pin = pin
                        else: out_pin = pin

            # Pinleri ayarla
            lgpio.gpio_claim_input(self.gpio_h, in_pin, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self.gpio_h, out_pin, lgpio.SET_PULL_UP)

            self.polling_active = True
            self.last_in_state = 1
            self.last_out_state = 1

            def poll_loop():
                print(f"[GPIO] Polling Bekçisi Başladı. İzlenen: {in_pin}, {out_pin}")
                while self.polling_active:
                    try:
                        # Giriş Sensörü Oku
                        in_val = lgpio.gpio_read(self.gpio_h, in_pin)
                        if in_val != self.last_in_state:
                            state_msg = "0V (ENGEL)" if in_val == 0 else "3V (BOŞ)"
                            print(f"[GPIO] PIN {in_pin} DEĞİŞTİ: {state_msg}")
                            if in_val == 0: self._handle_input()
                            self.last_in_state = in_val

                        # Çıkış Sensörü Oku
                        out_val = lgpio.gpio_read(self.gpio_h, out_pin)
                        if out_val != self.last_out_state:
                            state_msg = "0V (ENGEL)" if out_val == 0 else "3V (BOŞ)"
                            print(f"[GPIO] PIN {out_pin} DEĞİŞTİ: {state_msg}")
                            if out_val == 0: self._handle_output()
                            self.last_out_state = out_val

                        time.sleep(0.1) # 100ms bekle (Saniyede 10 kontrol)
                    except Exception as e:
                        print(f"[GPIO] Polling Hatası: {e}")
                        break

            self.poll_thread = threading.Thread(target=poll_loop, daemon=True)
            self.poll_thread.start()

        except ImportError:
            print("\n[HATA] 'lgpio' kütüphanesi eksik!")
            print("Lütfen Pi 5 terminalinde: pip install lgpio --break-system-packages\n")
        except Exception as e:
            print(f"[GPIO] Kurulum Hatası: {e}")

    def _handle_input(self):
        print(">>> GİRİŞ SENSÖRÜ: SAYAÇ +1")
        if self.on_input_detected:
            self.on_input_detected()

    def _handle_output(self):
        print(">>> ÇIKIŞ SENSÖRÜ: SAYAÇ +1")
        if self.on_output_detected:
            self.on_output_detected()

    def cleanup(self):
        self.polling_active = False
        if self.serial_conn:
            self.serial_conn.close()
        try:
            import lgpio
            if hasattr(self, 'gpio_h'):
                lgpio.gpiochip_close(self.gpio_h)
        except Exception:
            pass
        print("[Hardware] Temizlik tamamlandı.")
