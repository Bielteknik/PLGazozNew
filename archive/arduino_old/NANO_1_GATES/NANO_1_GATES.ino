/* 
 * NANO-1: Kilit Kontrol (NEMA 17) + Lazer Sensör (V3.0)
 * Pinler:
 * - Motor 1 (Giriş): DIR=2, STEP=5, EN=8
 * - Motor 2 (Çıkış): DIR=3, STEP=6, EN=8 (Ortak EN)
 * - Sensörler: D12 (Giriş Lazeri), D13 (Çıkış Lazeri)
 */

#define DIR1_PIN 2
#define STEP1_PIN 5
#define DIR2_PIN 3
#define STEP2_PIN 6
#define EN_PIN 8

#define SENS_IN 12
#define SENS_OUT 13

int stepDelay = 800;
unsigned long lastMoveTime = 0;
const long STEPS_PER_COMMAND = 1000; // G1:100 geldiğinde atılacak adım sayısı

// Sensör durum takibi
int lastInState = HIGH;
int lastOutState = HIGH;

void enableDriver() {
  digitalWrite(EN_PIN, LOW); // A4988/DRV8825 için LOW = ENABLE
}

void disableDriver() {
  digitalWrite(EN_PIN, HIGH); // HIGH = DISABLE (Motor boşa çıkar, cızırtı kesilir)
}

void setup() {
  Serial.begin(9600); // Tüm sistemle uyumlu 9600 hızı sabitleyeli
  
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);
  pinMode(STEP2_PIN, OUTPUT);
  pinMode(DIR2_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  
  pinMode(SENS_IN, INPUT_PULLUP);
  pinMode(SENS_OUT, INPUT_PULLUP);
  
  disableDriver();
  Serial.println("ACK:CNC_GATES_WITH_SENSORS_READY");
}

void moveMotor(int stepPin, int dirPin, bool dir, long steps) {
  enableDriver();
  digitalWrite(dirPin, dir);
  
  for(long i = 0; i < steps; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(stepDelay);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelay);
  }
  lastMoveTime = millis();
}

void loop() {
  // --- LAZER SENSÖR TAKİBİ (D12 - D13) ---
  int currentIn = digitalRead(SENS_IN);
  if (currentIn == LOW && lastInState == HIGH) {
    Serial.println("SENS:IN"); // Python'a bildir
    delay(50); // Debounce
  }
  lastInState = currentIn;

  int currentOut = digitalRead(SENS_OUT);
  if (currentOut == LOW && lastOutState == HIGH) {
    Serial.println("SENS:OUT"); // Python'a bildir
    delay(50); // Debounce
  }
  lastOutState = currentOut;

  // --- KOMUT İŞLEME ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    // Giriş Motoru (G1)
    if (cmd.startsWith("G1:")) {
      int val = cmd.substring(3).toInt();
      // val > 0 ise ileri, val == 0 ise geri gibi düşünülebilir
      moveMotor(STEP1_PIN, DIR1_PIN, (val > 0), STEPS_PER_COMMAND);
      Serial.print("ACK:G1:"); Serial.println(val);
    }
    // Çıkış Motoru (G2)
    else if (cmd.startsWith("G2:")) {
      int val = cmd.substring(3).toInt();
      moveMotor(STEP2_PIN, DIR2_PIN, (val > 0), STEPS_PER_COMMAND);
      Serial.print("ACK:G2:"); Serial.println(val);
    }
    // CNC Tarzı Manuel Komutlar (Hız ayarı vb)
    else if (cmd.startsWith("s")) {
      stepDelay = cmd.substring(1).toInt();
      Serial.print("ACK:SPEED:"); Serial.println(stepDelay);
    }
  }

  // --- OTOMATİK UYKU (Cızırtı Önleme) ---
  // Eğer 2 saniyedir hareket yoksa motorların gücünü kes
  if (millis() - lastMoveTime > 2000) {
    disableDriver();
  }
}
