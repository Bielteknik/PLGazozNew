import customtkinter as ctk

class StatusIndicator(ctk.CTkFrame):
    """Küçük bir LED göstergesi gibi davranan bileşen."""
    def __init__(self, master, label_text, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        self.label = ctk.CTkLabel(self, text=label_text, font=ctk.CTkFont(size=14))
        self.label.pack(side="left", padx=(0, 10))
        
        self.indicator = ctk.CTkFrame(self, width=20, height=20, corner_radius=10, fg_color="gray")
        self.indicator.pack(side="right")

    def set_status(self, active: bool):
        color = "#2ecc71" if active else "gray" # Yeşil veya Gri
        self.indicator.configure(fg_color=color)

class StatCard(ctk.CTkFrame):
    """Sayısal verileri göstermek için kullanılan büyük kart bileşeni."""
    def __init__(self, master, title, value="0", unit="", **kwargs):
        super().__init__(master, corner_radius=15, **kwargs)
        
        self.title_label = ctk.CTkLabel(self, text=title, font=ctk.CTkFont(size=16, weight="bold"))
        self.title_label.pack(pady=(15, 5))
        
        self.value_label = ctk.CTkLabel(self, text=f"{value}{unit}", font=ctk.CTkFont(size=36, weight="bold"))
        self.value_label.pack(pady=(0, 15))

    def update_value(self, new_value):
        self.value_label.configure(text=str(new_value))

class ControlButton(ctk.CTkButton):
    """Özel renkli büyük kontrol butonları."""
    def __init__(self, master, text, color="blue", **kwargs):
        super().__init__(master, text=text, font=ctk.CTkFont(size=18, weight="bold"), height=50, corner_radius=10, **kwargs)
        
        if color == "green":
            self.configure(fg_color="#27ae60", hover_color="#219150")
        elif color == "red":
            self.configure(fg_color="#e74c3c", hover_color="#c0392b")
        elif color == "orange":
            self.configure(fg_color="#f39c12", hover_color="#d35400")
