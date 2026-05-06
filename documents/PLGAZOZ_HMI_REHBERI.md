# PLGAZOZ INDUSTRIAL HMI - TEKNİK REHBER (v2.5)

Bu belge, Raspberry Pi 5 üzerinde çalışan Gazoz Dolum Hattı Otomasyonu için geliştirilen Flutter tabanlı HMI (İnsan Makine Arayüzü) ve Python Backend sisteminin detaylarını içerir.

## 1. SİSTEM MİMARİSİ
Sistem, yüksek performans ve stabilite için **Melez (Hybrid)** bir yapıda tasarlanmıştır:

*   **Frontend (Flutter):** Görsel arayüz, kullanıcı etkileşimi ve gerçek zamanlı veri görselleştirme.
*   **Backend (Python):** Donanım kontrolü (GPIO, Seri Port), üretim mantığı (State Machine) ve veritabanı yönetimi.
*   **Haberleşme Köprüsü:** Flutter ve Python arasında saniyede 20 kez (50ms) veri aktarımı yapan **Socket.io** protokolü.

---

## 2. DOSYA YAPISI
```text
PLGazoz/
├── hmi/                 # Flutter Kaynak Kodları (Arayüz)
│   ├── lib/main.dart    # Ana Uygulama ve Ekranlar
│   ├── lib/services/    # Socket.io Haberleşme Servisi
│   └── lib/widgets/     # Premium UI Bileşenleri
├── server/              # Python Kaynak Kodları (Backend)
│   ├── hmi_bridge.py    # Flutter ile konuşan ana sunucu
│   ├── hardware.py      # Pi 5 GPIO ve Arduino haberleşmesi
│   ├── production.py    # Otomatik üretim mantığı
│   └── database.py      # Reçete ve ayarlar (SQLite)
├── arduino/             # Arduino Nano Yazılımları
└── documents/           # Dökümantasyon
```

---

## 3. SAYFALAR VE ÖZELLİKLER
### A. Ana Panel (Dashboard)
*   **Canlı Sayaçlar:** Toplam giriş ve çıkış adetlerinin Orbitron fontuyla teknolojik sunumu.
*   **Süreç Takibi:** Makinenin anlık durumunu (Dolum, Tahliye vb.) gösteren ilerleme çubuğu.
*   **Sensör Matrisi:** L1, L2 ve L3 sensörlerinin canlı aktiflik durumları.

### B. Manuel Kontrol
*   **Valf Matrisi:** 10 adet dolum valfinin tek tek test edilebilmesi.
*   **Kapı Kontrolleri:** Giriş ve çıkış kilitlerinin manuel açılıp kapatılması.

### C. Reçete Kütüphanesi
*   Üretim parametrelerinin (Dolum süresi, hız vb.) tek dokunuşla sisteme yüklenmesi.

---

## 4. DONANIM BAĞLANTILARI
### Raspberry Pi 5 GPIO (Girişler)
*   **Giriş Sensörü (L1):** GPIO 17
*   **Orta Sensör (L2):** GPIO 27
*   **Çıkış Sensörü (L3):** GPIO 22

### Arduino Nano Kilit Kontrolü (NANO-1)
*   **ENA Pin:** Motorların cızırtı yapmasını önlemek için aktif kilit mekanizması.
*   **Giriş Kilit:** Pin 2
*   **Çıkış Kilit:** Pin 3

---

## 5. KURULUM VE ÇALIŞTIRMA
### Gereksinimler
*   Python 3.11+
*   Flutter SDK (Pi 5 üzerinde Linux masaüstü desteği aktif olmalı)
*   Python Kütüphaneleri: `python-socketio`, `eventlet`, `gpiozero`, `lgpio`

### Başlatma Sırası
1. **Backend Başlatma:**
   ```bash
   python server/hmi_bridge.py
   ```
2. **Frontend Başlatma:**
   ```bash
   cd hmi
   flutter run -d linux (veya windows/android)
   ```

---

## 6. ÖNEMLİ NOTLAR
*   **Geliştirici Modu:** Windows üzerinde test yaparken Windows Ayarlarından "Geliştirici Modu" açılmalıdır.
*   **Pi 5 GPIO:** Pi 5'te GPIO kontrolü için kullanıcının `gpio` grubuna dahil olduğundan emin olunmalıdır.
*   **Hız:** Haberleşme gecikmesi 5ms'nin altındadır, bu da gerçek zamanlı bir kontrol hissi sağlar.

---
**Geliştirici:** Antigravity AI
**Sürüm:** 2.5 (Premium Flutter Edition)
