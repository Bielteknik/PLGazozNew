import tkinter as tk
import customtkinter as ctk
import sys
import os
import threading
import asyncio
import time

# Server klasöründeki modülleri içe aktarmak için yolu ekle
sys.path.append(os.path.join(os.path.dirname(__file__), "server"))

from hardware import hw
from database import db
from production import ProductionManager
from gui_components import PremiumIndicator, PremiumStatCard, ModernButton


class PLGazozApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Donanım ve Mantık Katmanı
        self.pm = ProductionManager()
        self.pm.register_callback(self.on_production_update)
        
        # Ekran Ayarları
        self.title("PLGAZOZ INDUSTRIAL | CONTROL CENTER v2.5")
        self.geometry("1024x600")
        
        # Tam Ekran Ayarı
        self.attributes('-fullscreen', True)
        self.bind("<Escape>", lambda event: self.attributes("-fullscreen", False))

        # Tema Ayarları
        ctk.set_appearance_mode("dark") 
        self.configure(fg_color="#010409") # Ultra Dark Background

        # Grid Yapılandırması
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Referanslar
        self.indicators = {}
        self.stat_cards = {}
        self.loop = None # Arka plandaki asyncio döngüsü
        
        self.setup_sidebar()
        
        # Ana İçerik Alanı (Camgöbeği Efekti)
        self.main_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.main_frame.grid_columnconfigure(0, weight=1)
        
        self.show_dashboard()

        # Arka Plan İşlemleri Başlat
        self.stop_thread = False
        self.worker_thread = threading.Thread(target=self.background_worker, daemon=True)
        self.worker_thread.start()

    def setup_sidebar(self):
        self.sidebar_frame = ctk.CTkFrame(self, width=240, corner_radius=0, fg_color="#0D1117", border_width=1, border_color="#30363D")
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(5, weight=1)

        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="PLGAZOZ", font=ctk.CTkFont(family="Segoe UI", size=28, weight="bold"), text_color="#58A6FF")
        self.logo_label.grid(row=0, column=0, padx=20, pady=(40, 50))

        self.create_nav_btn("DASHBOARD", self.show_dashboard, 1)
        self.create_nav_btn("MANUEL KONTROL", self.show_manual, 2)
        self.create_nav_btn("REÇETELER", self.show_recipes, 3)
        self.create_nav_btn("MÜHENDİS MODU", self.show_settings, 4)

        self.status_indicator = ctk.CTkLabel(self.sidebar_frame, text="● SİSTEM ÇEVRİMİÇİ", font=ctk.CTkFont(size=11, weight="bold"), text_color="#3FB950")
        self.status_indicator.grid(row=6, column=0, pady=20)

        self.exit_button = ModernButton(self.sidebar_frame, "SİSTEMİ KAPAT", style="danger", command=self.on_closing, width=180)
        self.exit_button.grid(row=7, column=0, padx=20, pady=(0, 30))

    def create_nav_btn(self, text, command, row):
        btn = ctk.CTkButton(self.sidebar_frame, text=text, command=command, 
                             height=50, corner_radius=0, fg_color="transparent", 
                             text_color="#8B949E", hover_color="#161B22", anchor="w",
                             font=ctk.CTkFont(size=13, weight="bold"))
        btn.grid(row=row, column=0, sticky="ew")
        return btn

    def background_worker(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        SENSORS = [17, 27, 22] 
        
        while not self.stop_thread:
            try:
                states = {}
                for pin in SENSORS:
                    states[pin] = hw.read_sensor(pin)
                
                if not self.stop_thread:
                    self.after(0, self.update_sensor_lights, states)
                    self.loop.run_until_complete(self.pm.update(states))
                time.sleep(0.05)
            except Exception:
                time.sleep(1)

    def update_sensor_lights(self, states):
        for pin, widget in self.indicators.items():
            if widget.winfo_exists():
                widget.set_status(states.get(pin, False))

    def on_production_update(self, data):
        if not self.stop_thread:
            self.after(0, self.sync_ui_with_production, data)

    def sync_ui_with_production(self, data):
        if 'card_in' in self.stat_cards and self.stat_cards['card_in'].winfo_exists():
            self.stat_cards['card_in'].update_value(data['inputCount'])
            self.stat_cards['card_out'].update_value(data['outputCount'])
            
            # Durum Paneli Güncelleme
            if hasattr(self, 'state_label'):
                self.state_label.configure(text=data['state'].replace("_", " "))
                self.progress_bar.set(self.get_state_progress(data['state']))

    def get_state_progress(self, state):
        steps = {"BEKLEMEDE": 0, "GIRIS_SAYILIYOR": 0.2, "DOLUM": 0.5, "TAHLIYE": 0.8, "DOGRULAMA": 1.0}
        return steps.get(state, 0)

    def clear_main_frame(self):
        self.indicators = {}
        self.stat_cards = {}
        for widget in self.main_frame.winfo_children():
            widget.destroy()

    def show_dashboard(self):
        self.clear_main_frame()
        self.main_frame.grid_columnconfigure((0,1), weight=1)
        self.main_frame.grid_rowconfigure(1, weight=1)
        
        # ÜST BİLGİ BARI (React Tarzı)
        info_bar = ctk.CTkFrame(self.main_frame, height=40, fg_color="#161B22", corner_radius=6, border_width=1, border_color="#30363D")
        info_bar.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 20))
        info_bar.pack_propagate(False)
        ctk.CTkLabel(info_bar, text="AKTİF ÜRETİM HATTI #1", font=ctk.CTkFont(size=12, weight="bold"), text_color="#C9D1D9").pack(side="left", padx=20)
        ctk.CTkLabel(info_bar, text="OPERASYONEL DURUM: NORMAL", font=ctk.CTkFont(size=11), text_color="#3FB950").pack(side="right", padx=20)

        # SOL KOLON: SAYAÇLAR
        stats_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        stats_frame.grid(row=1, column=0, sticky="nsew", padx=(0, 10))
        stats_frame.grid_columnconfigure(0, weight=1)

        self.stat_cards['card_in'] = PremiumStatCard(stats_frame, "TOPLAM GİRİŞ", color="#58A6FF")
        self.stat_cards['card_in'].pack(fill="x", pady=(0, 15))

        self.stat_cards['card_out'] = PremiumStatCard(stats_frame, "TOPLAM ÇIKIŞ", color="#3FB950")
        self.stat_cards['card_out'].pack(fill="x")

        # SAĞ KOLON: SÜREÇ DURUMU (REACT GİBİ DOLU GÖRÜNÜM)
        process_frame = ctk.CTkFrame(self.main_frame, fg_color="#0D1117", border_width=1, border_color="#30363D", corner_radius=12)
        process_frame.grid(row=1, column=1, sticky="nsew", padx=(10, 0))
        
        ctk.CTkLabel(process_frame, text="CANLI SÜREÇ TAKİBİ", font=ctk.CTkFont(size=13, weight="bold"), text_color="#8B949E").pack(pady=20)
        
        self.state_label = ctk.CTkLabel(process_frame, text="BEKLEMEDE", font=ctk.CTkFont(family="Consolas", size=24, weight="bold"), text_color="#F0F6FC")
        self.state_label.pack(pady=10)
        
        self.progress_bar = ctk.CTkProgressBar(process_frame, width=300, height=12, fg_color="#21262D", progress_color="#1F6FEB")
        self.progress_bar.pack(pady=20)
        self.progress_bar.set(0)

        # SENSÖR MATRİSİ (Alt Kısım)
        sensor_frame = ctk.CTkFrame(process_frame, fg_color="transparent")
        sensor_frame.pack(pady=30, fill="x", padx=40)
        
        self.indicators[17] = PremiumIndicator(sensor_frame, "GİRİŞ SENSÖRÜ")
        self.indicators[17].pack(side="left", expand=True)
        self.indicators[27] = PremiumIndicator(sensor_frame, "ORTA SENSÖR")
        self.indicators[27].pack(side="left", expand=True)
        self.indicators[22] = PremiumIndicator(sensor_frame, "ÇIKIŞ SENSÖRÜ")
        self.indicators[22].pack(side="left", expand=True)

        # ALT KONTROL BARI
        controls = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        controls.grid(row=2, column=0, columnspan=2, pady=(20, 0), sticky="ew")
        
        ModernButton(controls, "OTOMATİK DÖNGÜYÜ BAŞLAT", style="success", command=self.start_auto, width=300).pack(side="left", padx=10)
        ModernButton(controls, "ACİL DURDURMA", style="danger", command=self.stop_system, width=300).pack(side="right", padx=10)

    def start_auto(self):
        self.pm.set_mode("OTOMATİK")
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.pm.start_auto_cycle(), self.loop)

    def stop_system(self):
        self.pm.set_mode("BEKLEMEDE")
        for i in range(1, 11):
            hw.set_valve("NANO-2", i, False)

    def show_manual(self):
        self.clear_main_frame()
        ctk.CTkLabel(self.main_frame, text="MANUEL DONANIM KONTROLÜ", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=(0, 20))
        
        v_frame = ctk.CTkFrame(self.main_frame, fg_color="#0D1117", border_width=1, border_color="#30363D", corner_radius=12)
        v_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        for i in range(1, 11):
            btn = ModernButton(v_frame, f"VALF {i}", width=120, command=lambda x=i: self.toggle_valve(x))
            btn.grid(row=(i-1)//5, column=(i-1)%5, padx=15, pady=20)

    def toggle_valve(self, valve_id):
        hw.set_valve("NANO-2", valve_id, True)
        self.after(2000, lambda: hw.set_valve("NANO-2", valve_id, False))

    def show_recipes(self):
        self.clear_main_frame()
        ctk.CTkLabel(self.main_frame, text="REÇETE KÜTÜPHANESİ", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=(0, 20))
        
        container = ctk.CTkScrollableFrame(self.main_frame, fg_color="transparent")
        container.pack(fill="both", expand=True)

        for r in db.get_recipes():
            f = ctk.CTkFrame(container, fg_color="#161B22", border_width=1, border_color="#30363D", height=70)
            f.pack(fill="x", pady=5)
            f.pack_propagate(False)
            ctk.CTkLabel(f, text=r['name'].upper(), font=ctk.CTkFont(size=14, weight="bold"), text_color="#C9D1D9").pack(side="left", padx=20)
            ModernButton(f, "REÇETEYİ YÜKLE", style="action", width=150, command=lambda x=r: self.load_recipe(x)).pack(side="right", padx=20)

    def load_recipe(self, recipe):
        self.pm.set_config(recipe)
        db.save_config(recipe)
        self.show_dashboard()

    def show_settings(self):
        self.clear_main_frame()
        ctk.CTkLabel(self.main_frame, text="MÜHENDİS MODU", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=(0, 20))
        
        f = ctk.CTkFrame(self.main_frame, fg_color="#161B22", border_width=1, border_color="#30363D", corner_radius=12)
        f.pack(fill="x", padx=50, pady=20)
        
        for g in [{"id": 1, "pin": 2}, {"id": 2, "pin": 3}]:
            row = ctk.CTkFrame(f, fg_color="transparent")
            row.pack(fill="x", padx=20, pady=10)
            ctk.CTkLabel(row, text=f"KİLİT {g['id']} YAPILANDIRMASI", font=ctk.CTkFont(size=13)).pack(side="left")
            ModernButton(row, "SENKRONİZE ET", style="primary", width=140, command=lambda: None).pack(side="right")

    def on_closing(self):
        self.stop_thread = True
        try:
            self.destroy()
        except Exception:
            pass

if __name__ == "__main__":
    app = PLGazozApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()



    def on_closing(self):
        self.stop_thread = True
        self.destroy()

if __name__ == "__main__":
    app = PLGazozApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
