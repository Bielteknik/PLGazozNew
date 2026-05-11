import serial
import serial.tools.list_ports
import time
import threading
from gpiozero import Button
import sys

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

    def connect_serial(self, port='/dev/ttyUSB0', baudrate=115200):
        try:
            self.serial_conn = serial.Serial(port, baudrate, timeout=1)
            print(f"[Serial] Bağlandı: {port}")
            return True
        except Exception as e:
            print(f"[Serial] Hata ({port}): {e}")
            return False

    def connect_to_port(self, port, baudrate=115200):
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
        cmd = f"VALVE:{pin}:{'ON' if state else 'OFF'}"
        self.send_command(cmd)

    def toggle_valve(self, pin, state):
        """Alias for control_valve"""
        self.control_valve(pin, state)

    def all_off(self):
        self.send_command("ALL:OFF")

    def setup_gpio(self, input_pin=17, output_pin=27):
        try:
            # Giriş Sensörü (Lazer 1)
            self.sensors['input'] = Button(input_pin, pull_up=True, bounce_time=0.2)
            self.sensors['input'].when_pressed = self._handle_input
            
            # Çıkış Sensörü (Lazer 2)
            self.sensors['output'] = Button(output_pin, pull_up=True, bounce_time=0.2)
            self.sensors['output'].when_pressed = self._handle_output
            
            print(f"[GPIO] Sensörler hazırlandı: Giriş(P{input_pin}), Çıkış(P{output_pin})")
        except Exception as e:
            print(f"[GPIO] Kurulum Hatası: {e}")

    def _handle_input(self):
        if self.on_input_detected:
            self.on_input_detected()

    def _handle_output(self):
        if self.on_output_detected:
            self.on_output_detected()

    def cleanup(self):
        if self.serial_conn:
            self.serial_conn.close()
        for s in self.sensors.values():
            s.close()
        print("[Hardware] Temizlik tamamlandı.")
