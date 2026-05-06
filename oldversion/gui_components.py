import customtkinter as ctk

class PremiumIndicator(ctk.CTkFrame):
    def __init__(self, master, label_text, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.label = ctk.CTkLabel(self, text=label_text, font=ctk.CTkFont(size=12, weight="bold"), text_color="#8B949E")
        self.label.pack(side="top", pady=(0, 5))
        self.outer = ctk.CTkFrame(self, width=40, height=8, corner_radius=4, fg_color="#21262D")
        self.outer.pack(side="top")
        self.inner = ctk.CTkFrame(self.outer, width=0, height=8, corner_radius=4, fg_color="#3FB950")
        self.inner.place(relx=0, rely=0)

    def set_status(self, active: bool):
        if not self.winfo_exists(): return
        if active:
            self.inner.configure(width=40, fg_color="#3FB950")
            self.outer.configure(border_width=1, border_color="#3FB950")
        else:
            self.inner.configure(width=0)
            self.outer.configure(border_width=0)

class PremiumStatCard(ctk.CTkFrame):
    def __init__(self, master, title, value="0", unit="", color="#58A6FF", **kwargs):
        super().__init__(master, corner_radius=12, border_width=1, border_color="#30363D", fg_color="#161B22", **kwargs)
        self.title_label = ctk.CTkLabel(self, text=title, font=ctk.CTkFont(size=11, weight="bold"), text_color="#8B949E")
        self.title_label.pack(pady=(15, 0), padx=20, anchor="w")
        self.value_label = ctk.CTkLabel(self, text=value, font=ctk.CTkFont(family="Consolas", size=48, weight="bold"), text_color=color)
        self.value_label.pack(pady=(0, 10), padx=20, anchor="w")
        if unit:
            self.unit = ctk.CTkLabel(self, text=unit, font=ctk.CTkFont(size=12), text_color="#484F58")
            self.unit.place(relx=0.9, rely=0.7, anchor="e")

    def update_value(self, new_value):
        if not self.winfo_exists(): return
        self.value_label.configure(text=str(new_value))

class ModernButton(ctk.CTkButton):
    def __init__(self, master, text, style="primary", **kwargs):
        # Height ve diğer çakışabilecek parametreleri kwargs'dan ayıkla
        h = kwargs.pop("height", 45)
        w = kwargs.pop("width", 140)
        
        colors = {
            "primary": {"fg": "#21262D", "hover": "#30363D", "text": "#58A6FF", "border": "#30363D"},
            "success": {"fg": "#238636", "hover": "#2EA043", "text": "#FFFFFF", "border": "#238636"},
            "danger":  {"fg": "#842029", "hover": "#A52834", "text": "#FFFFFF", "border": "#842029"},
            "action":  {"fg": "#1F6FEB", "hover": "#388BFD", "text": "#FFFFFF", "border": "#1F6FEB"}
        }
        c = colors.get(style, colors["primary"])
        super().__init__(master, text=text, font=ctk.CTkFont(size=14, weight="bold"), 
                         height=h, width=w, corner_radius=6, 
                         fg_color=c["fg"], hover_color=c["hover"], 
                         text_color=c["text"], border_width=1, border_color=c["border"], **kwargs)
