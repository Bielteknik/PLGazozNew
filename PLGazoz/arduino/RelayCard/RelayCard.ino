/**
 * PLGazoz Dolum Hattı - Nano 1 Firmware (RelayCard)
 * 16 Kanallı Röle Kartını Sürmek ve Valfleri Dinamik Kontrol Etmekten Sorumludur.
 * Haberleşme Hızı: 115200 Baud
 */

#define HANDSHAKE_ID "ID:Valfler"

String inputString = "";         // Gelen veriyi tutacak string
bool stringComplete = false;     // Satır sonu geldi mi?

// Aktif kullanılan pin durumlarını tutmak için
bool pinInitialized[14] = {false}; 

void setup() {
  Serial.begin(115200);
  inputString.reserve(100);
  
  // Güvenlik amacıyla başlangıçta tüm röle çıkış pinlerini (D2-D13) çıkış yap ve LOW yap
  for (int i = 2; i <= 13; i++) {
    pinMode(i, OUTPUT);
    digitalWrite(i, LOW); 
    pinInitialized[i] = true;
  }
  
  // Cihazın hazır olduğunu bildir
  delay(100);
  Serial.println("SYS:READY");
}

void loop() {
  // Seri porttan veri geldikçe oku
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    if (inChar == '\n') {
      stringComplete = true;
    } else if (inChar != '\r') {
      inputString += inChar;
    }
  }

  // Komut alındıysa işle
  if (stringComplete) {
    inputString.trim();
    processCommand(inputString);
    inputString = "";
    stringComplete = false;
  }
}

void processCommand(String cmd) {
  // 1. Handshake Teşhis Talebi
  if (cmd == "WHOAMI") {
    Serial.println(HANDSHAKE_ID);
    return;
  }

  // 2. Acil Durdurma / Hepsini Kapat
  if (cmd == "VALVE:ALL_OFF") {
    for (int i = 2; i <= 13; i++) {
      digitalWrite(i, LOW);
    }
    Serial.println("ACK:ALL_OFF_SUCCESS");
    return;
  }

  // 3. Dinamik Valf / Röle Açma-Kapatma Komutları
  // Format: VALVE:ON:D2 veya VALVE:OFF:D3 veya REFILL:ON:D10
  if (cmd.startsWith("VALVE:") || cmd.startsWith("REFILL:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);
    
    if (firstColon != -1 && secondColon != -1) {
      String action = cmd.substring(firstColon + 1, secondColon); // "ON" veya "OFF"
      String pinStr = cmd.substring(secondColon + 1);             // "D2" veya "D10"
      
      if (pinStr.startsWith("D")) {
        int pinNum = pinStr.substring(1).toInt();
        
        // Sınır güvenliği (Arduino Nano digital pinler D2 ile D13 arasındadır)
        if (pinNum >= 2 && pinNum <= 13) {
          // Dinamik olarak pini konfigüre et (setup'ta yapılmış olsa da emniyet için)
          if (!pinInitialized[pinNum]) {
            pinMode(pinNum, OUTPUT);
            pinInitialized[pinNum] = true;
          }
          
          if (action == "ON") {
            digitalWrite(pinNum, HIGH);
            Serial.print("ACK:");
            Serial.print(cmd);
            Serial.println(":SUCCESS");
          } else if (action == "OFF") {
            digitalWrite(pinNum, LOW);
            Serial.print("ACK:");
            Serial.print(cmd);
            Serial.println(":SUCCESS");
          }
        } else {
          Serial.println("ERR:PIN_OUT_OF_BOUNDS");
        }
      } else {
        Serial.println("ERR:INVALID_PIN_FORMAT");
      }
    } else {
      Serial.println("ERR:INVALID_COMMAND_SYNTAX");
    }
  }
}
