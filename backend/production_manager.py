import asyncio
import time

class ProductionManager:
    def __init__(self, state, hw, db):
        self.state = state
        self.hw = hw
        self.db = db
        self.current_recipe = None
        self.is_running = False
        self.pending_config_change = False

    async def run_loop(self):
        """Ana üretim döngüsü."""
        while True:
            try:
                # Mod verisi yoksa varsayılan MANUEL yap
                mode = self.state.data.get("mode", "MANUEL")
                if mode == "OTOMATİK":
                    if not self.is_running:
                        await self.start_cycle()
                else:
                    self.is_running = False
            except Exception as e:
                print(f"[Production] Döngü Hatası: {e}")
            
            await asyncio.sleep(0.5)

    async def start_cycle(self):
        """Yeni bir üretim döngüsü başlatır."""
        self.is_running = True
        self.state.log("OTOMATİK: Döngü başlatılıyor...")
        
        # 1. Başlangıç Durumu: Tüm kilitleri kapat (Dinamik komutlar alınır)
        in_gate_cmd = self.state.data["inputGate"].get("pin", "G1")
        out_gate_cmd = self.state.data["outputGate"].get("pin", "G2")
        
        self.hw.control_gate(in_gate_cmd, 0)
        self.hw.control_gate(out_gate_cmd, 0)
        self.state.data["inputGate"]["isOpen"] = False
        self.state.data["outputGate"]["isOpen"] = False
        
        # 2. Reçeteyi Kilitle (Snapshot)
        recipe_id = self.state.data["config"].get("recipeId")
        self.current_recipe = next((r for r in self.state.data["recipes"] if r["id"] == recipe_id), None)
        
        if not self.current_recipe:
            self.state.log("HATA: Aktif reçete bulunamadı!")
            self.state.set_mode("ARIZA")
            return

        target_count = self.current_recipe.get("targetCount", 1)
        self.state.log(f"Döngü Başladı: {self.current_recipe['name']} ({target_count} Şişe)")

        while self.state.data["mode"] == "OTOMATİK":
            # --- ADIM 1: ŞİŞE TOPLAMA ---
            self.state.log("ADIM 1: Şişe girişi bekleniyor...")
            self.state.data["inputCount"] = 0
            self.state.data["outputCount"] = 0
            
            # Giriş kilidini aç
            self.hw.control_gate(in_gate_cmd, 1)
            self.state.data["inputGate"]["isOpen"] = True
            
            # Reçetedeki adet kadar şişe girene kadar bekle
            while self.state.data["inputCount"] < target_count:
                if self.state.data["mode"] != "OTOMATİK": return
                await asyncio.sleep(0.1)
            
            # Adet doldu, giriş kilidini kapat
            self.hw.control_gate(in_gate_cmd, 0)
            self.state.data["inputGate"]["isOpen"] = False
            self.state.log(f"ADIM 2: {target_count} şişe alındı. Giriş kilitlendi.")
            
            # --- ADIM 2: DOLUM ---
            fill_time = self.current_recipe.get("fillTimeMs", 1000) / 1000.0
            self.state.log(f"ADIM 3: Dolum yapılıyor ({fill_time} sn)...")
            
            # Tüm aktif vanaları aç
            for v in self.state.data.get("valves", []):
                if v.get("enabled"):
                    self.hw.control_valve(v["pin"], True)
            
            await asyncio.sleep(fill_time)
            
            # Vanaları kapat
            for v in self.state.data.get("valves", []):
                self.hw.control_valve(v["pin"], False)
            
            # --- ADIM 3: DENGELEME ---
            settle_time = self.current_recipe.get("settlingTimeMs", 500) / 1000.0
            self.state.log(f"ADIM 4: Sıvı dengeleme bekleniyor ({settle_time} sn)...")
            await asyncio.sleep(settle_time)
            
            # --- ADIM 4: ŞİŞE ÇIKIŞI ---
            self.state.log("ADIM 5: Şişeler tahliye ediliyor...")
            self.hw.control_gate(out_gate_cmd, 1)
            self.state.data["outputGate"]["isOpen"] = True
            
            # Giren şişe sayısı ile çıkan şişe sayısı eşitlenene kadar bekle
            while self.state.data["outputCount"] < self.state.data["inputCount"]:
                if self.state.data["mode"] != "OTOMATİK": return
                await asyncio.sleep(0.1)
            
            # Tahliye bitti, çıkış kilidini kapat
            self.hw.control_gate(out_gate_cmd, 0)
            self.state.data["outputGate"]["isOpen"] = False
            self.state.log("Döngü Tamamlandı. Yeni döngüye geçiliyor.")
            
            # Her döngü sonunda bir miktar bekle
            await asyncio.sleep(1)
            
            # Değişiklik kontrolü (Eğer parametreler değiştiyse döngü başında durabilir veya prompt verebiliriz)
            # Şimdilik direkt devam ediyor.
