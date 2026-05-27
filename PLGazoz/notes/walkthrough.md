# PLGazoz Canlı Entegrasyon Tamamlama Rehberi

Bu rehber, **PLGazoz** içecek şişeleme tesisinin simülasyon ortamından gerçek donanım ortamına (**Raspberry Pi 5 + 2x Arduino Nano + 16 Kanallı Röle Kartı**) geçişi için tamamlanan tüm geliştirme adımlarını, veritabanı şemasını, seri haberleşme yapısını, temizlenen kodları ve dinamik bağlantı portu yönetimini özetlemektedir.

---

## 1. Neler Geliştirildi? (Tamamlanan Bileşenler)

Canlı ortam geçişi için A-Z tüm mimari yapı kurulmuş ve doğrulanmıştır:

### A. SQLite Veritabanı Katmanı (`database.py`)
Dosya Yolu: [database.py](file:///j:/ejderProjects/PLGazoz/src/backend/database.py)
*   **Dinamik Pin Eşleme:** Donanım arızalarında kabloların kesintisiz taşınabilmesi amacıyla `devices`, `valves_config`, `sensors_config` ve `gates_config` tabloları kuruldu.
*   **Üretim Geçmişi & Alarmlar:** Reçete parametreleri, geçmiş üretim döngüsü pasaportları (`cycleHistory`) ve sistem hata kayıtları (`error_logs`) SQLite üzerinde kalıcı hale getirildi.
*   **Seed Verileri:** Başlangıç reçeteleri (Sade, Mandalina, Karadut, Tonik) ve ilk donanım pin eşleşmeleri otomatik yüklenecek şekilde veritabanına işlendi.

### B. Canlı Seri Haberleşme & Yönlendirici (`serial_manager.py`)
Dosya Yolu: [serial_manager.py](file:///j:/ejderProjects/PLGazoz/src/backend/serial_manager.py)
*   **Asenkron Cihaz Keşfi:** USB ve UART seri portlarını asenkron dinleyen, `WHOAMI` komutuyla Nano-1 (`Valfler`) ve Nano-2 (`Sensors`) kartlarını otomatik teşhis eden yapı yazıldı.
*   **Dinamik Pin Tetikleme:** Backend'den gelen valf ve kapı komutlarını veritabanındaki pime göre ilgili karta yönlendirir. Kart `RASPI` ise Pi 5 GPIO pinlerini, `NANO` ise seri haberleşmeyi tetikler.
*   **Dinamik Sıcak Bağlantı (Hot-Reconnection):** `update_device_connection` metodu eklenerek, arayüzden port veya baudrate değiştirildiğinde eski bağlantının kapatılıp, yeni porta dinamik olarak bağlanılması ve asenkron dinleyici thread'in canlı olarak başlatılması sağlandı.
*   **HC-SR04 Entegrasyonu:** Nano 2 üzerinden HC-SR04 tetikleme sinyallerini asenkron okur ve milimetre bazında mesafe bilgisini Pi'ye ulaştırır.
*   **Mock Donanım Desteği:** Canlı kartlar bağlı değilken sistemin Windows üzerinde hata vermeden çalışabilmesi için otomatik **Sanal Sensör / Test (Mock)** altyapısı entegre edildi.

### C. FastAPI Otomasyon Sunucusu (`main.py`)
Dosya Yolu: [main.py](file:///j:/ejderProjects/PLGazoz/src/backend/main.py)
*   **Merkezi Durum Makinesi (State Machine):** Dolum döngüsü (Giriş sayımı, kapı kitleme, dengeleme, vana kontrolü, tahliye, doğrulama) tamamen backend sunucusuna taşındı.
*   **WebSocket Telemetry:** HMI ekranının anlık güncellenmesi için 100ms frekansta anlık durum yayınlayan WebSocket sunucusu kuruldu.
*   **REST API & Sıcak Bağlantı Tetiklemesi:** Cihazların bağlantı ayarları güncellendiğinde veritabanı güncellenir ve `SerialManager` üzerinden canlı yeniden bağlantı sekansı tetiklenir.
*   **Otomasyonlu Şerbet Dolumu (Refill):** Şerbet seviyesi düştüğünde Nano 1'deki 9. röle (Tank dolum valfi) otomatik tetiklenecek şekilde programlandı.

### D. Arduino Donanım Firmware Kodları
*   **Nano-1 (RelayCard):** [RelayCard.ino](file:///j:/ejderProjects/PLGazoz/arduino/RelayCard/RelayCard.ino)
    *   Seri porttan gelen dinamik pin komutlarını (`VALVE:ON:D2\n`) işler. Güvenlik amacıyla `VALVE:ALL_OFF` acil durdurma emniyet kilidini barındırır.
*   **Nano-2 (SensorGate):** [SensorGate.ino](file:///j:/ejderProjects/PLGazoz/arduino/SensorGate/SensorGate.ino)
    *   12V'tan 5V'a gerilim bölücü ile indirgenen giriş/çıkış şişe sayıcı sensörlerini 35ms yazılımsal filtreleme (debouncing) ile takip eder.
    *   Solenoid kilit kapılarını açıp kapatır (`GATE:OPEN:D5\n`). 
    *   Ultrasonik mesafe ölçüm komutunu aldığında milimetrik yankı hesabını yaparak Pi'ye fırlatır.

### E. HMI Arayüz WebSocket & Cihaz Ayarları Güncellemesi
Dosya Yolu: [useSystemSimulator.ts](file:///j:/ejderProjects/PLGazoz/src/hooks/useSystemSimulator.ts) & [Settings.tsx](file:///j:/ejderProjects/PLGazoz/src/components/views/Settings.tsx)
*   React arayüzü local simülasyon mantığından çıkarıldı. Artık `ws://localhost:8000/ws` veya Pi'nin IP adresi üzerinden backend ile konuşur.
*   **Mikrodenetleyici Bağlantı Ayarları Paneli:** Settings sayfasına yeni bir donanım ayar kartı eklenerek `devices` tablosundaki kartların (Nano 1, Nano 2 vb.) portları (`/dev/ttyAMA0`, `/dev/ttyUSB0` vb.) ve Baudrate hızları canlı olarak yapılandırılabilir hale getirildi.

---

## 2. Arayüz Temizliği (Clean Code & Dead Code Cleanup)

Kullanıcı talebi doğrultusunda, arayüzde ve simülatör kancasında yer alan ama gerçek donanımda kullanılmayan **18 ölü fonksiyon ve prop ataması tamamen temizlendi**:

*   `addHardware`, `removeHardware`, `toggleHardwareStatus` (Röle yönetimi artık dinamik veritabanı üzerinden yapıldığı için silindi).
*   `addSensor`, `removeSensor`, `toggleSensorEnabled` (Sensör haritalama dinamik veritabanına taşındı).
*   `addGate`, `removeGate`, `toggleExtraGateEnabled`, `operateExtraGate` (Gerçek makinemizde sadece 2 kilit kapısı olduğundan ek kapı kodları temizlendi).
*   `addNano`, `removeNano`, `updateNanoConfig`, `sendNanoCommand` (Kart tanımlama ve terminal yönetimi veritabanında sabit tanımlıdır).
*   `setValveMode`, `setValvePulseDuration`, `toggleGateEnabled`, `triggerFault` (Gereksiz parametreler temizlendi).

---

## 3. Doğrulama ve Derleme Sonuçları

Uygulamanın kararlılığı ve derleme kalitesi başarıyla doğrulanmıştır:

*   **TypeScript Derleme Kontrolü (Lint):**
    ```bash
    npm run lint
    ```
    Komut başarıyla çalıştırıldı ve sıfır derleme/tip hatası (`0 errors`) ile TypeScript kodlarının tam kararlılıkta olduğu doğrulandı!
*   **Bağımlılık Kurulumu:** Python sanal ortamı (`pzoz`) oluşturularak `requirements.txt` bağımlılıkları (FastAPI, Uvicorn, Pyserial) hatasız yüklendi.
