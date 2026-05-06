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
from gui_components import StatusIndicator, StatCard, ControlButton

class PLGazozApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Donanım ve Mantık Katmanı
        self.pm = ProductionManager()
        self.pm.register_callback(self.on_production_update)
        
        # Ekran Ayarları
        self.title("PLGazoz Otomasyon Sistemi")
        self.geometry("1024x600")
        
        # Tam Ekran Ayarı
        self.attributes('-fullscreen', True)
        self.bind("<Escape>", lambda event: self.attributes("-fullscreen", False))

        # Tema Ayarları
        ctk.set_appearance_mode("light") 
        ctk.set_default_color_theme("blue")

        # Grid Yapılandırması
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.setup_sidebar()
        
        # Ana İçerik Alanı
        self.main_frame = ctk.CTkFrame(self, corner_radius=0)
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.main_frame.grid_columnconfigure(0, weight=1)
        self.main_frame.grid_rowconfigure(0, weight=1)

        self.show_dashboard()

        # Arka Plan İşlemleri Başlat
        self.stop_thread = False
        self.worker_thread = threading.Thread(target=self.background_worker, daemon=True)
        self.worker_thread.start()

    def setup_sidebar(self):
        self.sidebar_frame = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(5, weight=1)

        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="PLGAZOZ", font=ctk.CTkFont(size=24, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 30))

        self.btn_dashboard = ctk.CTkButton(self.sidebar_frame, text="Ana Panel", command=self.show_dashboard)
        self.btn_dashboard.grid(row=1, column=0, padx=20, pady=10)

        self.btn_manual = ctk.CTkButton(self.sidebar_frame, text="Manuel Kontrol", command=self.show_manual)
        self.btn_manual.grid(row=2, column=0, padx=20, pady=10)

        self.btn_recipes = ctk.CTkButton(self.sidebar_frame, text="Reçeteler", command=self.show_recipes)
        self.btn_recipes.grid(row=3, column=0, padx=20, pady=10)

        self.btn_settings = ctk.CTkButton(self.sidebar_frame, text="Ayarlar", command=self.show_settings)
        self.btn_settings.grid(row=4, column=0, padx=20, pady=10)

        self.appearance_mode_label = ctk.CTkLabel(self.sidebar_frame, text="Tema:", anchor="w")
        self.appearance_mode_label.grid(row=6, column=0, padx=20, pady=(10, 0))
        self.appearance_mode_optionemenu = ctk.CTkOptionMenu(self.sidebar_frame, values=["Light", "Dark"],
                                                                       command=self.change_appearance_mode)
        self.appearance_mode_optionemenu.grid(row=7, column=0, padx=20, pady=(10, 10))

        self.exit_button = ctk.CTkButton(self.sidebar_frame, text="Çıkış", fg_color="transparent", border_width=2, text_color=("gray10", "#DCE4EE"), command=self.on_closing)
        self.exit_button.grid(row=8, column=0, padx=20, pady=20)

    def background_worker(self):
        """Sensörleri tarayan ve mantık döngüsünü çalıştıran arka plan iş parçacığı."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        SENSORS = [17, 27, 22] # IN, MID, OUT
        
        while not self.stop_thread:
            try:
                states = {}
                for pin in SENSORS:
                    states[pin] = hw.read_sensor(pin)
                
                # UI'daki sensör ışıklarını güncelle
                self.after(0, self.update_sensor_lights, states)
                
                # Üretim mantığını işlet
                loop.run_until_complete(self.pm.update(states))
                
                time.sleep(0.05) # 50ms tarama hızı
            except Exception as e:
                print(f"Worker Error: {e}")
                time.sleep(1)

    def update_sensor_lights(self, states):
        if hasattr(self, 'ind_in'):
            self.ind_in.set_status(states.get(17, False))
            self.ind_mid.set_status(states.get(27, False))
            self.ind_out.set_status(states.get(22, False))

    def on_production_update(self, data):
        """ProductionManager'dan gelen güncellemeleri HMI'a yansıtır."""
        self.after(0, self.sync_ui_with_production, data)

    def sync_ui_with_production(self, data):
        if hasattr(self, 'card_in'):
            self.card_in.update_value(data['inputCount'])
            self.card_out.update_value(data['outputCount'])
            self.status_val_label.configure(text=data['state'])
            self.mode_val_label.configure(text=data['mode'])

    def change_appearance_mode(self, new_appearance_mode: str):
        ctk.set_appearance_mode(new_appearance_mode)

    def clear_main_frame(self):
        for widget in self.main_frame.winfo_children():
            widget.destroy()

    def show_dashboard(self):
        self.clear_main_frame()
        self.main_frame.grid_columnconfigure((0,1,2), weight=1)
        
        # Başlık ve Durumlar
        header_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        header_frame.grid(row=0, column=0, columnspan=3, sticky="ew", padx=20, pady=(0, 20))
        
        self.title_label = ctk.CTkLabel(header_frame, text="Sistem Özeti", font=ctk.CTkFont(size=24, weight="bold"))
        self.title_label.pack(side="left")
        
        self.mode_val_label = ctk.CTkLabel(header_frame, text="BEKLEMEDE", font=ctk.CTkFont(size=18), text_color="#3498db")
        self.mode_val_label.pack(side="right", padx=20)
        
        self.status_val_label = ctk.CTkLabel(header_frame, text="HAZIR", font=ctk.CTkFont(size=18), text_color="#2ecc71")
        self.status_val_label.pack(side="right")

        # Sayaç Kartları
        self.card_in = StatCard(self.main_frame, "Giren Şişe", value="0")
        self.card_in.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")

        self.card_out = StatCard(self.main_frame, "Çıkan Şişe", value="0")
        self.card_out.grid(row=1, column=1, padx=10, pady=10, sticky="nsew")

        # Sensör Göstergeleri
        sensor_frame = ctk.CTkFrame(self.main_frame)
        sensor_frame.grid(row=1, column=2, padx=10, pady=10, sticky="nsew")
        ctk.CTkLabel(sensor_frame, text="Sensör Durumları", font=ctk.CTkFont(weight="bold")).pack(pady=10)
        
        self.ind_in = StatusIndicator(sensor_frame, "Giriş (Lazer 1)")
        self.ind_in.pack(pady=5, padx=20, anchor="w")
        self.ind_mid = StatusIndicator(sensor_frame, "Orta (Lazer 2)")
        self.ind_mid.pack(pady=5, padx=20, anchor="w")
        self.ind_out = StatusIndicator(sensor_frame, "Çıkış (Lazer 3)")
        self.ind_out.pack(pady=5, padx=20, anchor="w")

        # Kontrol Butonları
        controls_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        controls_frame.grid(row=2, column=0, columnspan=3, pady=20, sticky="ew")
        controls_frame.grid_columnconfigure((0,1), weight=1)

        self.btn_start = ControlButton(controls_frame, "OTOMATİK BAŞLAT", color="green", command=self.start_auto)
        self.btn_start.grid(row=0, column=0, padx=20, pady=10, sticky="ew")

        self.btn_stop = ControlButton(controls_frame, "SİSTEMİ DURDUR", color="red", command=self.stop_system)
        self.btn_stop.grid(row=0, column=1, padx=20, pady=10, sticky="ew")

    def start_auto(self):
        self.pm.set_mode("OTOMATİK")
        asyncio.run_coroutine_threadsafe(self.pm.start_auto_cycle(), asyncio.get_event_loop())

    def stop_system(self):
        self.pm.set_mode("BEKLEMEDE")
        # Tüm valfleri kapat
        for i in range(1, 11):
            hw.set_valve("NANO-2", i, False)

    def show_manual(self):
        self.clear_main_frame()
        self.main_frame.grid_columnconfigure((0,1), weight=1)
        
        label = ctk.CTkLabel(self.main_frame, text="Manuel Valf ve Kapı Kontrolü", font=ctk.CTkFont(size=24, weight="bold"))
        label.grid(row=0, column=0, columnspan=2, padx=20, pady=20)

        # Valf Izgarası (2 sütun)
        valve_frame = ctk.CTkFrame(self.main_frame)
        valve_frame.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")
        ctk.CTkLabel(valve_frame, text="Valfler", font=ctk.CTkFont(weight="bold")).grid(row=0, column=0, columnspan=2, pady=10)

        for i in range(1, 11):
            row = (i-1) // 2 + 1
            col = (i-1) % 2
            btn = ctk.CTkButton(valve_frame, text=f"Valf {i}", width=100, 
                                 command=lambda x=i: self.toggle_valve(x))
            btn.grid(row=row, column=col, padx=5, pady=5)

        # Kapı Kontrolleri
        gate_frame = ctk.CTkFrame(self.main_frame)
        gate_frame.grid(row=1, column=1, padx=20, pady=10, sticky="nsew")
        ctk.CTkLabel(gate_frame, text="Kapılar (Servo/Step)", font=ctk.CTkFont(weight="bold")).pack(pady=10)

        ctk.CTkButton(gate_frame, text="Giriş Kapısı AÇ", fg_color="green", command=lambda: hw.set_gate("NANO-1", 1, 100)).pack(pady=10, padx=20, fill="x")
        ctk.CTkButton(gate_frame, text="Giriş Kapısı KAPAT", fg_color="red", command=lambda: hw.set_gate("NANO-1", 1, 0)).pack(pady=10, padx=20, fill="x")
        ctk.CTkButton(gate_frame, text="Çıkış Kapısı AÇ", fg_color="green", command=lambda: hw.set_gate("NANO-1", 2, 100)).pack(pady=10, padx=20, fill="x")
        ctk.CTkButton(gate_frame, text="Çıkış Kapısı KAPAT", fg_color="red", command=lambda: hw.set_gate("NANO-1", 2, 0)).pack(pady=10, padx=20, fill="x")

    def toggle_valve(self, valve_id):
        # Basit bir toggle mantığı. Gerçekte durum takibi yapılabilir.
        hw.set_valve("NANO-2", valve_id, True)
        self.after(2000, lambda: hw.set_valve("NANO-2", valve_id, False))

    def show_recipes(self):
        self.clear_main_frame()
        label = ctk.CTkLabel(self.main_frame, text="Reçete Listesi", font=ctk.CTkFont(size=24, weight="bold"))
        label.pack(pady=20)
        
        recipes = db.get_recipes()
        for r in recipes:
            btn = ctk.CTkButton(self.main_frame, text=f"{r['name']} ({r['volumeMl']}ml)", 
                                 command=lambda x=r: self.load_recipe(x))
            btn.pack(pady=5, padx=50, fill="x")

    def load_recipe(self, recipe):
        self.pm.set_config(recipe)
        db.save_config(recipe)
        self.show_dashboard()

    def show_settings(self):
        self.clear_main_frame()
        label = ctk.CTkLabel(self.main_frame, text="Sistem ve Port Ayarları", font=ctk.CTkFont(size=24, weight="bold"))
        label.pack(pady=20)
        
        ports = hw.scan_ports()
        for p in ports:
            ctk.CTkLabel(self.main_frame, text=f"Cihaz: {p['device']} - {p['description']}").pack()

    def on_closing(self):
        self.stop_thread = True
        self.destroy()

if __name__ == "__main__":
    app = PLGazozApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
