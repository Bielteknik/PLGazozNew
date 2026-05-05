import time
try:
    import RPi.GPIO as GPIO
except ImportError:
    class MockGPIO:
        BCM = 'BCM'
        IN = 'IN'
        OUT = 'OUT'
        PUD_UP = 'PUD_UP'
        LOW = 0
        HIGH = 1
        @staticmethod
        def setmode(mode): pass
        @staticmethod
        def setup(pin, mode, pull_up_down=None): pass
        @staticmethod
        def input(pin): return 1
        @staticmethod
        def output(pin, val): pass
    GPIO = MockGPIO()

class SensorManager:
    def __init__(self):
        GPIO.setmode(GPIO.BCM)
        self.distance_trig = 23 # Örnek pin
        self.distance_echo = 24 # Örnek pin
        GPIO.setup(self.distance_trig, GPIO.OUT)
        GPIO.setup(self.distance_echo, GPIO.IN)

    def read_laser(self, pin: int):
        """Lazer sensör (Sayaç) okuma - Aktifse True döner"""
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        return GPIO.input(pin) == GPIO.LOW

    def read_distance(self):
        """Ultrasonik mesafe sensörü okuma (cm)"""
        GPIO.output(self.distance_trig, False)
        time.sleep(0.000002)
        GPIO.output(self.distance_trig, True)
        time.sleep(0.00001)
        GPIO.output(self.distance_trig, False)

        start_time = time.time()
        stop_time = time.time()

        while GPIO.input(self.distance_echo) == 0:
            start_time = time.time()
        
        while GPIO.input(self.distance_echo) == 1:
            stop_time = time.time()

        elapsed = stop_time - start_time
        distance = (elapsed * 34300) / 2
        return round(distance, 1)

sensors = SensorManager()
