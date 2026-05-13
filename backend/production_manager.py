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
        while True:
            try:
                mode = self.state.data.get("mode", "MANUEL")
                if mode == "OTOMATİK":
                    if not self.is_running:
                        await self.start_cycle()
                elif mode == "YIKAMA":
                    await self.run_washing_cycle()
                elif mode == "TAHLIYE":
                    await self.run_flush_cycle()
                else:
                    self.is_running = False
            except Exception as e:
                print(f"[Production] Döngü Hatası: {e}")
            await asyncio.sleep(0.5)

    async def run_washing_cycle(self):
        self.state.log("YIKAMA: Valf çalkalama başlatıldı.")
        valves = self.state.data.get("valves", [])
        try:
            while self.state.data.get("mode") == "YIKAMA":
                for v in valves:
                    if v.get("enabled"):
                        self.hw.control_valve(v["id"], True)
                await asyncio.sleep(0.5)
                for v in valves:
                    if v.get("enabled"):
                        self.hw.control_valve(v["id"], False)
                await asyncio.sleep(0.5)
        finally:
            for v in valves:
                self.hw.control_valve(v["id"], False)
            self.state.log("YIKAMA: Durduruldu, tüm valfler kapatıldı.")

    async def run_flush_cycle(self):
        self.state.log("TAHLİYE: Otomatik şişe boşaltma başlatıldı.")
        self.hw.all_off()
        self.hw.send_command("G2:400")
        while self.state.data.get("mode") == "TAHLIYE":
            in_count = self.state.data.get("inputCount", 0)
            out_count = self.state.data.get("outputCount", 0)
            if in_count > 0 and in_count == out_count:
                self.state.log(f"TAHLİYE: Tüm şişeler ({out_count}) çıktı.")
                break
            await asyncio.sleep(0.5)
        self.hw.send_command("G2:-400")
        self.state.data["mode"] = "BEKLEMEDE"
        self.state.log("TAHLİYE: Tamamlandı veya Durduruldu.")

    async def start_cycle(self):
        self.is_running = True
        self.state.log("OTOMATİK: Döngü başlatılıyor...")

        in_pin = self.state.data["inputGate"].get("pin", "G1")
        out_pin = self.state.data["outputGate"].get("pin", "G2")

        self.hw.control_gate(in_pin, 0)
        self.hw.control_gate(out_pin, 0)
        self.state.data["inputGate"]["isOpen"] = False
        self.state.data["outputGate"]["isOpen"] = False

        recipe_id = self.state.data["config"].get("recipeId")
        self.current_recipe = next((r for r in self.state.data["recipes"] if r["id"] == recipe_id), None)

        if not self.current_recipe:
            self.state.log("HATA: Aktif reçete bulunamadı!")
            self.state.set_mode("ARIZA")
            return

        target = self.current_recipe.get("targetCount", 1)
        fill_ms = self.current_recipe.get("fillTimeMs", 3000)
        settle_ms = self.current_recipe.get("settlingTimeMs", 500)
        drip_ms = self.current_recipe.get("dripWaitTimeMs", 500)

        self.state.log(f"Reçete: {self.current_recipe['name']} | Hedef: {target} şişe | Dolum: {fill_ms}ms")

        while self.state.data["mode"] == "OTOMATİK":
            if self.state.data.get("stopAfterCycleRequested"):
                self.state.data["stopAfterCycleRequested"] = False
                self.state.data["mode"] = "BEKLEMEDE"
                self.state.log("Döngü sonu bekleme istendi, üretim durduruldu.")
                self.is_running = False
                return

            cycle_start = time.time()
            self.state.data["inputCount"] = 0
            self.state.data["outputCount"] = 0

            # ADIM 1: Giriş kapısını aç, şişeleri say
            self.state.log("Giriş kapısı açılıyor, şişe sayımı başladı...")
            self.hw.control_gate(in_pin, 1)
            self.state.data["inputGate"]["isOpen"] = True

            first_bottle = True
            while self.state.data["inputCount"] < target:
                if self.state.data["mode"] != "OTOMATİK":
                    self.is_running = False
                    return
                await asyncio.sleep(0.05)

                if first_bottle and self.state.data["inputCount"] >= 1:
                    first_bottle = False
                    if self.state.data["outputGate"]["isOpen"]:
                        self.hw.control_gate(out_pin, 0)
                        self.state.data["outputGate"]["isOpen"] = False
                        self.state.log("İlk şişe algılandı, çıkış kapısı kapatıldı.")

            # ADIM 2: Giriş kapısını kapat
            self.hw.control_gate(in_pin, 0)
            self.state.data["inputGate"]["isOpen"] = False
            self.state.log(f"{target} şişe sayıldı, giriş kapısı kapatıldı.")

            # ADIM 3: Titreşim/yerleşme beklemesi
            self.state.log(f"Titreşim ve yerleşme bekleniyor ({settle_ms}ms)...")
            await asyncio.sleep(settle_ms / 1000.0)

            # ADIM 4: Dolum
            self.state.log(f"Valfler açılıyor, dolum başladı ({fill_ms}ms)...")
            for v in self.state.data.get("valves", []):
                if v.get("enabled"):
                    self.hw.control_valve(v["id"], True)
            await asyncio.sleep(fill_ms / 1000.0)
            for v in self.state.data.get("valves", []):
                self.hw.control_valve(v["id"], False)
            self.state.log("Dolum tamamlandı, valfler kapatıldı.")

            # ADIM 5: Damlatma beklemesi
            self.state.log(f"Damlatma bekleniyor ({drip_ms}ms)...")
            await asyncio.sleep(drip_ms / 1000.0)

            # ADIM 6: Çıkış kapısını aç, şişeleri say
            self.state.log("Çıkış kapısı açılıyor, şişe çıkışı başladı...")
            self.hw.control_gate(out_pin, 1)
            self.state.data["outputGate"]["isOpen"] = True

            while self.state.data["outputCount"] < self.state.data["inputCount"]:
                if self.state.data["mode"] != "OTOMATİK":
                    self.is_running = False
                    return
                await asyncio.sleep(0.05)

            self.hw.control_gate(out_pin, 0)
            self.state.data["outputGate"]["isOpen"] = False

            duration_ms = int((time.time() - cycle_start) * 1000)

            # ADIM 7: Doğrulama
            if self.state.data["inputCount"] == self.state.data["outputCount"]:
                self._save_cycle(recipe_id, duration_ms, True)
                self.state.log(f"Döngü tamamlandı ({duration_ms}ms). Yeni döngü başlıyor.")
                await asyncio.sleep(0.5)
            else:
                self._save_cycle(recipe_id, duration_ms, False)
                self.state.data["activePrompt"] = "COUNT_MISMATCH"
                self.state.data["promptData"] = {
                    "inputCount": self.state.data["inputCount"],
                    "outputCount": self.state.data["outputCount"]
                }
                self.state.log(f"UYARI: Giren ({self.state.data['inputCount']}) ve çıkan ({self.state.data['outputCount']}) eşit değil! Onay bekleniyor...")

                while self.state.data.get("activePrompt") == "COUNT_MISMATCH":
                    if self.state.data.get("stopAfterCycleRequested"):
                        self.state.data["stopAfterCycleRequested"] = False
                        self.state.data["activePrompt"] = None
                        self.state.data["mode"] = "BEKLEMEDE"
                        self.is_running = False
                        return
                    await asyncio.sleep(0.1)
                    if self.state.data["mode"] != "OTOMATİK":
                        self.is_running = False
                        return

                self.state.log("Kullanıcı onayı ile yeni döngü başlatılıyor.")

    def _save_cycle(self, recipe_id, duration_ms, success):
        record = {
            "id": f"CYC-{int(time.time())}",
            "recipeId": recipe_id,
            "timestamp": int(time.time()),
            "duration": duration_ms,
            "inputCount": self.state.data["inputCount"],
            "outputCount": self.state.data["outputCount"],
            "validationStatus": "PASS" if success else "FAIL"
        }
        self.db.add_cycle(record)
        history = self.db.get_cycle_history(50)
        self.state.data["cycleHistory"] = history

    def handle_sensor(self, device_id, sensor_type="IN"):
        if self.state.data.get("mode") not in ("OTOMATİK", "TAHLIYE", "YIKAMA"):
            return
        if sensor_type == "IN":
            self.state.increment_input()
        else:
            self.state.increment_output()
