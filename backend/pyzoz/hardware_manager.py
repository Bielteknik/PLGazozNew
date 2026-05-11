import serial
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
        
    def connect_serial(self, port='/dev/ttyUSB0', baudrate=115200):
        try:
            self.serial_conn = serial.Serial(port, baudrate, timeout=1)
            print(f"[Serial] Arduino Nano bağlandı: {port}")
            return True
        except Exception as e:
            print(f"[Serial] Bağlantı Hatası ({port}): {e}")
            return False

    def send_command(self, cmd):
        if self.serial_conn and self.serial_conn.is_open:
            try:
                full_cmd = f"{cmd}\n"
                self.serial_conn.write(full_cmd.encode())
                # print(f"[Serial] Komut Gönderildi: {cmd}")
            except Exception as e:
                print(f"[Serial] Yazma Hatası: {e}")

    def toggle_valve(self, pin, state):
        cmd = f"VALVE:{pin}:{'ON' if state else 'OFF'}"
        self.send_command(cmd)

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
