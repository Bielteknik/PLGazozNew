from gpiozero import Button
from signal import pause
import sys

# Raspberry Pi 5 - GPIO 17 Giriş Sensörü (Lazer)
# bounce_time: Elektriksel parazitleri engellemek için 200ms filtre.
# pull_up=True: Sensör boşta olduğunda sinyalin 3.3V'ta sabit kalmasını sağlar.

def on_trigger():
    print("DETECTED")
    sys.stdout.flush()

try:
    # Sensör cisim geldiğinde 0V'a düştüğü için (Active-Low),
    # gpiozero'da Button yapısı bunu 'pressed' olarak algılar.
    sensor = Button(17, pull_up=True, bounce_time=0.2)
    sensor.when_pressed = on_trigger
    
    # Başlangıç mesajı
    print("READY")
    sys.stdout.flush()
    
    pause()
except Exception as e:
    print(f"ERROR: {e}")
    sys.stdout.flush()
