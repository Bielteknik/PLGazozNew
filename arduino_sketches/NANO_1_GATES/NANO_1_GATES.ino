/* 
 * NANO-1: Kilit Kontrol (NEMA 17) + Lazer Sensör (V3.1)
 * Kimlik: GatesNano
 */

#define HARDWARE_ID "GatesNano"

#define DIR1_PIN 2
#define STEP1_PIN 5
#define DIR2_PIN 3
#define STEP2_PIN 6
#define EN_PIN 8

#define SENS_IN 12
#define SENS_OUT 13

int stepDelay = 800;
unsigned long lastMoveTime = 0;
const long DEFAULT_STEPS = 1000; // 1/0 komutu geldiğinde atılacak adım

int lastInState = HIGH;
int lastOutState = HIGH;

void enableDriver() { digitalWrite(EN_PIN, LOW); }
void disableDriver() { digitalWrite(EN_PIN, HIGH); }

void setup() {
  Serial.begin(9600);
  
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);
  pinMode(STEP2_PIN, OUTPUT);
  pinMode(DIR2_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  
  pinMode(SENS_IN, INPUT_PULLUP);
  pinMode(SENS_OUT, INPUT_PULLUP);
  
  disableDriver();
  // İlk açılışta kimlik bildir
  Serial.print("ID:"); Serial.println(HARDWARE_ID);
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
  // --- LAZER SENSÖR TAKİBİ (Kimlikli Raporlama) ---
  int currentIn = digitalRead(SENS_IN);
  if (currentIn == LOW && lastInState == HIGH) {
    Serial.print(HARDWARE_ID); Serial.println(":P1:IN");
    delay(50);
  }
  lastInState = currentIn;

  int currentOut = digitalRead(SENS_OUT);
  if (currentOut == LOW && lastOutState == HIGH) {
    Serial.print(HARDWARE_ID); Serial.println(":P1:OUT");
    delay(50);
  }
  lastOutState = currentOut;

  // --- KOMUT İŞLEME ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    // Kimlik Sorguları
    if (cmd == "IDENTIFY" || cmd == "STATUS") {
      Serial.print("ID:"); Serial.println(HARDWARE_ID);
    }
    // Giriş Motoru (G1)
    else if (cmd.startsWith("G1:")) {
      int val = cmd.substring(3).toInt();
      // val == 1 ise ileri, val == 0 ise geri (varsayılan adım)
      // val > 1 ise spesifik adım sayısı kadar git
      long targetSteps = (abs(val) <= 1) ? DEFAULT_STEPS : abs(val);
      moveMotor(STEP1_PIN, DIR1_PIN, (val > 0), targetSteps);
      Serial.print(HARDWARE_ID); Serial.print(":ACK:G1:"); Serial.println(val);
    }
    // Çıkış Motoru (G2)
    else if (cmd.startsWith("G2:")) {
      int val = cmd.substring(3).toInt();
      long targetSteps = (abs(val) <= 1) ? DEFAULT_STEPS : abs(val);
      moveMotor(STEP2_PIN, DIR2_PIN, (val > 0), targetSteps);
      Serial.print(HARDWARE_ID); Serial.print(":ACK:G2:"); Serial.println(val);
    }
    // Hız Ayarı
    else if (cmd.startsWith("s")) {
      stepDelay = cmd.substring(1).toInt();
      Serial.print(HARDWARE_ID); Serial.print(":ACK:SPEED:"); Serial.println(stepDelay);
    }
  }

  // --- OTOMATİK UYKU ---
  if (millis() - lastMoveTime > 2000) {
    disableDriver();
  }
}
