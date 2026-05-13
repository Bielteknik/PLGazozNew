# PLGazoz Endüstriyel Haberleşme Sözlüğü (V1.0)

Bu döküman, Raspberry Pi 5 (Master) ve Arduino Nano (Slave) modülleri arasındaki ortak dili tanımlar.

## 1. Genel Kurallar
- Tüm mesajlar satır sonu karakteri (`\n`) ile biter.
- Ayırıcı olarak iki nokta üst üste (`:`) kullanılır.
- Veri tipi her zaman metindir (String).

---

## 2. Master -> Slave Emirleri (Pi 5'ten Nano'ya)
Format: `CMD:ACTION:PARAM1:PARAM2`

| Komut | Açıklama | Örnek |
| :--- | :--- | :--- |
| `VALVE:ID:STATE` | Belirli bir vanayı açar/kapatır. | `VALVE:10:ON`, `VALVE:ALL:OFF` |
| `GATE:ID:STEPS` | Kapı motoruna adım attırır. | `GATE:1:400` (Giriş Aç), `GATE:1:-400` (Giriş Kapat) |
| `WASH:START:MS` | Otomatik yıkama döngüsünü başlatır. | `WASH:START:500` (500ms aralıklarla) |
| `WASH:STOP` | Yıkamayı anında durdurur. | `WASH:STOP` |
| `FLUSH:START` | Şişe Tahliyesi (Çıkış Kapısını Aç) başlatır. | `FLUSH:START` |
| `FLUSH:STOP` | Şişe Tahliyesini durdurur (Kapıyı Kapat). | `FLUSH:STOP` |
| `PING` | Bağlantı kontrolü. | `PING` |

---

## 3. Slave -> Master Cevapları (Nano'dan Pi 5'e)
Format: `DEVICE_ID:RESPONSE:ACTION:STATUS`

| Cevap | Açıklama | Örnek |
| :--- | :--- | :--- |
| `ACK` | Emir alındı, işleme başlandı. | `ValvesNano:ACK:WASH:OK` |
| `DONE` | İşlem başarıyla tamamlandı. | `ValvesNano:DONE:WASH:SUCCESS` |
| `STATUS` | Cihazın anlık durum raporu. | `ValvesNano:STATUS:WASHING` |
| `ERR` | Hata bildirimi. | `ValvesNano:ERR:VALVE:NOT_FOUND` |
| `READY` | Cihaz boşa çıktı, yeni emir bekliyor. | `ValvesNano:STATUS:READY` |

---

## 4. Olay ve Telemetri Bildirimleri (Otonom Mesajlar)
Nano bir emir beklemeden şu durumları raporlar:

| Kod | Açıklama | Örnek |
| :--- | :--- | :--- |
| `SENSOR` | Sensör tetiklenmesi. | `GatesNano:SENSOR:IN`, `GatesNano:SENSOR:OUT` |
| `ID` | Kimlik bildirimi (Port bulma için). | `ID:ValvesNano`, `ID:GatesNano` |
| `LOG` | Donanım seviyesinde bilgi/uyarı. | `ValvesNano:LOG:OVERHEAT_WARNING` |

---

## 5. Gelecek Planları (Geliştirilecekler)
- [ ] `FLOW:ID:RATE` (Debimetre verisi ekleme)
- [ ] `BATCH:START:COUNT` (Belirli sayıda şişe için üretim emri)
- [ ] `SECURITY:LOCK` (Acil durdurma kilidi)
