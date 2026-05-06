import time
import asyncio
from hardware import hw
from database import db

class ProductionManager:
    def __init__(self, sio=None):
        self.sio = sio
        self.callbacks = [] # UI güncellemeleri için callback listesi
        self.mode = "BEKLEMEDE"
        self.state = "BEKLEMEDE"
        self.config = {}
        self.input_count = 0
        self.output_count = 0
        self.last_sensor_states = {}
        
        # Pins (Raspberry Pi GPIO)
        self.PIN_IN = 17
        self.PIN_MID = 27
        self.PIN_OUT = 22
        
        self.state_start_time = 0
        
        # Load initial config
        saved_config = db.get_config()
        if saved_config:
            self.config = saved_config

    def register_callback(self, callback):
        self.callbacks.append(callback)

    def set_config(self, config):
        self.config = config

    def set_mode(self, mode):
        print(f"Production Mode Changed: {self.mode} -> {mode}")
        self.mode = mode
        if mode != "OTOMATİK":
            self.state = "BEKLEMEDE"
        # Reset counters on mode change? User said "döngü bitiyor yeni döngü başlıyor" 
        # so we probably reset at start of OTOMATIK.
        
    async def start_auto_cycle(self):
        """HMI'dan gelen BAŞLAT komutu ile tetiklenir."""
        if self.mode == "OTOMATİK":
            self.input_count = 0
            self.output_count = 0
            self.state = "GIRIS_SAYILIYOR"
            # Giriş kilit açık, Çıkış kilit kapalı
            hw.set_gate("NANO-1", 1, 100) 
            hw.set_gate("NANO-1", 2, 0)
            await self.broadcast_update()
            print("Auto Cycle Started")

    async def update(self, sensor_states):
        """Sensör verileri değiştikçe main.py veya GUI tarafından çağrılır."""
        
        if self.mode != "OTOMATİK":
            # Manuel modda sadece sayaçları güncelle (test için)
            await self.handle_counters(sensor_states)
            return

        # OTOMATİK MOD STATE MACHINE
        if self.state == "GIRIS_SAYILIYOR":
            if self.detect_rising_edge(sensor_states, self.PIN_IN):
                self.input_count += 1
                await self.broadcast_update()
                
            if self.input_count >= self.config.get('targetCount', 3):
                self.state = "GIRIS_KILITLI"
                hw.set_gate("NANO-1", 1, 0) # Girişi Kapat
                self.state_start_time = time.time()
                await self.broadcast_update()

        elif self.state == "GIRIS_KILITLI":
            # Çalkalanma/Dengelenme bekleme
            if time.time() - self.state_start_time >= (self.config.get('settlingTimeMs', 800) / 1000.0):
                self.state = "DOLUM"
                # Valfleri Aç (Aktif olanları)
                for i in range(1, 11):
                    hw.set_valve("NANO-2", i, True)
                self.state_start_time = time.time()
                await self.broadcast_update()

        elif self.state == "DOLUM":
            # Dolum süresi
            if time.time() - self.state_start_time >= (self.config.get('fillTimeMs', 4000) / 1000.0):
                # Valfleri Kapat
                for i in range(1, 11):
                    hw.set_valve("NANO-2", i, False)
                self.state = "DAMLA_BEKLEME"
                self.state_start_time = time.time()
                await self.broadcast_update()

        elif self.state == "DAMLA_BEKLEME":
            # Damlama bekleme
            if time.time() - self.state_start_time >= (self.config.get('dripWaitTimeMs', 1200) / 1000.0):
                self.state = "TAHLIYE"
                hw.set_gate("NANO-1", 2, 100) # Çıkışı Aç
                await self.broadcast_update()

        elif self.state == "TAHLIYE":
            if self.detect_rising_edge(sensor_states, self.PIN_OUT):
                self.output_count += 1
                await self.broadcast_update()

            if self.output_count >= self.input_count and self.output_count > 0:
                # Tahliye tamamlandı
                self.state = "DOGRULAMA"
                self.state_start_time = time.time()
                await self.broadcast_update()

        elif self.state == "DOGRULAMA":
             if time.time() - self.state_start_time >= 1.0:
                 # Yeni döngüye başla
                 await self.start_auto_cycle()

        self.last_sensor_states = sensor_states.copy()

    def detect_rising_edge(self, current, pin):
        return current.get(pin, False) and not self.last_sensor_states.get(pin, False)

    async def handle_counters(self, sensor_states):
        changed = False
        if self.detect_rising_edge(sensor_states, self.PIN_IN):
            self.input_count += 1
            changed = True
        if self.detect_rising_edge(sensor_states, self.PIN_OUT):
            self.output_count += 1
            changed = True
        
        if changed:
            await self.broadcast_update()
        
        self.last_sensor_states = sensor_states.copy()

    async def broadcast_update(self):
        data = {
            "state": self.state,
            "inputCount": self.input_count,
            "outputCount": self.output_count,
            "mode": self.mode
        }
        
        # Socket.IO ile gönder
        if self.sio:
            await self.sio.emit("PRODUCTION_UPDATE", data)
        
        # Yerel callback'leri tetikle
        for cb in self.callbacks:
            if asyncio.iscoroutinefunction(cb):
                await cb(data)
            else:
                cb(data)

