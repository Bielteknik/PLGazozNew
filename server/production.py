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
        self._start_auto_cycle_logic()
        await self.broadcast_update()

    def _start_auto_cycle_logic(self):
        if self.mode == "OTOMATİK":
            self.input_count = 0
            self.output_count = 0
            self.state = "GIRIS_SAYILIYOR"
            # Giriş kilit açık, Çıkış kilit kapalı
            hw.set_gate("NANO-1", 1, 100) 
            hw.set_gate("NANO-1", 2, 0)
            print("Auto Cycle Logic Executed")

    def start_auto_cycle_sync(self):
        self._start_auto_cycle_logic()
        self.broadcast_update_sync()

    async def update(self, sensor_states):
        """Sensör verileri değiştikçe main.py tarafından çağrılır."""
        self._update_logic(sensor_states)
        await self.broadcast_update()

    def update_sync(self, sensor_states):
        """hmi_bridge.py tarafından çağrılır."""
        self._update_logic(sensor_states)
        self.broadcast_update_sync()

    def _update_logic(self, sensor_states):
        if self.mode != "OTOMATİK":
            self._handle_counters_logic(sensor_states)
            return

        # OTOMATİK MOD STATE MACHINE
        if self.state == "GIRIS_SAYILIYOR":
            if self.detect_rising_edge(sensor_states, self.PIN_IN):
                self.input_count += 1
                
            if self.input_count >= self.config.get('targetCount', 3):
                self.state = "GIRIS_KILITLI"
                hw.set_gate("NANO-1", 1, 0) # Girişi Kapat
                self.state_start_time = time.time()

        elif self.state == "GIRIS_KILITLI":
            if time.time() - self.state_start_time >= (self.config.get('settlingTimeMs', 800) / 1000.0):
                self.state = "DOLUM"
                for i in range(1, 11):
                    hw.set_valve("NANO-2", i, True)
                self.state_start_time = time.time()

        elif self.state == "DOLUM":
            if time.time() - self.state_start_time >= (self.config.get('fillTimeMs', 4000) / 1000.0):
                for i in range(1, 11):
                    hw.set_valve("NANO-2", i, False)
                self.state = "DAMLA_BEKLEME"
                self.state_start_time = time.time()

        elif self.state == "DAMLA_BEKLEME":
            if time.time() - self.state_start_time >= (self.config.get('dripWaitTimeMs', 1200) / 1000.0):
                self.state = "TAHLIYE"
                hw.set_gate("NANO-1", 2, 100) # Çıkışı Aç

        elif self.state == "TAHLIYE":
            if self.detect_rising_edge(sensor_states, self.PIN_OUT):
                self.output_count += 1

            if self.output_count >= self.input_count and self.output_count > 0:
                self.state = "DOGRULAMA"
                self.state_start_time = time.time()

        elif self.state == "DOGRULAMA":
             if time.time() - self.state_start_time >= 1.0:
                 self._start_auto_cycle_logic()

        self.last_sensor_states = sensor_states.copy()

    def detect_rising_edge(self, current, pin):
        return current.get(pin, False) and not self.last_sensor_states.get(pin, False)

    async def handle_counters(self, sensor_states):
        if self._handle_counters_logic(sensor_states):
            await self.broadcast_update()

    def _handle_counters_logic(self, sensor_states):
        changed = False
        if self.detect_rising_edge(sensor_states, self.PIN_IN):
            self.input_count += 1
            changed = True
        if self.detect_rising_edge(sensor_states, self.PIN_OUT):
            self.output_count += 1
            changed = True
        
        self.last_sensor_states = sensor_states.copy()
        return changed

    async def broadcast_update(self):
        data = self._prepare_data()
        if self.sio:
            await self.sio.emit("production_update", data) # HMI bridge uses lowercase
            await self.sio.emit("PRODUCTION_UPDATE", data) # FastAPI uses uppercase
        
        for cb in self.callbacks:
            if asyncio.iscoroutinefunction(cb): await cb(data)
            else: cb(data)

    def broadcast_update_sync(self):
        data = self._prepare_data()
        if self.sio:
            self.sio.emit("production_update", data)
        for cb in self.callbacks:
            cb(data)

    def _prepare_data(self):
        return {
            "state": self.state,
            "inputCount": self.input_count,
            "outputCount": self.output_count,
            "mode": self.mode
        }

