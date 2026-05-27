/**
 * PLGazoz Dolum Hattı - Nano 2 Firmware (SensorGate)
 * Giriş/Çıkış Lazer Sensörlerini, HC-SR04 Seviye Sensörünü ve Solenoid Kapıları
 * İzler. Haberleşme Hızı: 115200 Baud
 */

#define HANDSHAKE_ID "ID:Sensors"

String inputString = "";     // Gelen veriyi tutacak string
bool stringComplete = false; // Satır sonu geldi mi?

// Sensör durum ve debounce (filtre) değişkenleri
const int SENS_IN_PIN = 2;  // Giriş Lazer Sensörü (Giriş Sayacı)
const int SENS_OUT_PIN = 3; // Çıkış Lazer Sensörü (Çıkış Sayacı)

int lastInState =
    HIGH; // Eski durum (NPN NC Sensör önünde engel yokken 12V -> 5V yani HIGH)
int lastOutState = HIGH;

unsigned long lastInDebounce = 0;
unsigned long lastOutDebounce = 0;
const unsigned long DEBOUNCE_DELAY = 35; // 35ms parazit süzme filtresi

void setup() {
  Serial.begin(115200);
  inputString.reserve(100);

  // Sensör pinlerini giriş ve dahili pullup olarak konfigüre et (Emniyet için)
  pinMode(SENS_IN_PIN, INPUT_PULLUP);
  pinMode(SENS_OUT_PIN, INPUT_PULLUP);

  // Kilit Solenoidleri varsayılan olarak çıkış ve KAPALI (LOW)
  pinMode(5, OUTPUT);
  digitalWrite(5, LOW);
  pinMode(6, OUTPUT);
  digitalWrite(6, LOW);

  delay(100);
  Serial.println("SYS:READY");
}

void loop() {
  // 1. Seri Porttan Veri Oku
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    if (inChar == '\n') {
      stringComplete = true;
    } else if (inChar != '\r') {
      inputString += inChar;
    }
  }

  if (stringComplete) {
    inputString.trim();
    processCommand(inputString);
    inputString = "";
    stringComplete = false;
  }

  // 2. Sensör Takip & Debouncing (Şişe Algılama)
  int currentIn = digitalRead(SENS_IN_PIN);
  int currentOut = digitalRead(SENS_OUT_PIN);

  // Giriş sensörü tetiklenme takibi (HIGH'dan LOW'a geçiş = Şişe lazeri kesti)
  if (currentIn != lastInState) {
    if ((millis() - lastInDebounce) > DEBOUNCE_DELAY) {
      if (currentIn == LOW) { // Engel algılandı (Şişe girdi)
        Serial.println("EVENT:PIN:D2:ACTIVE");
      }
      lastInState = currentIn;
      lastInDebounce = millis();
    }
  }

  // Çıkış sensörü tetiklenme takibi (HIGH'dan LOW'a geçiş = Şişe lazeri kesti)
  if (currentOut != lastOutState) {
    if ((millis() - lastOutDebounce) > DEBOUNCE_DELAY) {
      if (currentOut == LOW) { // Engel algılandı (Şişe çıktı)
        Serial.println("EVENT:PIN:D3:ACTIVE");
      }
      lastOutState = currentOut;
      lastOutDebounce = millis();
    }
  }
}

void processCommand(String cmd) {
  // 1. Handshake Teşhis Talebi
  if (cmd == "WHOAMI") {
    Serial.println(HANDSHAKE_ID);
    return;
  }

  // 2. Kilit Kapı Kontrolleri
  // Format: GATE:OPEN:D5 veya GATE:CLOSE:D5
  if (cmd.startsWith("GATE:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);

    if (firstColon != -1 && secondColon != -1) {
      String action =
          cmd.substring(firstColon + 1, secondColon); // "OPEN" veya "CLOSE"
      String pinStr = cmd.substring(secondColon + 1); // "D5" veya "D6"

      if (pinStr.startsWith("D")) {
        int pinNum = pinStr.substring(1).toInt();

        if (pinNum >= 2 && pinNum <= 13) {
          pinMode(pinNum, OUTPUT);

          if (action == "OPEN") {
            digitalWrite(pinNum, HIGH);
            Serial.print("ACK:");
            Serial.print(cmd);
            Serial.println(":SUCCESS");
          } else if (action == "CLOSE") {
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
    return;
  }

  // 3. HC-SR04 Ultrasonik Mesafe Okuma Talebi
  // Format: READ:HCSR04:D7:D8 (Trigger=D7, Echo=D8)
  if (cmd.startsWith("READ:HCSR04:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);
    int thirdColon = cmd.indexOf(':', secondColon + 1);
    int fourthColon = cmd.indexOf(':', thirdColon + 1);

    String trigStr = cmd.substring(thirdColon + 1, fourthColon);
    String echoStr = cmd.substring(fourthColon + 1);

    if (trigStr.startsWith("D") && echoStr.startsWith("D")) {
      int trigPin = trigStr.substring(1).toInt();
      int echoPin = echoStr.substring(1).toInt();

      if (trigPin >= 2 && trigPin <= 13 && echoPin >= 2 && echoPin <= 13) {
        // HC-SR04 ölçümünü yap
        pinMode(trigPin, OUTPUT);
        pinMode(echoPin, INPUT);

        digitalWrite(trigPin, LOW);
        delayMicroseconds(2);
        digitalWrite(trigPin, HIGH);
        delayMicroseconds(10);
        digitalWrite(trigPin, LOW);

        // 30ms timeout ile yankı bekle (maks. 5 metre mesafe limitine denk
        // gelir)
        unsigned long duration = pulseIn(echoPin, HIGH, 30000);

        if (duration == 0) {
          // Ölçüm alınamadıysa varsayılan emniyet mesafesi (500mm boş depo) dön
          Serial.println("EVENT:HCSR04:500");
        } else {
          // Ses hızı: 343 m/s = 0.343 mm/us
          // Gidiş-dönüş olduğu için 2'ye bölüyoruz
          int distance_mm = (duration * 0.343) / 2;

          Serial.print("EVENT:HCSR04:");
          Serial.println(distance_mm);
        }
      } else {
        Serial.println("ERR:PIN_OUT_OF_BOUNDS");
      }
    } else {
      Serial.println("ERR:INVALID_PIN_FORMAT");
    }
  }
}
